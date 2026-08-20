const fs = require('fs');
const mysql = require('mysql2/promise');

// ══════ CONFIG ══════
const CSV_PATH = '/home/user/uploaded_files/DOC-20260820-WA0011.csv';

// 姓名修正映射（CSV名 → 系統名）
const NAME_FIXES = {
  '黃思迪': '黃思廸',
  '李駿𤋮': '李駿熙',
};

// 不存在系統中的學生（跳過）— 已全部加入系統
const SKIP_NAMES = new Set([]);

// ══════ HELPERS ══════

// 解析季度文字 → { year, quarter }
function parseQuarter(text) {
  // "2026年1-3月" → Q1, "2026年4-6月" → Q2, etc.
  const m = text.match(/(\d{4})年(\d+)-(\d+)月/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const startMonth = parseInt(m[2]);
  if (startMonth === 1) return { year, quarter: 'Q1' };
  if (startMonth === 4) return { year, quarter: 'Q2' };
  if (startMonth === 7) return { year, quarter: 'Q3' };
  if (startMonth === 10) return { year, quarter: 'Q4' };
  return null;
}

// 解析日期文字 → Date 或 null
function parseDate(text, quarterInfo) {
  // 嘗試提取 dd/mm/yyyy
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]);
    const year = parseInt(m[3]);
    return new Date(year, month - 1, day);
  }
  // 無法解析 → 用季度首月1日作為預設
  if (quarterInfo) {
    const qStartMonths = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
    return new Date(quarterInfo.year, qStartMonths[quarterInfo.quarter], 1);
  }
  return new Date();
}

// 判斷是否為道袍/用品費（非學費）
function isEquipmentFee(notes) {
  const n = (notes || '').trim();
  // 備註只是「袍」或以「袍」開頭，且金額通常 ≤ 550
  return n === '袍' || n.startsWith('袍/') || n.startsWith('袍：') || n.startsWith('袍:');
}

// 解析 CSV（支援 quoted fields）
function parseCSV(content) {
  const lines = content.trim().split('\n');
  return lines.slice(1).map(line => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);
    return {
      quarterText: (parts[0] || '').trim(),
      refNum: (parts[1] || '').trim(),
      names: (parts[2] || '').trim(),
      amount: (parts[3] || '').trim().replace(/,/g, ''),
      dateText: (parts[4] || '').trim(),
      bank: (parts[5] || '').trim(),
      notes: (parts[6] || '').replace(/\r/g, '').trim(),
    };
  });
}

