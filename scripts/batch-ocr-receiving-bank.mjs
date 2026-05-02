#!/usr/bin/env node
/**
 * 批量 OCR 掃描收據圖片，識別收款銀行 (receivingBank)
 * 使用 detail:low 減少 token 用量，加大延遲避免 429
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'receipts');

// ── Config ──
const DB_URL = process.env.DATABASE_URL || 'mysql://tkd_user:tkd_pass_2026@localhost:3306/taekwondo';
const API_BASE = process.env.OPENAI_BASE_URL || 'https://vectorengine.ai/v1';
const API_KEYS = [
  process.env.OPENAI_API_KEY,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3,
].filter(Boolean);

let keyIndex = 0;
function getNextKey() {
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Resize image to reduce size (use sharp-free approach: just cap base64 length) ──
function prepareImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { base64: buf.toString('base64'), mimeType };
}

// ── LLM OCR Call with robust retry ──
async function ocrReceiptImage(base64, mimeType) {
  const systemPrompt = `你是銀行收據識別專家。從銀行轉帳收據截圖中提取以下資訊，回傳純JSON（不加markdown）:
{"bank":"付款方銀行","receivingBank":"收款方銀行","amount":"金額"}

規則：
- bank = 付款方/轉出方銀行（截圖來自哪個銀行App）
- receivingBank = 收款方銀行（錢入了哪間銀行）
- 根據收款帳號前3位判斷：012=中銀, 004=滙豐, 024=恒生, 003=渣打
- FPS/轉數快 轉帳 → receivingBank 填「中銀香港」
- 無法判斷時填 null
- 只回傳JSON，不要其他文字`;

  const MAX_ATTEMPTS = 6;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const apiKey = getNextKey();
    try {
      const resp = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          max_tokens: 256,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: '識別收據的付款銀行和收款銀行:' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
        }),
      });

      if (resp.status === 429 || resp.status === 503) {
        const waitSec = Math.min(5 + attempt * 5, 30);
        console.log(`  ⏳ ${resp.status} - 等待 ${waitSec}s (attempt ${attempt + 1})...`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.log(`  ⚠️ HTTP ${resp.status}: ${errText.slice(0, 150)}`);
        await sleep(5000);
        continue;
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        console.log(`  ⚠️ 空回應，重試...`);
        await sleep(5000);
        continue;
      }

      // Clean markdown fences and parse
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      // Try to extract JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`  ⚠️ 非JSON回應: ${cleaned.slice(0, 100)}`);
        await sleep(3000);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (err) {
      console.log(`  ⚠️ Attempt ${attempt + 1}: ${err.message}`);
      await sleep(5000);
    }
  }
  return null;
}

// ── Normalize bank name ──
function normalizeBankName(raw) {
  if (!raw || raw === 'null' || raw === 'NULL' || raw === 'N/A' || raw === '未知') return null;
  const s = raw.toLowerCase().trim();

  if (s.includes('fps') || s.includes('轉數快')) return 'FPS轉數快';
  if (s.includes('boc') || s.includes('中銀') || s.includes('中國銀行') || s.includes('bank of china')) return '中銀香港 (BOC)';
  if (s.includes('hsbc') || s.includes('滙豐') || s.includes('匯豐')) return '滙豐銀行 (HSBC)';
  if (s.includes('hang seng') || s.includes('恒生') || s.includes('恆生')) return '恒生銀行';
  if (s.includes('scb') || s.includes('渣打') || s.includes('standard chartered')) return '渣打銀行 (SCB)';
  if (s.includes('dbs') || s.includes('星展')) return '星展銀行 (DBS)';
  if (s.includes('citi') || s.includes('花旗')) return '花旗銀行';
  if (s.includes('za bank') || s.includes('za ')) return 'ZA Bank';
  if (s.includes('payme')) return 'PayMe';
  if (s.includes('現金') || s.includes('cash')) return '現金';

  return raw.trim();
}

function normalizeReceivingBank(raw) {
  if (!raw || raw === 'null' || raw === 'NULL' || raw === 'N/A' || raw === '未知') return null;
  const s = raw.toLowerCase().trim();

  // FPS → BOC (道館收款帳戶在中銀)
  if (s.includes('fps') || s.includes('轉數快')) return '中銀香港 (BOC)';
  if (s.includes('boc') || s.includes('中銀') || s.includes('中國銀行') || s.includes('bank of china')) return '中銀香港 (BOC)';
  if (s.includes('hsbc') || s.includes('滙豐') || s.includes('匯豐')) return '滙豐銀行 (HSBC)';
  if (s.includes('hang seng') || s.includes('恒生') || s.includes('恆生')) return '恒生銀行';
  if (s.includes('scb') || s.includes('渣打') || s.includes('standard chartered')) return '渣打銀行 (SCB)';

  return raw.trim();
}

// ── Main ──
async function main() {
  console.log('🏦 批量 OCR 收款銀行識別 v2');
  console.log('============================\n');
  console.log(`API Keys: ${API_KEYS.length} 個`);
  console.log(`API Base: ${API_BASE}\n`);

  const dbUrl = new URL(DB_URL);
  const conn = await mysql.createConnection({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
  });

  const [rows] = await conn.execute(
    `SELECT id, receiptUrl, receiptKey, bank 
     FROM paymentRecords 
     WHERE (receivingBank IS NULL OR receivingBank = '') 
       AND receiptUrl IS NOT NULL AND receiptUrl != '' 
     ORDER BY id`
  );

  console.log(`📋 找到 ${rows.length} 筆需要 OCR 的記錄\n`);

  if (rows.length === 0) {
    console.log('✅ 全部完成');
    await conn.end();
    return;
  }

  const results = { success: 0, failed: 0, skipped: 0 };
  // Cache: same receipt file → same result
  const cache = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { id, receiptKey, bank } = row;
    const filename = receiptKey ? path.basename(receiptKey) : null;

    console.log(`[${i + 1}/${rows.length}] 記錄 #${id}`);
    console.log(`  檔案: ${filename || '(無)'}`);
    console.log(`  付款銀行: ${bank || '(無)'}`);

    if (!filename) {
      console.log('  ⏭️ 跳過 (無檔案)\n');
      results.skipped++;
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⏭️ 跳過 (檔案不存在)\n`);
      results.skipped++;
      continue;
    }

    let ocrResult;

    // Check cache for same file
    if (cache.has(filename)) {
      ocrResult = cache.get(filename);
      console.log(`  ♻️ 重用快取結果`);
    } else {
      const { base64, mimeType } = prepareImage(filePath);
      console.log(`  🔍 OCR 中... (${(base64.length / 1024).toFixed(0)} KB base64)`);
      
      ocrResult = await ocrReceiptImage(base64, mimeType);
      cache.set(filename, ocrResult);

      // Delay between different images to avoid rate limit
      if (i < rows.length - 1) {
        const nextFile = rows[i + 1]?.receiptKey ? path.basename(rows[i + 1].receiptKey) : null;
        if (nextFile !== filename) {
          console.log(`  ⏳ 等待 8s 避免限速...`);
          await sleep(8000);
        }
      }
    }

    if (!ocrResult) {
      console.log('  ❌ OCR 失敗\n');
      results.failed++;
      continue;
    }

    console.log(`  📄 原始: bank=${ocrResult.bank}, receivingBank=${ocrResult.receivingBank}`);

    let receivingBank = normalizeReceivingBank(ocrResult.receivingBank);
    let payerBank = normalizeBankName(ocrResult.bank);

    // FPS fallback
    if (!receivingBank && payerBank === 'FPS轉數快') {
      receivingBank = '中銀香港 (BOC)';
    }
    // If payer bank is detected as BOC but original says FPS
    if (!receivingBank && ocrResult.bank && 
        (ocrResult.bank.toLowerCase().includes('fps') || ocrResult.bank.includes('轉數快'))) {
      receivingBank = '中銀香港 (BOC)';
    }

    console.log(`  ✅ 標準化: receivingBank=${receivingBank}, bank=${payerBank}`);

    // Update paymentRecords
    const updates = [];
    const vals = [];

    if (receivingBank) {
      updates.push('receivingBank = ?');
      vals.push(receivingBank);
    }
    if (!bank && payerBank) {
      updates.push('bank = ?');
      vals.push(payerBank);
    }

    if (updates.length > 0) {
      vals.push(id);
      await conn.execute(`UPDATE paymentRecords SET ${updates.join(', ')} WHERE id = ?`, vals);
      console.log(`  💾 paymentRecords #${id} 已更新`);
    }

    // Update accounting_records
    if (receivingBank) {
      const [accRows] = await conn.execute(
        `SELECT id, receiving_bank FROM accounting_records WHERE paymentRecordId = ?`, [id]
      );
      for (const acc of accRows) {
        if (!acc.receiving_bank) {
          await conn.execute(
            `UPDATE accounting_records SET receiving_bank = ? WHERE id = ?`,
            [receivingBank, acc.id]
          );
          console.log(`  💾 accounting_records #${acc.id} 已更新`);
        }
      }
    }

    results.success++;
    console.log('');
  }

  // Summary
  console.log('============================');
  console.log('📊 結果摘要');
  console.log(`  ✅ 成功: ${results.success}`);
  console.log(`  ❌ 失敗: ${results.failed}`);
  console.log(`  ⏭️ 跳過: ${results.skipped}`);

  const [final] = await conn.execute(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN receivingBank IS NOT NULL AND receivingBank != '' THEN 1 ELSE 0 END) as has_rb,
       SUM(CASE WHEN receivingBank IS NULL OR receivingBank = '' THEN 1 ELSE 0 END) as no_rb,
       SUM(CASE WHEN bank IS NOT NULL AND bank != '' THEN 1 ELSE 0 END) as has_bank
     FROM paymentRecords`
  );
  console.log(`\n📈 最終狀態:`);
  console.log(`  總記錄: ${final[0].total}`);
  console.log(`  有 receivingBank: ${final[0].has_rb}`);
  console.log(`  缺 receivingBank: ${final[0].no_rb}`);
  console.log(`  有 bank: ${final[0].has_bank}`);

  await conn.end();
  console.log('\n✅ 完成！');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
