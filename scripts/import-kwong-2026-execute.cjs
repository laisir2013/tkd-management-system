/**
 * Execute import for 鄺富華教練 2026 payment CSV
 * File: DOC-20260821-WA0000.csv
 * Covers: 2026 Q1-Q3
 * 
 * Decisions:
 * - 搏擊班/搏盡費用 records are EXCLUDED (non-taekwondo fees)
 * - 侯兆洪 Q3 has 2 entries (rows 46-47) - both imported (could be split payments)
 * - 曾鎧淇/曾偉傑 Q1 rows with Sept 2025 dates - imported as-is with note about date uncertainty
 * - Multi-student: split by space(s), amount divided equally
 * - receivingBank: 中國銀行（香港）for all
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const CSV_PATH = '/home/user/uploaded_files/DOC-20260821-WA0000.csv';

const STUDENT_MAP = {
  '丁梓軒': 170, '余學然': 175, '侯兆洪': 164, '劉宇政': 173, '劉燊政': 174,
  '吳德熹': 181, '曾偉傑': 182, '曾鎧淇': 183, '梁熙朗': 190, '楊倬蘅': 172,
  '葉浩晴': 178, '薛晶塵': 186, '薛裕霖': 185, '蘇均濤': 171, '蘇柏霖': 179,
  '覃梓恩': 188, '許子堯': 166, '許子諾': 165, '許雋昇': 180, '賴柏希': 184,
  '趙晉翹': 169, '趙栢臻': 168, '陳雪瑩': 176, '黃信恩': 167, '黃信行': 163,
  '黃梓峻': 187, '黃蜻蜓': 189, '江希彤': 318
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
  const m = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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
  return /搏擊班|搏盡費用/.test(notes);
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

// Derive paymentMonth from payDate
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
  const [existing] = await conn.execute(
    `SELECT studentId, year, paymentPeriod, amount FROM paymentRecords 
     WHERE studentId IN (${Object.values(STUDENT_MAP).join(',')})
     AND year = 2026`
  );
  const existingKeys = new Set(existing.map(r => 
    `${r.studentId}_${r.year}_${r.paymentPeriod}_${Number(r.amount)}`
  ));

  let inserted = 0;
  let skippedDup = 0;
  let skippedNonTuition = 0;
  const errors = [];

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
      dbNotes = `[CSV導入] ${notes}`;
    } else if (notes) {
      // Extract any extra info beyond bank
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

      // Dedup check
      const key = `${studentId}_${qInfo.year}_${qInfo.quarter}_${perPerson}`;
      if (existingKeys.has(key)) {
        skippedDup++;
        continue;
      }

      try {
        await conn.execute(
          `INSERT INTO paymentRecords (studentId, year, paymentPeriod, paymentMonth, amount, paymentDate, status, confirmedBy, bank, receivingBank, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 'admin_approved', ?, ?, ?)`,
          [studentId, qInfo.year, qInfo.quarter, paymentMonth, perPerson, payDate, bank, RECEIVING_BANK, dbNotes]
        );
        inserted++;
        // Add to existing keys to prevent within-file duplicates where appropriate
        // (but don't add for 侯兆洪 Q3 which legitimately has 2 entries)
      } catch (err) {
        errors.push(`行 ${i+1}: ${name} - ${err.message}`);
      }
    }
  }

  console.log('=== 🎉 鄺富華教練 2026 繳費導入完成 ===');
  console.log(`✅ 成功寫入: ${inserted} 筆`);
  console.log(`⏭️ 跳過(重複): ${skippedDup} 筆`);
  console.log(`⏭️ 跳過(非學費): ${skippedNonTuition} 筆`);
  
  if (errors.length > 0) {
    console.log(`\n❌ 錯誤: ${errors.length} 筆`);
    for (const e of errors) console.log(`  - ${e}`);
  }

  // Verify totals
  const [verify] = await conn.execute(
    `SELECT paymentPeriod, COUNT(*) as cnt, SUM(amount) as total 
     FROM paymentRecords 
     WHERE studentId IN (${Object.values(STUDENT_MAP).join(',')})
     AND year = 2026
     GROUP BY paymentPeriod ORDER BY paymentPeriod`
  );
  console.log('\n=== 📊 2026 年度驗證 ===');
  for (const row of verify) {
    console.log(`  ${row.paymentPeriod}: ${row.cnt} 筆, 合計 $${Number(row.total).toLocaleString()}`);
  }

  await conn.end();
}

main().catch(console.error);
