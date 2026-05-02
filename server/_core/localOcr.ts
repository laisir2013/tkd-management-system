/**
 * 本地 OCR 模組 - 使用 Tesseract OCR 識別收據
 * 不需要外部 API Key，完全離線運行
 * 包含 ImageMagick 圖片預處理以提高識別率
 */
import { execFile, exec } from "child_process";
import { writeFile, unlink, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promisify } from "util";

const execAsync = promisify(exec);

interface OcrResult {
  amount: string | null;
  bank: string | null;
  receivingBank: string | null; // 收款方銀行（入數到哪間銀行，用於對帳）
  status: string | null;
  date: string | null;
  time: string | null;
  recipientName: string | null;
  recipientAccount: string | null;
  rawText: string;
}

/**
 * 使用 ImageMagick 預處理圖片以提高 OCR 識別率
 * - 轉灰階
 * - 增強對比度
 * - 放大至合適大小（Tesseract 在 300 DPI 左右最佳）
 * - 去噪 / 銳化
 */
async function preprocessImage(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.\w+$/, '_preprocessed.png');
  try {
    // 1. Resize to ensure minimum width for OCR (Tesseract works best at ~300 DPI)
    // 2. Convert to grayscale
    // 3. Enhance contrast
    // 4. Sharpen
    // 5. Apply threshold to get clean black/white text
    await execAsync(
      `convert "${inputPath}" -resize "2000x>" -colorspace Gray -contrast-stretch 3%x3% -sharpen 0x1 -unsharp 0x1+1+0 "${outputPath}"`,
      { timeout: 15000 }
    );
    return outputPath;
  } catch (e) {
    console.warn("[Local OCR] ImageMagick preprocessing failed, using original:", e instanceof Error ? e.message : String(e));
    return inputPath; // Fallback to original
  }
}

/**
 * 使用高對比度二值化預處理（針對淺色背景上的深色文字）
 */
async function preprocessImageHighContrast(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.\w+$/, '_hc.png');
  try {
    await execAsync(
      `convert "${inputPath}" -resize "2400x>" -colorspace Gray -brightness-contrast 10x40 -threshold 65% -negate -threshold 50% -negate "${outputPath}"`,
      { timeout: 15000 }
    );
    return outputPath;
  } catch (e) {
    return inputPath;
  }
}

/**
 * 使用 Tesseract OCR 從圖片提取文字
 * @param psm - Page Segmentation Mode:
 *   3 = Fully automatic (default Tesseract)
 *   4 = Assume single column of text (best for bank receipts with table layout)
 *   6 = Assume single uniform block of text (fast but misses multi-column)
 */
