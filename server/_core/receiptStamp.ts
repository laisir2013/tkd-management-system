/**
 * 收據標記模組 - 在收據圖片空白處加上學生姓名、金額、繳交月份
 * 使用 ImageMagick (convert) 進行圖片標記
 */
import { execFile } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

interface StampInfo {
  studentName: string;
  amount: string;
  paymentPeriod: string;    // e.g. "Q1", "Q2", "CUSTOM"
  customMonths?: string[] | null; // e.g. ["2026-01", "2026-02", "2026-03"]
  dojoName?: string | null;
}

/**
 * 將季度和自訂月份轉為可讀文字
 */
function formatPaymentMonths(period: string, customMonths?: string[] | null): string {
  const quarterMap: Record<string, string> = {
    'Q1': '1-3月',
    'Q2': '4-6月',
    'Q3': '7-9月',
    'Q4': '10-12月',
  };

  if (period !== 'CUSTOM' && quarterMap[period]) {
    return quarterMap[period];
  }

  if (customMonths && customMonths.length > 0) {
    // "2026-01" → "1月", "2026-02" → "2月"
    const months = customMonths.map(m => {
      const parts = m.split('-');
      return parts.length >= 2 ? `${parseInt(parts[1])}月` : m;
    });
    return months.join('、');
  }

  return period;
}

/**
 * 在收據圖片底部加上標記文字
 * 返回加了標記的圖片 Buffer
 */
export async function stampReceipt(
  imageBuffer: Buffer,
  mimeType: string,
  info: StampInfo
): Promise<Buffer> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const tmpId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `stamp_in_${tmpId}.${ext}`);
  const outputPath = join(tmpdir(), `stamp_out_${tmpId}.${ext}`);

  try {
    await writeFile(inputPath, imageBuffer);

    // 構建標記文字
    const monthsText = formatPaymentMonths(info.paymentPeriod, info.customMonths);
    const amountText = `HK$${parseFloat(info.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const lines: string[] = [];
    lines.push(`學生: ${info.studentName}`);
    lines.push(`金額: ${amountText}`);
    lines.push(`繳交月份: ${monthsText}`);
    if (info.dojoName) {
      lines.push(`道場: ${info.dojoName}`);
    }
    
    const stampText = lines.join('  |  ');
    const dateText = `確認日期: ${new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;

    // Use ImageMagick to add a banner at the bottom of the image
    // -gravity South: place text at bottom
    // -background: banner background color
    // -fill: text color
    // -font: use Noto Sans CJK for Chinese characters
    const fontPath = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
    
    const args = [
      inputPath,
      // Create a labeled banner and append it to the bottom
      '(', 
        '-size', '0x0',
        '-gravity', 'Center',
        '-background', '#1a365d',
        '-fill', 'white',
        '-font', fontPath,
        '-pointsize', '28',
        `label:${stampText}`,
        '-bordercolor', '#1a365d',
        '-border', '15x12',
      ')',
      '(', 
        '-size', '0x0',
        '-gravity', 'Center',
        '-background', '#2d3748',
        '-fill', '#cbd5e0',
        '-font', fontPath,
        '-pointsize', '20',
        `label:${dateText}`,
        '-bordercolor', '#2d3748',
        '-border', '10x6',
      ')',
      '-append',    // Vertically append (top-down)
      '-quality', '95',
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      execFile('convert', args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[ReceiptStamp] ImageMagick error:', error.message, stderr);
          reject(new Error(`ImageMagick failed: ${error.message}`));
          return;
        }
        resolve();
      });
    });

    const result = await readFile(outputPath);
    return result;
  } finally {
    // Cleanup temp files
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
  }
}
