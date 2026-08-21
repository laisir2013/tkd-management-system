/**
 * Dry-run script for importing 鄺富華教練 2025 payment CSV
 * File: DOC-20260821-WA0001.csv
 * Covers: 2025 Q1-Q4 (full year)
 * 
 * Key issues:
 * - 搏擊班 entries (lines 27, 33, 76, 88) → exclude
 * - Date error line 52: "30/62025" → fix to "30/06/2025"
 * - 余學然 duplicate in Q2 (lines 34-35) → same amount/date, likely source dup, import once
 * - 陳雪瑩 Q4 double entry (lines 82-83) → both $1,800 same date, import both (could be 2 quarters prepaid)
 * - 梁熙朗 Q4 $2,400 anomaly → import as-is with note
 * - 8 new students not in DB: 焦嶢, 蔡駿彥, 蔡柏麟, 袁柏軒, 馮竣謙, 許煒霆, 馬熙佑, 馬雋程
 * - 江希彤 exists as id 177 (under 賴政堡教練, merged previously)
 * - 薛裕霖 薛晶塵 Q3 line 56: amount $1,440 for 2 students → $720 each (unusual)
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const CSV_PATH = '/home/user/uploaded_files/DOC-20260821-WA0001.csv';

// Known students in DB under 鄺富華教練 (from prior import)
const STUDENT_MAP = {
  '丁梓軒': 170, '余學然': 175, '侯兆洪': 164, '劉宇政': 173, '劉燊政': 174,
  '吳德熹': 181, '曾偉傑': 182, '曾鎧淇': 183, '梁熙朗': 190, '楊倬蘅': 172,
  '葉浩晴': 178, '薛晶塵': 186, '薛裕霖': 185, '蘇均濤': 171, '蘇柏霖': 179,
  '覃梓恩': 188, '許子堯': 166, '許子諾': 165, '許雋昇': 180, '賴柏希': 184,
  '趙晉翹': 169, '趙栢臻': 168, '陳雪瑩': 176, '黃信恩': 167, '黃信行': 163,
  '黃梓峻': 187, '黃蜻蜓': 189, '江希彤': 177
};

// Quarter mapping
function parseQuarter(qStr) {
  const m = qStr.match(/(\d{4})年(\d+)-(\d+)月/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const startMonth = parseInt(m[2]);
  const quarterMap = { 1: 'Q1', 4: 'Q2', 7: 'Q3', 10: 'Q4' };
  return { year, quarter: quarterMap[startMonth] || null };
}

// Parse date DD/MM/YYYY -> YYYY-MM-DD (with fix for known error)
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  let cleaned = dateStr.trim();
  // Fix known error: "30/62025" -> "30/06/2025"
  if (cleaned === '30/62025') {
    cleaned = '30/06/2025';
  }
  const m = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

// Parse amount: "3,000" -> 3000
function parseAmount(amtStr) {
  return parseFloat(amtStr.replace(/,/g, '').replace(/"/g, ''));
}

// Split multi-student names (space or double-space separator)
function splitNames(nameStr) {
  return nameStr.trim().split(/\s+/).filter(n => n.length > 0);
}

// Detect non-tuition fees (搏擊班)
function isNonTuition(notes) {
  if (!notes) return false;
  return /搏擊班/.test(notes);
}

// Extract bank from notes
function extractBank(notes) {
  if (!notes) return '';
  const m = notes.match(/付款方式\/銀行：([^；;\r\n]+)/);
  return m ? m[1].trim() : '';
}

// Parse CSV with proper handling of quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  
  console.log(`📂 檔案: DOC-20260821-WA0001.csv (鄺富華教練 2025全年)`);
  console.log(`📊 總行數: ${lines.length - 1} (不含標題)`);
  console.log('');

  const records = [];
  const issues = [];
  const newStudents = new Set();
  const duplicateCheck = new Map(); // key -> line numbers for within-file dedup

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) {
      issues.push(`行 ${i+1}: 欄位不足 (${fields.length} 欄)`);
      continue;
    }

    const [qStr, seqNum, nameField, amountStr, dateStr, bankInfo, notesRaw] = fields;
    const notes = (notesRaw || '').replace(/\r/g, '').trim();
    const qInfo = parseQuarter(qStr);
    if (!qInfo) {
      issues.push(`行 ${i+1}: 無法解析季度 "${qStr}"`);
      continue;
    }

    const amount = parseAmount(amountStr);
    const payDate = parseDate(dateStr);
    const names = splitNames(nameField);
    const perPerson = Math.round(amount / names.length);
    const bank = extractBank(notes);
    const nonTuition = isNonTuition(notes);

    if (nonTuition) {
      records.push({
        line: i + 1,
        name: nameField,
        studentId: null,
        year: qInfo.year,
        quarter: qInfo.quarter,
        amount: amount,
        totalAmount: amount,
        payDate,
        bank,
        notes,
        nonTuition: true,
        nameCount: 1
      });
      continue;
    }

    for (const name of names) {
      const studentId = STUDENT_MAP[name];
      if (!studentId) {
        newStudents.add(name);
      }
      
      // Within-file duplicate check
      const dedupKey = `${name}_${qInfo.quarter}_${perPerson}_${payDate}`;
      if (!duplicateCheck.has(dedupKey)) {
        duplicateCheck.set(dedupKey, []);
      }
      duplicateCheck.get(dedupKey).push(i + 1);

      records.push({
        line: i + 1,
        name,
        studentId: studentId || null,
        year: qInfo.year,
        quarter: qInfo.quarter,
        amount: perPerson,
        totalAmount: amount,
        payDate,
        bank,
        notes,
        nonTuition: false,
        nameCount: names.length
      });
    }
  }

  // Summary
  const tuitionRecords = records.filter(r => !r.nonTuition);
  const nonTuitionRecords = records.filter(r => r.nonTuition);

  console.log('=== 📊 解析結果 ===');
  console.log(`✅ 學費記錄: ${tuitionRecords.length} 筆 (拆分多學生後)`);
  console.log(`⚠️ 非學費記錄 (搏擊班): ${nonTuitionRecords.length} 筆`);
  console.log('');

  // New students
  if (newStudents.size > 0) {
    console.log('=== ❌ 系統中找不到的學生 (需新增) ===');
    for (const name of [...newStudents].sort()) {
      // Count occurrences
      const count = tuitionRecords.filter(r => r.name === name).length;
      console.log(`  - ${name} (出現 ${count} 次)`);
    }
    console.log('');
  }

  // Within-file duplicates
  const withinFileDups = [...duplicateCheck.entries()].filter(([k, lines]) => lines.length > 1);
  if (withinFileDups.length > 0) {
    console.log('=== 🔄 檔案內重複記錄 ===');
    for (const [key, lineNums] of withinFileDups) {
      console.log(`  - ${key} → 行 ${lineNums.join(', ')}`);
    }
    console.log('');
  }

  // Group by quarter
  console.log('=== 📅 按季度分組 ===');
  const byQuarter = {};
  for (const r of tuitionRecords) {
    const key = `${r.year} ${r.quarter}`;
    if (!byQuarter[key]) byQuarter[key] = { records: [], total: 0 };
    byQuarter[key].records.push(r);
    byQuarter[key].total += r.amount;
  }
  for (const [q, data] of Object.entries(byQuarter).sort()) {
    console.log(`\n${q} (${data.records.length} 筆, 合計 $${data.total.toLocaleString()}):`);
    for (const r of data.records) {
      const status = r.studentId ? '✅' : '❌';
      const multiNote = r.nameCount > 1 ? ` [${r.nameCount}人分攤, 原$${r.totalAmount.toLocaleString()}]` : '';
      const bankNote = r.bank ? ` | ${r.bank}` : '';
      console.log(`  ${status} ${r.name} | $${r.amount.toLocaleString()} | ${r.payDate}${bankNote}${multiNote}`);
    }
  }

  // Non-tuition records
  if (nonTuitionRecords.length > 0) {
    console.log('\n=== ⚠️ 非學費記錄 (不導入) ===');
    for (const r of nonTuitionRecords) {
      console.log(`  行${r.line}: ${r.name} | ${r.year} ${r.quarter} | $${r.amount.toLocaleString()} | ${r.notes.substring(0, 80)}`);
    }
  }

  // Anomalies
  console.log('\n=== ⚡ 異常金額 ===');
  for (const r of tuitionRecords) {
    // Normal fee is $1,440 per student per quarter
    if (r.amount > 1800 && r.nameCount === 1) {
      console.log(`  行${r.line}: ${r.name} | ${r.quarter} | $${r.amount.toLocaleString()} (正常為$1,440)`);
    }
  }

  // DB duplicate check
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'utf8mb4'
  });

  const studentIds = Object.values(STUDENT_MAP);
  const [existing] = await conn.execute(
    `SELECT studentId, year, paymentPeriod, amount, paymentDate FROM paymentRecords 
     WHERE studentId IN (${studentIds.join(',')})
     AND year = 2025`
  );

  console.log(`\n=== 🗄️ 資料庫中已有 2025 年鄺富華教練相關記錄: ${existing.length} 筆 ===`);
  
  if (existing.length > 0) {
    const existingKeys = new Set(existing.map(r => 
      `${r.studentId}_${r.year}_${r.paymentPeriod}_${Number(r.amount)}`
    ));

    const duplicates = tuitionRecords.filter(r => 
      r.studentId && existingKeys.has(`${r.studentId}_${r.year}_${r.quarter}_${r.amount}`)
    );

    if (duplicates.length > 0) {
      console.log(`\n潛在重複: ${duplicates.length} 筆`);
      for (const d of duplicates) {
        console.log(`  ${d.name} | ${d.year} ${d.quarter} | $${d.amount}`);
      }
    }
  }

  // Final summary
  const validRecords = tuitionRecords.filter(r => r.studentId);
  const invalidRecords = tuitionRecords.filter(r => !r.studentId);

  console.log(`\n=== 📝 最終統計 ===`);
  console.log(`可導入 (有studentId): ${validRecords.length} 筆`);
  console.log(`無法導入 (學生不存在): ${invalidRecords.length} 筆 (涉及 ${newStudents.size} 位新學生)`);
  console.log(`跳過(非學費/搏擊班): ${nonTuitionRecords.length} 筆`);
  console.log(`需新增學生: ${newStudents.size} 位`);
  console.log('');
  console.log('💡 建議: 先新增以下學生到系統，再執行正式導入:');
  for (const name of [...newStudents].sort()) {
    console.log(`   INSERT INTO students (name, coach, status, feePerQuarter, phone, venue) VALUES ('${name}', '鄺富華教練', 'active', 1440, '', '');`);
  }

  await conn.end();
}

main().catch(console.error);