function runTesseract(imagePath: string, psm: string = "4"): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "tesseract",
      [imagePath, "stdout", "-l", "chi_tra+eng", "--psm", psm,
       // Tesseract config for better receipt recognition
       "--oem", "3",  // LSTM + Legacy engine
      ],
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
  // 先嘗試精確匹配「金額」行的完整金額（處理 OCR 誤讀「港幣」為亂碼的情況）
  // 例如：「金額  348 1,800.00」→ 取最後一個數字 1800.00
  const amountLineMatch = text.match(/金額[^\n]*?([\d,]+\.\d{2})/);
  if (amountLineMatch) {
    const cleaned = amountLineMatch[1].replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      return num.toString();
    }
  }

  // 匹配常見的金額模式
  const patterns = [
    // 交易金額 - HKD 1,440.00 (ZA Bank 格式，帶負號表示扣款)
    /交易金額\s*[-−]?\s*HKD\s*([\d,]+\.\d{2})/i,
    // 港元1800.00 / 港元 1,800.00
    /港元\s*([\d,]+\.?\d*)/,
    // 港幣 1,800.00
    /港幣\s*([\d,]+\.?\d*)/,
    // HKD 1800.00 / 1,800.00 HKD (HSBC format: "5,400.00 HKD")
    /([\d,]+\.\d{2})\s*HKD/i,
    /HKD\s*([\d,]+\.?\d*)/i,
    // HK$ 1800.00
    /HK\$\s*([\d,]+\.?\d*)/i,
    // 轉賬金額 港元1800.00
    /轉賬金額\s*[:：]?\s*(?:港元|港幣)?\s*([\d,]+\.?\d*)/,
    // $ 1,800.00 (generic dollar) - only match with decimal to avoid false positives
    /\$\s*([\d,]+\.\d{2})/,
    // Amount: 1800.00 / Amount  5,400.00 HKD (HSBC English format)
    /[Aa]mount\s+(?:HK\$|HKD|港元|港幣)?\s*([\d,]+\.\d{2})/,
    /[Aa]mount\s*[:：]?\s*(?:HK\$|HKD|港元|港幣)?\s*([\d,]+\.?\d*)/,
    // "Total" / "Total amount" patterns
    /[Tt]otal\s*(?:[Aa]mount)?\s*[:：]?\s*(?:HK\$|HKD)?\s*([\d,]+\.\d{2})/,
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
    [/ZA\s*Bank/i, "ZA Bank"],
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
 * 從 OCR 文字中提取收款人資訊（名稱和帳號）
 * 收據上通常顯示為：
 *   收款人/賬戶             CHONG MO COMPANY
 *   LIMITED
 *   164577132
 * 或：
 *   Payee       John Smith
 *   To Account  012-XXX-XXX
 *
 * 注意：OCR 文字可能含有「款項已成功發送給收款人」這類干擾文字
 */
function extractRecipient(text: string): { name: string | null; account: string | null } {
  let name: string | null = null;
  let account: string | null = null;

  // 按行分割，找出「收款人/賬戶」這行及其後續行
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 優先提取 FPS 識別碼（各種格式）
  // 必須在一般帳號搜索之前執行，避免誤取付款方帳號
  const proxyPatterns = [
    /收款方識別代碼\s+(\d{5,})/,
    /快速支付系統識別碼\s*[:：]?\s*(\d{5,})/,
    /Payee\s*proxy\s*ID\s+(\d{5,})/i,
    /FPS\s*(?:ID|識別碼|編號)\s*[:：.。]?\s*(\d{5,})/i,
    /轉數快\s*(?:ID|識別碼|編號)\s*[:：]?\s*(\d{5,})/,
    // HSBC format: "FPS ID: 164577132" or "FPS ID. 164577132"
    /FPS\s+ID\s*[:：.。]?\s*(\d{5,})/i,
    // Loose pattern: just "164577132" near "FPS"
    /FPS[^\d]{0,20}(\d{6,12})/i,
  ];
  for (const pattern of proxyPatterns) {
    const match = text.match(pattern);
    if (match) {
      account = match[1];
      break;
    }
  }

  let recipientLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 精確匹配「收款人/賬戶」或「收款人」或「收款戶口」或「受款人」作為行開頭
    if (/^[收受]款人[/\/]?[賬帳]?[戶户]?\s/.test(line) || /^[收受]款人[/\/]/.test(line) || /^收款戶口\s/.test(line)) {
      recipientLineIdx = i;
      break;
    }
    // ZA Bank 格式：「收款方名稱」
    if (/^收款方名稱\s/.test(line)) {
      recipientLineIdx = i;
      break;
    }
    // 英文模式
    if (/^(?:Payee|Recipient|Beneficiary)\s/i.test(line)) {
      recipientLineIdx = i;
      break;
    }
    // 恒生/HSBC 英文格式："To" + 空格 + 收款人名稱
    if (/^To\s{2,}/i.test(line)) {
      recipientLineIdx = i;
      break;
    }
    // HSBC format: "To" on its own line or "To   CHONG MO..."
    if (/^To\s+[A-Z]/i.test(line) && !/^To\s+(account|bank)/i.test(line)) {
      recipientLineIdx = i;
      break;
    }
  }

  if (recipientLineIdx >= 0) {
    // 從「收款人/賬戶」行提取名稱（行內名稱部分）
    const recipientLine = lines[recipientLineIdx];
    const nameMatch = recipientLine.match(/(?:[收受]款人[/\/]?[賬帳]?[戶户]?|收款戶口|收款方名稱|Payee|Recipient|Beneficiary|^To)\s+(.+)/i);
    if (nameMatch) {
      let extracted = nameMatch[1].trim();
      // 如果下一行是名稱續行（全英文大寫，如 "LIMITED" 或 "COMPANY LIMITED(CHONG MO)"）
      for (let ni = recipientLineIdx + 1; ni < Math.min(recipientLineIdx + 3, lines.length); ni++) {
        const nextLine = lines[ni];
        // Continuation of company name (uppercase + possible parentheses)
        if (/^[A-Z][A-Z\s.,&()]+$/.test(nextLine) && !/^\d/.test(nextLine)) {
          extracted += ' ' + nextLine.trim();
        }
        // FPS ID line means we've left the name area
        else if (/FPS|^\d{6,}$|^Default/.test(nextLine)) break;
        else break;
      }
      // Clean up: remove trailing parenthetical aliases like "(CHONG MO)"
      name = extracted.replace(/\s+/g, ' ').trim();
    }

    // 從收款人行之後找帳號（純數字6~20位）
    // 跳過付款方/支賬相關行，避免誤取付款人帳號
    if (!account) {
      for (let i = recipientLineIdx + 1; i < Math.min(recipientLineIdx + 5, lines.length); i++) {
        const line = lines[i];
        // 跳過付款方/支賬/交易金額/服務收費等非收款人行
        if (/^(?:付款方|支賬|交易金額|服務收費|轉賬交易|備註)/.test(line)) {
          break; // 已經離開收款人區域
        }
        const acctMatch = line.match(/^(\d{6,20})\s*$/);
        if (acctMatch) {
          account = acctMatch[1];
          break;
        }
        // 也匹配行內的帳號
        const inlineMatch = line.match(/\b(\d{6,20})\b/);
        if (inlineMatch && !/^\d{4}[\/\-]/.test(line)) { // 排除日期
          account = inlineMatch[1];
          break;
        }
      }
    }
  }

  // 備選：如果沒找到，嘗試寬鬆模式
  if (!name) {
    // 「轉賬 ... 給 XXX」模式 (如: 您已轉賬 港幣2,880.00元 給 CHONG MO COMPANY)
    const geiMatch = text.match(/給\s+([A-Z][A-Z\s.,&]+)/m);
    if (geiMatch) {
      let extracted = geiMatch[1].trim();
      // 檢查下一行是否是名稱續行（如 "NY LIMITED"）
      const geiIdx = text.indexOf(geiMatch[0]);
      const afterGei = text.substring(geiIdx + geiMatch[0].length);
      const nextLineMatch = afterGei.match(/^\s*\n\s*([A-Z][A-Z\s.,&]+)/m);
      if (nextLineMatch) {
        extracted += ' ' + nextLineMatch[1].trim();
      }
      name = extracted.replace(/\s+/g, ' ').trim();
    }
  }
  if (!name) {
    // 「轉至」/ 「轉賬至」模式 — 排除通用名詞如「收款人」
    const altMatch = text.match(/轉(?:至|賬至|帳至)\s*[:：]?\s*([A-Za-z\u4e00-\u9fff][A-Za-z\u4e00-\u9fff\s.,&]+)/m);
    if (altMatch) {
      const candidate = altMatch[1].split('\n')[0].trim();
      // 排除通用名詞
      if (!/^[收受]款人|^付款人|^帳[戶户]/.test(candidate)) {
        name = candidate;
      }
    }
  }

  // FPS ID / 轉數快識別碼（備用，如果上面沒找到）
  if (!account) {
    const fpsPatterns = [
      /收款方識別代碼\s+(\d{5,})/,
      /Payee\s*proxy\s*ID\s+(\d{5,})/i,
      /FPS\s*(?:ID|識別碼|編號)\s*[:：]?\s*(\d{5,})/i,
      /轉數快\s*(?:ID|識別碼|編號)\s*[:：]?\s*(\d{5,})/,
    ];
    for (const pattern of fpsPatterns) {
      const match = text.match(pattern);
      if (match) {
        account = match[1];
        break;
      }
    }
  }

  // 備用帳號提取：如果找到了收款人名稱但沒有帳號，搜索名稱附近的獨立數字行
  if (!account && name) {
    const nameIdx = text.indexOf(name.split(' ')[0]); // 用名稱第一個詞定位
    if (nameIdx >= 0) {
      const afterName = text.substring(nameIdx);
      // 在名稱後 200 字符內找獨立的 6-20 位數字
      const nearbyAccount = afterName.substring(0, 200).match(/\n\s*(\d{6,20})\s*(?:\n|$)/);
      if (nearbyAccount) {
        account = nearbyAccount[1];
      }
    }
  }

  return { name, account };
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
    /轉數快轉賬/,
    /FPS transfer/i,
    /Thank you/i,
    /gone through/i,
    /transfer.*success/i,
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
  // 英文月份映射
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  // 嘗試英文日期格式 "20 Mar 2026" 或 "Mar 20, 2026"
  const engDateMatch1 = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (engDateMatch1) {
    const day = engDateMatch1[1].padStart(2, '0');
    const month = monthMap[engDateMatch1[2].toLowerCase().substring(0, 3)];
    const year = engDateMatch1[3];
    if (month) return `${year}-${month}-${day}`;
  }
  const engDateMatch2 = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (engDateMatch2) {
    const month = monthMap[engDateMatch2[1].toLowerCase().substring(0, 3)];
    const day = engDateMatch2[2].padStart(2, '0');
    const year = engDateMatch2[3];
    if (month) return `${year}-${month}-${day}`;
  }

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
 * 合併多次 OCR 結果 — 各欄位取第一個非空值
 */
function mergeResults(base: OcrResult, ...others: Partial<OcrResult>[]): OcrResult {
  const merged = { ...base };
  for (const o of others) {
    if (!merged.amount && o.amount) merged.amount = o.amount;
    if (!merged.bank && o.bank) merged.bank = o.bank;
    if (!merged.receivingBank && o.receivingBank) merged.receivingBank = o.receivingBank;
    if (!merged.status && o.status) merged.status = o.status;
    if (!merged.date && o.date) merged.date = o.date;
    if (!merged.time && o.time) merged.time = o.time;
    if (!merged.recipientName && o.recipientName) merged.recipientName = o.recipientName;
    if (!merged.recipientAccount && o.recipientAccount) merged.recipientAccount = o.recipientAccount;
    // Accumulate raw text for better parsing
    if (o.rawText && o.rawText !== merged.rawText) {
      merged.rawText += '\n---\n' + o.rawText;
    }
  }
  return merged;
}

/**
 * 從 OCR 文字中提取收款方銀行（入數到哪間銀行）
 * 根據收款人帳號前3位（香港銀行編號）判斷
 */
function extractReceivingBank(text: string, recipientAccount: string | null): string | null {
  // 1. 從收款帳號前3位判斷銀行
  if (recipientAccount) {
    const bankCodeMap: [RegExp, string][] = [
      [/^003/, "渣打銀行"],
      [/^004/, "匯豐銀行"],
      [/^009/, "中信銀行"],
      [/^012/, "中銀香港"],
      [/^015/, "東亞銀行"],
      [/^016/, "星展銀行"],
      [/^024/, "恒生銀行"],
      [/^025/, "上海商業銀行"],
      [/^027/, "招商永隆銀行"],
      [/^028/, "大新銀行"],
      [/^035/, "工銀亞洲"],
      [/^039/, "花旗銀行"],
      [/^041/, "集友銀行"],
      [/^043/, "南洋商業銀行"],
    ];
    for (const [pattern, name] of bankCodeMap) {
      if (pattern.test(recipientAccount)) {
        return name;
      }
    }
  }

  // 2. 從文字中尋找「收款銀行」、「To Bank」等欄位
  const receivingBankPatterns: [RegExp, string][] = [
    [/收款(?:方)?銀行[：:\s]+(.+)/m, ''],
    [/To\s+Bank[：:\s]+(.+)/im, ''],
    [/Beneficiary\s+Bank[：:\s]+(.+)/im, ''],
  ];
  for (const [pattern] of receivingBankPatterns) {
    const match = text.match(pattern);
    if (match) {
      const bankText = match[1].trim();
      // 用 extractBank 的邏輯來識別銀行名稱
      const identified = extractBank(bankText);
      if (identified) return identified;
    }
  }

  // 3. 如果找到了帳號格式 xxx-xxx-x-xxxxxxx，提取前3位判斷
  const accountPatterns = [
    /收款[^\n]*?(\d{3})-\d{3}/,
    /To[^\n]*?(\d{3})-\d{3}/i,
    /帳[號号戶户][^\n]*?(\d{3})-\d{3}/,
  ];
  for (const pattern of accountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const code = match[1];
      const codeMap: Record<string, string> = {
        '003': '渣打銀行', '004': '匯豐銀行', '009': '中信銀行',
        '012': '中銀香港', '015': '東亞銀行', '016': '星展銀行',
        '024': '恒生銀行', '025': '上海商業銀行', '028': '大新銀行',
      };
      if (codeMap[code]) return codeMap[code];
    }
  }

  return null;
}

