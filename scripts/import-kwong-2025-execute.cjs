/**
 * Execute import for 鄺富華教練 2025 payment CSV
 * File: DOC-20260821-WA0001.csv
 * Covers: 2025 Q1-Q4 (full year)
 * 
 * Decisions:
 * - 搏擊班 records (lines 27, 33, 76, 88) are EXCLUDED
 * - Date error "30/62025" → fixed to "30/06/2025"
 * - 余學然 Q2 duplicate (lines 34-35): same person/amount/date → import only ONCE
 * - 陳雪瑩 Q4 double entry (lines 82-83): both $1,800 same date → import BOTH (CSV備註提到疑重複但可能分屬兩期)
 * - 梁熙朗 Q4 $2,400 anomaly → import as-is with note
 * - 薛裕霖+薛晶塵 Q3 $1,440÷2=$720 each → import as-is (may be partial quarter)
 * - Multi-student: split by space(s), amount divided equally
 * - 8 new students created (IDs 319-326)
 * - 江希彤: use existing ID 177 (under 賴政堡教練, transferred)
 * - receivingBank: 中國銀行（香港）for all
 * - 劉宇政+劉燊政 Q1: $1,440÷2=$720 each (but Q2-Q4 show $3,000÷2=$1,500 each)
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const CSV_PATH = '/home/user/uploaded_files/DOC-20260821-WA0001.csv';

// Complete student map including 8 newly created students
const STUDENT_MAP = {
  '丁梓軒': 170, '余學然': 175, '侯兆洪': 164, '劉宇政': 173, '劉燊政': 174,
  '吳德熹': 181, '曾偉傑': 182, '曾鎧淇': 183, '梁熙朗': 190, '楊倬蘅': 172,
  '葉浩晴': 178, '薛晶塵': 186, '薛裕霖': 185, '蘇均濤': 171, '蘇柏霖': 179,
  '覃梓恩': 188, '許子堯': 166, '許子諾': 165, '許雋昇': 180, '賴柏希': 184,
  '趙晉翹': 169, '趙栢臻': 168, '陳雪瑩': 176, '黃信恩': 167, '黃信行': 163,
  '黃梓峻': 187, '黃蜻蜓': 189, '江希彤': 177,
  // New students (2025 CSV specific)
  '焦嶢': 319, '蔡柏麟': 320, '蔡駿彥': 321, '袁柏軒': 322,
  '許煒霆': 323, '馬熙佑': 324, '馬雋程': 325, '馮竣謙': 326
};

const RECEIVING_BANK = '中國銀行（香港）';

function parseQuarter(qStr) {
  const m = qStr.match(/(\d{4})年(\d+)-(\d+)月/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const startMonth = parseInt(m[2]);
  const quarterMap = { 1: 'Q1', 4: 'Q2', 7: 'Q3', 10: 'Q4' };
  return { year, quarter: quarterMap[startMonth] || null };
}

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

function parseAmount(amtStr) {
  return parseFloat(amtStr.replace(/,/g, '').replace(/"/g, ''));
}

function splitNames(nameStr) {
  return nameStr.trim().split(/\s+/).filter(n => n.length > 0);
}

function isNonTuition(notes) {
  if (!notes) return false;
  return /搏擊班/.test(notes);
}

function extractBank(notes) {
  if (!notes) return '';
  const m = notes.match(/付款方式\/銀行：([^；;\r\n]+)/);
  return m ? m[1].trim() : '';
}

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

function getPaymentMonth(payDate) {
  if (!payDate) return null;
  const m = payDate.match(/\d{4}-(\d{2})/);
  return m ? parseInt(m[1]) : null;
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const conn = await mysql.createConnection({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'utf8mb4'
  });

  // Check existing records for dedup
  const studentIds = Object.values(STUDENT_MAP);
  const [existing] = await conn.execute(
    `SELECT studentId, year, paymentPeriod, amount FROM paymentRecords 
     WHERE studentId IN (${studentIds.join(',')})
     AND year = 2025`
  );
  const existingKeys = new Set(existing.map(r => 
    `${r.studentId}_${r.year}_${r.paymentPeriod}_${Number(r.amount)}`
  ));

  let inserted = 0;
  let skippedDup = 0;
  let skippedNonTuition = 0;
  let skippedWithinFileDup = 0;
  const errors = [];
  
  // Track within-file duplicates (for 余學然 Q2 case)
  const insertedKeys = new Set();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) continue;

    const [qStr, seqNum, nameField, amountStr, dateStr, bankInfo, notesRaw] = fields;
    const notes = (notesRaw || '').replace(/\r/g, '').trim();
    
    if (isNonTuition(notes)) {
      skippedNonTuition++;
      continue;
    }

    const qInfo = parseQuarter(qStr);
    if (!qInfo) continue;

    const amount = parseAmount(amountStr);
    const payDate = parseDate(dateStr);
    const names = splitNames(nameField);
    const perPerson = Math.round(amount / names.length);
    const bank = extractBank(notes);
    const paymentMonth = getPaymentMonth(payDate);

    // Build notes for DB
    let dbNotes = '';
    if (notes && !notes.startsWith('付款方式')) {
      // Has extra info beyond bank
      const bankPart = notes.match(/付款方式\/銀行：[^；;\r\n]+/);
      const extra = notes.replace(/付款方式\/銀行：[^；;\r\n]+[；;]?/g, '').trim();
      if (extra) dbNotes = `[CSV導入] ${extra}`;
      else dbNotes = '[CSV批量導入]';
    } else if (notes) {
      const extra = notes.replace(/付款方式\/銀行：[^；;\r\n]+[；;]?/, '').trim();
      if (extra) dbNotes = `[CSV導入] ${extra}`;
      else dbNotes = '[CSV批量導入]';
    } else {
      dbNotes = '[CSV批量導入]';
    }

    for (const name of names) {
      const studentId = STUDENT_MAP[name];
      if (!studentId) {
        errors.push(`行 ${i+1}: 找不到學生 "${name}"`);
        continue;
      }

      // DB dedup check
      const dbKey = `${studentId}_${qInfo.year}_${qInfo.quarter}_${perPerson}`;
      if (existingKeys.has(dbKey)) {
        skippedDup++;
        continue;
      }

      // Within-file dedup: skip 余學然 Q2 duplicate (same person, same quarter, same amount, same date)
      // But allow 陳雪瑩 Q4 double (sequential #12/#13, import both)
      const withinFileKey = `${studentId}_${qInfo.quarter}_${perPerson}_${payDate}`;
      
      // Special handling: 陳雪瑩 Q4 lines 82-83 should BOTH be imported
      // (her備註 says 疑重複記錄或分屬兩期 - we import both, let admin verify)
      const isChanSnowQ4 = (name === '陳雪瑩' && qInfo.quarter === 'Q4');
      
      if (!isChanSnowQ4 && insertedKeys.has(withinFileKey)) {
        skippedWithinFileDup++;
        continue;
      }

      try {
        await conn.execute(
          `INSERT INTO paymentRecords (studentId, year, paymentPeriod, paymentMonth, amount, paymentDate, status, confirmedBy, bank, receivingBank, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 'admin_approved', ?, ?, ?)`,
          [studentId, qInfo.year, qInfo.quarter, paymentMonth, perPerson, payDate, bank, RECEIVING_BANK, dbNotes]
        );
        inserted++;
        insertedKeys.add(withinFileKey);
      } catch (err) {
        errors.push(`行 ${i+1}: ${name} - ${err.message}`);
      }
    }
  }

  console.log('=== 🎉 鄺富華教練 2025 全年繳費導入完成 ===');
  console.log(`✅ 成功寫入: ${inserted} 筆`);
  console.log(`⏭️ 跳過(DB重複): ${skippedDup} 筆`);
  console.log(`⏭️ 跳過(檔案內重複): ${skippedWithinFileDup} 筆`);
  console.log(`⏭️ 跳過(非學費/搏擊班): ${skippedNonTuition} 筆`);
  
  if (errors.length > 0) {
    console.log(`\n❌ 錯誤: ${errors.length} 筆`);
    for (const e of errors) console.log(`  - ${e}`);
  }

  // Verify totals
  const [verify] = await conn.execute(
    `SELECT paymentPeriod, COUNT(*) as cnt, SUM(amount) as total 
     FROM paymentRecords 
     WHERE studentId IN (${studentIds.join(',')})
     AND year = 2025
     GROUP BY paymentPeriod ORDER BY paymentPeriod`
  );
  console.log('\n=== 📊 2025 年度驗證 (鄺富華教練) ===');
  let grandTotal = 0;
  for (const row of verify) {
    console.log(`  ${row.paymentPeriod}: ${row.cnt} 筆, 合計 $${Number(row.total).toLocaleString()}`);
    grandTotal += Number(row.total);
  }
  console.log(`  ─────────────────────`);
  console.log(`  全年合計: $${grandTotal.toLocaleString()}`);

  // Verify new students have records
  console.log('\n=== 📋 新增學生記錄驗證 ===');
  const newIds = [319, 320, 321, 322, 323, 324, 325, 326];
  const [newStudentRecords] = await conn.execute(
    `SELECT s.name, COUNT(*) as cnt, SUM(p.amount) as total
     FROM paymentRecords p JOIN students s ON p.studentId = s.id
     WHERE p.studentId IN (${newIds.join(',')})
     GROUP BY s.name`
  );
  for (const r of newStudentRecords) {
    console.log(`  ${r.name}: ${r.cnt} 筆, 合計 $${Number(r.total).toLocaleString()}`);
  }

  await conn.end();
}

main().catch(console.error);
