/**
 * 本地 OCR 模組 - 使用 Tesseract OCR 識別收據
 * 不需要外部 API Key，完全離線運行
 */
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

interface OcrResult {
  amount: string | null;
  bank: string | null;
  status: string | null;
  date: string | null;
  time: string | null;
  rawText: string;
}

/**
 * 使用 Tesseract OCR 從圖片提取文字
 */
function runTesseract(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "tesseract",
      [imagePath, "stdout", "-l", "chi_tra+eng", "--psm", "6"],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Tesseract failed: ${error.message}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

/**
 * 從 OCR 文字中解析金額
 */
function extractAmount(text: string): string | null {
  // 匹配常見的金額模式
  const patterns = [
    // 港元1800.00 / 港元 1,800.00
    /港元\s*([\d,]+\.?\d*)/,
    // HKD 1800.00 / 1,800.00 HKD
    /([\d,]+\.?\d*)\s*HKD/i,
    /HKD\s*([\d,]+\.?\d*)/i,
    // HK$ 1800.00
    /HK\$\s*([\d,]+\.?\d*)/i,
    // 金額 2,400.00 / 金額: 1800.00
    /金額\s*[:：]?\s*([\d,]+\.?\d*)/,
    // 轉賬金額 港元1800.00
    /轉賬金額\s*[:：]?\s*(?:港元)?\s*([\d,]+\.?\d*)/,
    // $ 1,800.00 (generic dollar)
    /\$\s*([\d,]+\.?\d*)/,
    // Amount: 1800.00
    /[Aa]mount\s*[:：]?\s*(?:HK\$|HKD|港元)?\s*([\d,]+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) {
        return num.toString();
      }
    }
  }
  return null;
}

/**
 * 從 OCR 文字中解析銀行名稱
 */
function extractBank(text: string): string | null {
  // 1. 直接名稱匹配
  const bankPatterns: [RegExp, string][] = [
    [/BANK OF CHINA|中國銀行|中银|中銀|BOC(?:HK)?/i, "中銀香港"],
    [/HSBC|匯豐|汇丰|灌豐|滙豐/i, "匯豐銀行"],
    [/HANG SENG|恒生|恆生/i, "恒生銀行"],
    [/STANDARD CHARTERED|渣打/i, "渣打銀行"],
    [/DBS|星展/i, "星展銀行"],
    [/CITIBANK|花旗/i, "花旗銀行"],
    [/PayMe/i, "PayMe"],
    [/FPS|轉數快|快速支付/i, "FPS轉數快"],
    [/WeChat Pay|微信支付/i, "微信支付"],
    [/AliPay|支付寶/i, "支付寶"],
    [/BEA|東亞銀行/i, "東亞銀行"],
    [/CITIC|中信/i, "中信銀行"],
    [/工商銀行|ICBC/i, "工商銀行"],
    [/建設銀行|CCB/i, "建設銀行"],
    [/交通銀行|BOCOM/i, "交通銀行"],
    [/招商銀行|CMB/i, "招商銀行"],
    [/大新銀行|Dah Sing/i, "大新銀行"],
    [/創興銀行|Chong Hing/i, "創興銀行"],
    [/南洋商業|Nanyang/i, "南洋商業銀行"],
    [/集友銀行|Chiyu/i, "集友銀行"],
    [/上海商業|SHACOM/i, "上海商業銀行"],
  ];

  for (const [pattern, name] of bankPatterns) {
    if (pattern.test(text)) {
      return name;
    }
  }

  // 2. 香港銀行分行編號匹配（帳號前3位）
  const branchCodePatterns: [RegExp, string][] = [
    [/\b003[\-\*\d]{3,}/,  "渣打銀行"],
    [/\b004[\-\*\d]{3,}/,  "匯豐銀行"],
    [/\b009[\-\*\d]{3,}/,  "中信銀行"],
    [/\b012[\-\*\d]{3,}/,  "中銀香港"],
    [/\b015[\-\*\d]{3,}/,  "東亞銀行"],
    [/\b016[\-\*\d]{3,}/,  "星展銀行"],
    [/\b024[\-\*\d]{3,}/,  "恒生銀行"],
    [/\b025[\-\*\d]{3,}/,  "上海商業銀行"],
    [/\b027[\-\*\d]{3,}/,  "招商永隆銀行"],
    [/\b028[\-\*\d]{3,}/,  "大新銀行"],
    [/\b035[\-\*\d]{3,}/,  "工銀亞洲"],
    [/\b038[\-\*\d]{3,}/,  "大眾銀行"],
    [/\b039[\-\*\d]{3,}/,  "花旗銀行"],
    [/\b040[\-\*\d]{3,}/,  "大新銀行"],
    [/\b041[\-\*\d]{3,}/,  "集友銀行"],
    [/\b043[\-\*\d]{3,}/,  "南洋商業銀行"],
  ];

  for (const [pattern, name] of branchCodePatterns) {
    if (pattern.test(text)) {
      return name;
    }
  }

  // 3. 「即時轉賬/即時轉帳」通常是 FPS
  if (/即時轉[賬帳]/.test(text) && !/FPS|轉數快/.test(text)) {
    return "FPS轉數快";
  }

  return null;
}

