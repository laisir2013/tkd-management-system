/**
 * 批量修復歷史繳費記錄的 receivingBank（收款銀行）
 * 讀取有收據但沒有 receivingBank 的記錄，用 LLM OCR 重新辨識
 */
import { storageGetBuffer } from "./server/storage";
import { invokeLLM } from "./server/_core/llm";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL || "mysql://tkd_user:tkd_pass_2026@localhost:3306/taekwondo";

async function main() {
  const url = new URL(DB_URL);
  const pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    charset: "utf8mb4",
  });

  // 1. 找出有收據但沒 receivingBank 的記錄
  const [rows] = await pool.execute(
    `SELECT id, studentId, bank, receiptUrl, receiptKey, amount, paymentDate 
     FROM paymentRecords 
     WHERE (receivingBank IS NULL OR receivingBank = '') 
       AND receiptUrl IS NOT NULL AND receiptUrl != ''
     ORDER BY id`
  ) as any;

  console.log(`\n=== 批量修復 receivingBank ===`);
  console.log(`找到 ${rows.length} 筆有收據但缺 receivingBank 的記錄\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const { id, studentId, bank, receiptUrl, receiptKey, amount } = row;
    console.log(`[${id}] 學生=${studentId}, 金額=$${amount}, 付款銀行=${bank || '未知'}`);

    // 從 receiptUrl 或 receiptKey 取得實際的 storage key
    let storageKey = receiptKey;
    if (!storageKey && receiptUrl) {
      // receiptUrl 格式: /api/receipts/receipts/xxx.jpeg → key = receipts/xxx.jpeg
      storageKey = receiptUrl.replace(/^\/api\/receipts\//, '');
    }
    if (!storageKey) {
      console.log(`  ⏭️ 無法取得收據 key，跳過`);
      skipped++;
      continue;
    }

    try {
      // 讀取收據圖片
      const { data, contentType } = await storageGetBuffer(storageKey);
      const b64 = data.toString("base64");
      const mime = contentType || "image/jpeg";

      console.log(`  📷 收據大小: ${(data.length / 1024).toFixed(0)}KB, 類型: ${mime}`);

      // 用 LLM OCR 辨識
      const ocrResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `從銀行轉帳收據/截圖提取JSON（不要加markdown標記）：
{"receivingBank":"收款方銀行名稱","bank":"付款方銀行名稱"}
重點：
1. receivingBank = 收款方的銀行。根據收款帳號前3位判斷：012=中銀BOC, 004=HSBC滙豐, 024=恒生, 003=渣打。
2. 如果是FPS/轉數快轉帳，receivingBank填「中銀香港」。
3. bank = 付款方/轉出方使用的銀行。如果截圖來自某銀行App，bank就是該銀行。
只回傳JSON，不要其他文字。`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "請識別這張收據的收款銀行和付款銀行:" },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } }
            ]
          }
        ]
      });

      const content = ocrResponse.choices[0]?.message?.content;
      if (typeof content !== "string") {
        console.log(`  ❌ LLM 無回應`);
        failed++;
        continue;
      }

      const cleanJson = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const parsed = JSON.parse(cleanJson);
      console.log(`  🔍 OCR結果: ${JSON.stringify(parsed)}`);

      let receivingBank = parsed.receivingBank || null;
      let ocrBank = parsed.bank || null;

      // FPS fallback
      if (!receivingBank && ocrBank) {
        const upper = ocrBank.toUpperCase();
        if (upper.includes("FPS") || upper.includes("轉數快") || upper.includes("FASTER PAYMENT")) {
          receivingBank = "中銀香港 (BOC)";
        }
      }

      // 標準化銀行名稱
      if (receivingBank) {
        const upper = receivingBank.toUpperCase();
        if (upper.includes("中銀") || upper.includes("BOC") || upper.includes("中國銀行") || upper.includes("012")) {
          receivingBank = "中銀香港 (BOC)";
        } else if (upper.includes("滙豐") || upper.includes("匯豐") || upper.includes("HSBC") || upper.includes("004")) {
          receivingBank = "滙豐銀行 (HSBC)";
        } else if (upper.includes("恒生") || upper.includes("HANG SENG") || upper.includes("024")) {
          receivingBank = "恒生銀行";
        } else if (upper.includes("渣打") || upper.includes("SCB") || upper.includes("STANDARD") || upper.includes("003")) {
          receivingBank = "渣打銀行 (SCB)";
        }
      }

      if (receivingBank) {
        // 更新 paymentRecords
        await pool.execute(
          "UPDATE paymentRecords SET receivingBank = ? WHERE id = ?",
          [receivingBank, id]
        );
        // 同時補 bank（如果原本沒有）
        if (!bank && ocrBank) {
          await pool.execute(
            "UPDATE paymentRecords SET bank = ? WHERE id = ? AND (bank IS NULL OR bank = '')",
            [ocrBank, id]
          );
        }
        // 同時更新 accounting_records
        await pool.execute(
          "UPDATE accounting_records SET receiving_bank = ? WHERE payment_record_id = ? AND (receiving_bank IS NULL OR receiving_bank = '')",
          [receivingBank, id]
        );
        console.log(`  ✅ 收款銀行: ${receivingBank}${ocrBank ? `, 付款銀行: ${ocrBank}` : ''}`);
        updated++;
      } else {
        console.log(`  ⚠️ 無法辨識收款銀行`);
        failed++;
      }

      // 避免 rate limit，每次間隔 1.5 秒
      await new Promise(r => setTimeout(r, 1500));

    } catch (err: any) {
      console.log(`  ❌ 錯誤: ${err.message}`);
      failed++;
      // rate limit → 等久一點
      if (err.message?.includes("429") || err.message?.includes("rate")) {
        console.log(`  ⏳ Rate limit，等待 5 秒...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`✅ 成功更新: ${updated}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`⏭️ 跳過: ${skipped}`);
  console.log(`📊 剩餘未標記: ${rows.length - updated - skipped}`);

  // 最後顯示統計
  const [stats] = await pool.execute(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN receivingBank IS NOT NULL AND receivingBank != '' THEN 1 ELSE 0 END) as has_receiving,
       SUM(CASE WHEN receivingBank IS NULL OR receivingBank = '' THEN 1 ELSE 0 END) as missing
     FROM paymentRecords`
  ) as any;
  console.log(`\n📊 最終統計: 共 ${stats[0].total} 筆, 有收款銀行 ${stats[0].has_receiving} 筆, 缺少 ${stats[0].missing} 筆`);

  await pool.end();
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