/**
 * 從一段 OCR 文字中提取所有可用欄位
 */
function parseAll(rawText: string): OcrResult {
  const recipient = extractRecipient(rawText);
  return {
    amount: extractAmount(rawText),
    bank: extractBank(rawText),
    receivingBank: extractReceivingBank(rawText, recipient.account),
    status: extractStatus(rawText),
    date: extractDate(rawText),
    time: extractTime(rawText),
    recipientName: recipient.name,
    recipientAccount: recipient.account,
    rawText,
  };
}

/**
 * 安全刪除臨時文件
 */
async function safeUnlink(path: string) {
  try { await unlink(path); } catch { /* ignore */ }
}

/**
 * 主函數：從 base64 圖片進行 OCR 識別收據
 * 使用多重策略提高識別率：
 * 1. 原圖 + PSM 4（單欄表格）
 * 2. 預處理圖（灰階+增強對比）+ PSM 4
 * 3. 高對比二值化圖 + PSM 6（單區塊）
 * 4. 原圖 + PSM 3（全自動）
 * 各欄位取第一個非空值
 */
export async function ocrReceipt(
  base64Data: string,
  mimeType: string
): Promise<OcrResult> {
  // 寫入臨時文件
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const id = randomBytes(8).toString("hex");
  const tmpPath = join(tmpdir(), `ocr_${id}.${ext}`);
  const tempFiles: string[] = [tmpPath];

  try {
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(tmpPath, buffer);

    // ── Pass 1: 原圖 PSM 4 ──
    let rawText1 = "";
    try {
      rawText1 = await runTesseract(tmpPath, "4");
      console.log("[Local OCR] Pass1 (original PSM4):", rawText1.substring(0, 300));
    } catch (e) {
      console.warn("[Local OCR] Pass1 failed:", e instanceof Error ? e.message : String(e));
    }
    const result1 = parseAll(rawText1);

    // ── Pass 2: ImageMagick 預處理 + PSM 4 ──
    let result2: OcrResult = { amount: null, bank: null, receivingBank: null, status: null, date: null, time: null, recipientName: null, recipientAccount: null, rawText: "" };
    try {
      const preprocessedPath = await preprocessImage(tmpPath);
      if (preprocessedPath !== tmpPath) tempFiles.push(preprocessedPath);
      const rawText2 = await runTesseract(preprocessedPath, "4");
      console.log("[Local OCR] Pass2 (preprocessed PSM4):", rawText2.substring(0, 300));
      result2 = parseAll(rawText2);
    } catch (e) {
      console.warn("[Local OCR] Pass2 failed:", e instanceof Error ? e.message : String(e));
    }

    // ── Pass 3: 高對比二值化 + PSM 6 ──
    let result3: OcrResult = { amount: null, bank: null, receivingBank: null, status: null, date: null, time: null, recipientName: null, recipientAccount: null, rawText: "" };
    // Only run Pass 3 if still missing key fields
    if (!result1.amount && !result2.amount || !result1.recipientName && !result2.recipientName) {
      try {
        const hcPath = await preprocessImageHighContrast(tmpPath);
        if (hcPath !== tmpPath) tempFiles.push(hcPath);
        const rawText3 = await runTesseract(hcPath, "6");
        console.log("[Local OCR] Pass3 (high-contrast PSM6):", rawText3.substring(0, 200));
        result3 = parseAll(rawText3);
      } catch (e) {
        console.warn("[Local OCR] Pass3 failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // ── Pass 4: 原圖 PSM 3（全自動）作為備用 ──
    let result4: OcrResult = { amount: null, bank: null, receivingBank: null, status: null, date: null, time: null, recipientName: null, recipientAccount: null, rawText: "" };
    if (!result1.amount && !result2.amount && !result3.amount) {
      try {
        const rawText4 = await runTesseract(tmpPath, "3");
        console.log("[Local OCR] Pass4 (original PSM3):", rawText4.substring(0, 200));
        result4 = parseAll(rawText4);
      } catch (e) {
        console.warn("[Local OCR] Pass4 failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // ── 合併所有結果 ──
    const finalResult = mergeResults(result1, result2, result3, result4);

    console.log("[Local OCR] Final merged result:", {
      amount: finalResult.amount,
      bank: finalResult.bank,
      receivingBank: finalResult.receivingBank,
      status: finalResult.status,
      date: finalResult.date,
      time: finalResult.time,
      recipientName: finalResult.recipientName,
      recipientAccount: finalResult.recipientAccount,
    });

    return finalResult;
  } finally {
    // 清理所有臨時文件
    for (const f of tempFiles) {
      await safeUnlink(f);
    }
  }
}