/**
 * 從 OCR 文字中解析交易狀態
 */
function extractStatus(text: string): string | null {
  const successPatterns = [
    /成功/,
    /已完成/,
    /completed/i,
    /successful/i,
    /已發送/,
    /款項已成功/,
    /即時轉賬/,
    /即時轉帳/,
  ];
  const pendingPatterns = [/處理中/, /pending/i, /processing/i];
  const failPatterns = [/失敗/, /failed/i, /rejected/i, /拒絕/];

  for (const p of successPatterns) {
    if (p.test(text)) return "成功";
  }
  for (const p of pendingPatterns) {
    if (p.test(text)) return "處理中";
  }
  for (const p of failPatterns) {
    if (p.test(text)) return "失敗";
  }
  return null;
}

/**
 * 從 OCR 文字中解析日期
 */
function extractDate(text: string): string | null {
  const patterns = [
    // 2026/02/26 or 2026-02-26
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // 2026年02月26日 or 2026年2月26日
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    // 26/02/2026 (DD/MM/YYYY)
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year: string, month: string, day: string;
      if (match[1].length === 4) {
        year = match[1];
        month = match[2].padStart(2, "0");
        day = match[3].padStart(2, "0");
      } else {
        // DD/MM/YYYY format
        day = match[1].padStart(2, "0");
        month = match[2].padStart(2, "0");
        year = match[3];
      }
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

/**
 * 從 OCR 文字中解析時間
 */
function extractTime(text: string): string | null {
  const patterns = [
    // 18:02 or 18:02:30
    /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:香港時間)?/,
    // 下午 6:02 / 上午 10:30
    /([上下]午)\s*(\d{1,2}):(\d{2})/,
  ];

  const match1 = text.match(patterns[0]);
  if (match1) {
    const h = match1[1].padStart(2, "0");
    const m = match1[2];
    const s = match1[3] || "00";
    return `${h}:${m}:${s}`;
  }

  const match2 = text.match(patterns[1]);
  if (match2) {
    let h = parseInt(match2[2]);
    if (match2[1] === "下午" && h < 12) h += 12;
    if (match2[1] === "上午" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${match2[3]}:00`;
  }

  return null;
}

/**
 * 主函數：從 base64 圖片進行 OCR 識別收據
 */
export async function ocrReceipt(
  base64Data: string,
  mimeType: string
): Promise<OcrResult> {
  // 寫入臨時文件
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const tmpPath = join(
    tmpdir(),
    `ocr_${randomBytes(8).toString("hex")}.${ext}`
  );

  try {
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(tmpPath, buffer);

    // 執行 Tesseract OCR
    const rawText = await runTesseract(tmpPath);
    console.log("[Local OCR] Raw text:", rawText.substring(0, 300));

    // 解析結果
    const result: OcrResult = {
      amount: extractAmount(rawText),
      bank: extractBank(rawText),
      status: extractStatus(rawText),
      date: extractDate(rawText),
      time: extractTime(rawText),
      rawText,
    };

    console.log("[Local OCR] Parsed result:", {
      amount: result.amount,
      bank: result.bank,
      status: result.status,
      date: result.date,
      time: result.time,
    });

    return result;
  } finally {
    // 清理臨時文件
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
  }
}
