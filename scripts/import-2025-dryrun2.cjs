const fs = require('fs');
const mysql = require('mysql2/promise');

// ══════ CONFIG ══════
const CSV_PATH = '/home/user/uploaded_files/DOC-20260820-WA0013.csv';

// 姓名修正映射（CSV名 → 系統名）
const NAME_FIXES = {
  '黃思迪': '黃思廸',
  '李駿𤋮': '李駿熙',
};

// ══════ HELPERS ══════

function parseQuarter(text) {
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

function parseDate(text, quarterInfo) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]);
    const year = parseInt(m[3]);
    return { date: new Date(year, month - 1, day), approx: false };
  }
  if (quarterInfo) {
    const qStartMonths = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
    return { date: new Date(quarterInfo.year, qStartMonths[quarterInfo.quarter], 1), approx: true };
  }
  return { date: new Date(), approx: true };
}

// 判斷是否為道袍/用品費
function isEquipmentFee(notes, amount, nameCount) {
  const n = (notes || '').trim();
  // 直接標記為袍
  if (n === '袍' || n.startsWith('袍/') || n.startsWith('袍：') || n.startsWith('袍:') || n.startsWith('袍 ')) return true;
  // 備註含「袍 $」
  if (n.match(/袍\s*\$/)) return true;
  // 「制服」「手把」在備註且金額剛好是裝備費
  if ((n.includes('制服') || n.includes('手把')) && !n.includes('學費')) return true;
  return false;
}

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

  const conn = await mysql.createConnection({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'utf8mb4'
  });

  const [dbStudents] = await conn.query('SELECT id, name, feePerQuarter FROM students');
  const studentMap = new Map();
  dbStudents.forEach(s => studentMap.set(s.name, { id: s.id, fee: s.feePerQuarter }));

  // Check existing payment records to avoid duplicates
  const [existingPayments] = await conn.query(
    'SELECT studentId, year, paymentPeriod, amount FROM paymentRecords'
  );
  const existingSet = new Set();
  existingPayments.forEach(p => {
    existingSet.add(`${p.studentId}_${p.year}_${p.paymentPeriod}_${p.amount}`);
  });

  let insertCount = 0;
  let skipCount = 0;
  let equipCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const row of rows) {
    const qInfo = parseQuarter(row.quarterText);
    if (!qInfo) {
      errors.push(`無法解析季度: ${row.quarterText}`);
      errorCount++;
      continue;
    }

    // Split multiple students — support both 、 and ，
    const nameList = row.names.split(/[、，]/).map(n => n.trim()).filter(n => n.length > 0);
    const totalAmount = parseFloat(row.amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      errors.push(`金額無效: ${row.names} → "${row.amount}"`);
      errorCount++;
      continue;
    }

    // Equipment fee check
    const isEquip = isEquipmentFee(row.notes, totalAmount, nameList.length);

    // Per-student amount
    const perStudentAmount = totalAmount / nameList.length;

    const { date: paymentDate, approx: dateApprox } = parseDate(row.dateText, qInfo);
    const dateStr = paymentDate.toISOString().split('T')[0];

    let receivingBank = '中銀香港';
    if (row.bank.includes('匯豐') || row.bank.includes('HSBC')) {
      receivingBank = '匯豐銀行';
    }

    for (const rawName of nameList) {
      const name = NAME_FIXES[rawName] || rawName;
      const student = studentMap.get(name);

      if (!student) {
        errors.push(`找不到學生: ${rawName} (${row.quarterText})`);
        errorCount++;
        continue;
      }

      if (isEquip) {
        equipCount++;
        continue;
      }

      // Check duplicate
      const dupeKey = `${student.id}_${qInfo.year}_${qInfo.quarter}_${perStudentAmount.toFixed(2)}`;
      if (existingSet.has(dupeKey)) {
        skipCount++;
        continue;
      }

      // INSERT
      // DRY RUN - skip: await conn.execute(
        `INSERT INTO paymentRecords 
         (studentId, year, paymentPeriod, amount, paymentDate, status, confirmedBy, receivingBank, notes, paymentMonth)
         VALUES (?, ?, ?, ?, ?, 'confirmed', 'admin_approved', ?, ?, ?)`,
        [
          student.id,
          qInfo.year,
          qInfo.quarter,
          perStudentAmount.toFixed(2),
          dateStr,
          receivingBank,
          row.notes ? `[CSV導入] ${row.notes}` : '[CSV批量導入]',
          null,
        ]
      );

      existingSet.add(dupeKey);
      insertCount++;
    }
  }

  await conn.end();

  // Output
  console.log('═══════════════════════════════════════════');
  console.log('  2025年 繳費記錄批量導入 — 正式執行');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ 成功寫入:   ${insertCount} 筆`);
  console.log(`  🎽 用品費跳過: ${equipCount} 筆`);
  console.log(`  ⚠️ 重複跳過:   ${skipCount} 筆`);
  console.log(`  ❌ 錯誤:       ${errorCount} 筆`);
  console.log('═══════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\n── 錯誤詳情 ──');
    errors.forEach(e => console.log(`   ❌ ${e}`));
  }
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