// ══════ MAIN ══════
async function main() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csv);

  // Get students from DB
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'utf8mb4'
  });
  const [dbStudents] = await conn.query('SELECT id, name, feePerQuarter FROM students WHERE status = "active"');
  const studentMap = new Map(); // name → { id, feePerQuarter }
  dbStudents.forEach(s => studentMap.set(s.name, { id: s.id, fee: s.feePerQuarter }));

  // Check existing payment records to avoid duplicates
  const [existingPayments] = await conn.query(
    'SELECT studentId, year, paymentPeriod, amount FROM paymentRecords'
  );
  const existingSet = new Set();
  existingPayments.forEach(p => {
    existingSet.add(`${p.studentId}_${p.year}_${p.paymentPeriod}_${p.amount}`);
  });

  await conn.end();

  // Process rows
  const results = [];
  const skipped = [];
  const errors = [];
  let totalInserts = 0;

  for (const row of rows) {
    const qInfo = parseQuarter(row.quarterText);
    if (!qInfo) {
      errors.push({ row, reason: `無法解析季度: ${row.quarterText}` });
      continue;
    }

    // Split multiple students
    const nameList = row.names.split('，').map(n => n.trim());
    const totalAmount = parseFloat(row.amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      errors.push({ row, reason: `金額無效: ${row.amount}` });
      continue;
    }

    // Equipment fee → separate category
    const isEquip = isEquipmentFee(row.notes);

    // Per-student amount (split evenly for multi-student)
    const perStudentAmount = totalAmount / nameList.length;

    const paymentDate = parseDate(row.dateText, qInfo);
    const dateStr = paymentDate.toISOString().split('T')[0];
    const dateApprox = !row.dateText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/);

    for (const rawName of nameList) {
      // Apply name fixes
      const name = NAME_FIXES[rawName] || rawName;

      // Skip names not in system
      if (SKIP_NAMES.has(rawName) || SKIP_NAMES.has(name)) {
        skipped.push({ name: rawName, reason: '學生不在系統中', quarter: row.quarterText, amount: perStudentAmount });
        continue;
      }

      const student = studentMap.get(name);
      if (!student) {
        errors.push({ row, name: rawName, reason: `系統找不到學生: ${rawName}${NAME_FIXES[rawName] ? ' (已嘗試修正為 ' + name + ')' : ''}` });
        continue;
      }

      // Check for duplicates
      const dupeKey = `${student.id}_${qInfo.year}_${qInfo.quarter}_${perStudentAmount.toFixed(2)}`;
      const isDuplicate = existingSet.has(dupeKey);

      // Determine receiving bank
      let receivingBank = '中銀香港';
      if (row.bank.includes('匯豐') || row.bank.includes('HSBC')) {
        receivingBank = '匯豐銀行';
      }

      const record = {
        studentId: student.id,
        studentName: name,
        year: qInfo.year,
        quarter: qInfo.quarter,
        amount: perStudentAmount.toFixed(2),
        paymentDate: dateStr,
        dateApprox,
        receivingBank,
        notes: row.notes || null,
        isEquipment: isEquip,
        isDuplicate,
        refNum: row.refNum,
      };

      results.push(record);
      if (!isDuplicate && !isEquip) totalInserts++;
    }
  }

  // ══════ OUTPUT REPORT ══════
  console.log('═══════════════════════════════════════════');
  console.log('  繳費記錄批量導入 — DRY RUN 預覽');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Group by quarter for display
  const byQuarter = {};
  results.forEach(r => {
    const key = `${r.year} ${r.quarter}`;
    if (!byQuarter[key]) byQuarter[key] = [];
    byQuarter[key].push(r);
  });

  for (const [qLabel, recs] of Object.entries(byQuarter)) {
    const tuitionRecs = recs.filter(r => !r.isEquipment);
    const equipRecs = recs.filter(r => r.isEquipment);
    const dupeRecs = tuitionRecs.filter(r => r.isDuplicate);
    const newRecs = tuitionRecs.filter(r => !r.isDuplicate);

    console.log(`\n── ${qLabel} ── (學費 ${tuitionRecs.length} 筆, 用品 ${equipRecs.length} 筆)`);
    console.log(`   ✅ 新記錄: ${newRecs.length} 筆 | ⚠️ 重複跳過: ${dupeRecs.length} 筆`);
    console.log('');

    for (const r of newRecs) {
      const dateFlag = r.dateApprox ? ' ⚡推算' : '';
      console.log(`   ✅ ${r.studentName.padEnd(5)} $${r.amount.padStart(7)} | ${r.paymentDate}${dateFlag} | ${r.receivingBank}`);
    }
    for (const r of dupeRecs) {
      console.log(`   ⚠️  ${r.studentName.padEnd(5)} $${r.amount.padStart(7)} | 已存在，跳過`);
    }
    for (const r of equipRecs) {
      console.log(`   🎽 ${r.studentName.padEnd(5)} $${r.amount.padStart(7)} | 用品費 (${r.notes})`);
    }
  }

  // Skipped students
  if (skipped.length > 0) {
    console.log('\n\n── 跳過的學生（不在系統中）──');
    skipped.forEach(s => {
      console.log(`   ⏭️  ${s.name} | ${s.quarter} $${s.amount} | ${s.reason}`);
    });
  }

  // Errors
  if (errors.length > 0) {
    console.log('\n\n── 解析錯誤 ──');
    errors.forEach(e => {
      console.log(`   ❌ ${e.name || e.row?.names || '?'} | ${e.reason}`);
    });
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('  摘要');
  console.log('═══════════════════════════════════════════');
  console.log(`  CSV 總行數:        ${rows.length}`);
  console.log(`  展開後總記錄:      ${results.length}`);
  console.log(`  ✅ 將寫入學費記錄: ${totalInserts} 筆`);
  console.log(`  🎽 用品費（不導入): ${results.filter(r => r.isEquipment).length} 筆`);
  console.log(`  ⚠️ 重複跳過:       ${results.filter(r => r.isDuplicate && !r.isEquipment).length} 筆`);
  console.log(`  ⏭️  學生不在系統:   ${skipped.length} 筆`);
  console.log(`  ❌ 解析錯誤:       ${errors.length} 筆`);
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
