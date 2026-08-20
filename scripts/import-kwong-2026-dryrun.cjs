/**
 * Dry-run script for importing 鄺富華教練 2026 payment CSV
 * File: DOC-20260821-WA0000.csv
 * Covers: 2026 Q1-Q3
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const CSV_PATH = '/home/user/uploaded_files/DOC-20260821-WA0000.csv';

// Students in DB under 鄺富華教練
const STUDENT_MAP = {
  '丁梓軒': 170, '余學然': 175, '侯兆洪': 164, '劉宇政': 173, '劉燊政': 174,
  '吳德熹': 181, '曾偉傑': 182, '曾鎧淇': 183, '梁熙朗': 190, '楊倬蘅': 172,
  '葉浩晴': 178, '薛晶塵': 186, '薛裕霖': 185, '蘇均濤': 171, '蘇柏霖': 179,
  '覃梓恩': 188, '許子堯': 166, '許子諾': 165, '許雋昇': 180, '賴柏希': 184,
  '趙晉翹': 169, '趙栢臻': 168, '陳雪瑩': 176, '黃信恩': 167, '黃信行': 163,
  '黃梓峻': 187, '黃蜻蜓': 189
};

// Quarter mapping
function parseQuarter(qStr) {
  // "2026年1-3月" -> { year: 2026, quarter: 'Q1' }
  const m = qStr.match(/(\d{4})年(\d+)-(\d+)月/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const startMonth = parseInt(m[2]);
  const quarterMap = { 1: 'Q1', 4: 'Q2', 7: 'Q3', 10: 'Q4' };
  return { year, quarter: quarterMap[startMonth] || null };
}

// Parse date DD/MM/YYYY -> YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const m = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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

// Split multi-student names
function splitNames(nameStr) {
  // This CSV uses space as separator, but also double space
  // Split by one or more spaces
  return nameStr.trim().split(/\s+/).filter(n => n.length > 0);
}

// Detect non-tuition fees (搏擊班, 搏盡費用, equipment, etc.)
function isNonTuition(notes) {
  if (!notes) return false;
  return /搏擊班|搏盡費用/.test(notes);
}

// Extract bank from notes
function extractBank(notes) {
  if (!notes) return '';
  const m = notes.match(/付款方式\/銀行：([^；;]+)/);
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
  
  console.log(`📂 檔案: DOC-20260821-WA0000.csv`);
  console.log(`📊 總行數: ${lines.length - 1} (不含標題)`);
  console.log('');

  const records = [];
  const issues = [];
  const newStudents = new Set();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) {
      issues.push(`行 ${i+1}: 欄位不足 (${fields.length} 欄)`);
      continue;
    }

    const [qStr, seqNum, nameField, amountStr, dateStr, bankInfo, notes] = fields;
    const qInfo = parseQuarter(qStr);
    if (!qInfo) {
      issues.push(`行 ${i+1}: 無法解析季度 "${qStr}"`);
      continue;
    }

    const amount = parseAmount(amountStr);
    const payDate = parseDate(dateStr);
    const names = splitNames(nameField);
    const perPerson = Math.round(amount / names.length);
    const bank = extractBank(notes || '');
    const nonTuition = isNonTuition(notes || '');

    for (const name of names) {
      const studentId = STUDENT_MAP[name];
      if (!studentId) {
        newStudents.add(name);
        issues.push(`行 ${i+1}: 學生 "${name}" 不在系統中`);
      }
      
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
        notes: notes || '',
        nonTuition,
        nameCount: names.length
      });
    }
  }

  // Summary
  const tuitionRecords = records.filter(r => !r.nonTuition);
  const nonTuitionRecords = records.filter(r => r.nonTuition);

  console.log('=== 📊 解析結果 ===');
  console.log(`✅ 學費記錄: ${tuitionRecords.length} 筆`);
  console.log(`⚠️ 非學費記錄 (搏擊班等): ${nonTuitionRecords.length} 筆`);
  console.log('');

  if (newStudents.size > 0) {
    console.log('=== ❌ 系統中找不到的學生 ===');
    for (const name of newStudents) {
      console.log(`  - ${name}`);
    }
    console.log('');
  }

  // Group by quarter
  console.log('=== 📅 按季度分組 ===');
  const byQuarter = {};
  for (const r of tuitionRecords) {
    const key = `${r.year} ${r.quarter}`;
    if (!byQuarter[key]) byQuarter[key] = [];
    byQuarter[key].push(r);
  }
  for (const [q, recs] of Object.entries(byQuarter).sort()) {
    console.log(`\n${q} (${recs.length} 筆):`);
    for (const r of recs) {
      const status = r.studentId ? '✅' : '❌';
      const note = r.notes ? ` [${r.notes.substring(0, 40)}...]` : '';
      console.log(`  ${status} ${r.name} | $${r.amount} | ${r.payDate} | ${r.bank}${note}`);
    }
  }

  // Non-tuition records
  if (nonTuitionRecords.length > 0) {
    console.log('\n=== ⚠️ 非學費記錄 (不導入) ===');
    for (const r of nonTuitionRecords) {
      console.log(`  ${r.name} | ${r.year} ${r.quarter} | $${r.amount} | ${r.notes.substring(0, 60)}`);
    }
  }

  // Issues
  if (issues.length > 0) {
    console.log('\n=== ⚠️ 問題清單 ===');
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  // Duplicate check against existing DB
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'utf8mb4'
  });

  const [existing] = await conn.execute(
    `SELECT studentId, year, paymentPeriod, amount FROM paymentRecords 
     WHERE studentId IN (${Object.values(STUDENT_MAP).join(',')})
     AND year = 2026`
  );

  const existingKeys = new Set(existing.map(r => 
    `${r.studentId}_${r.year}_${r.paymentPeriod}_${r.amount}`
  ));

  const duplicates = tuitionRecords.filter(r => 
    r.studentId && existingKeys.has(`${r.studentId}_${r.year}_${r.quarter}_${r.amount}`)
  );

  if (duplicates.length > 0) {
    console.log(`\n=== 🔄 潛在重複 (已在DB中): ${duplicates.length} 筆 ===`);
    for (const d of duplicates) {
      console.log(`  ${d.name} | ${d.year} ${d.quarter} | $${d.amount}`);
    }
  }

  const toInsert = tuitionRecords.filter(r => 
    r.studentId && !existingKeys.has(`${r.studentId}_${r.year}_${r.quarter}_${r.amount}`)
  );

  console.log(`\n=== 📝 最終統計 ===`);
  console.log(`將導入: ${toInsert.length} 筆學費記錄`);
  console.log(`跳過(重複): ${duplicates.length} 筆`);
  console.log(`跳過(非學費): ${nonTuitionRecords.length} 筆`);
  console.log(`需新增學生: ${newStudents.size} 位`);

  await conn.end();
}

main().catch(console.error);
