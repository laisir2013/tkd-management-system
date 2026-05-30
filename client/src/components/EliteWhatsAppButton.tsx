import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { trpc } from "@/lib/trpc";

interface EliteWhatsAppButtonProps {
  studentId: number;
  studentName: string;
  studentPhone: string;
  remainingClasses: number;
  paidClasses: number;
  attendedClasses: number;
  feePerClass?: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  showLabel?: boolean;
}

/**
 * 格式化一期的詳細記錄
 * 出席堂列出編號和日期，請假列出日期
 */
function formatPeriodDetail(
  periodNumber: number,
  records: Array<{ date: string; status: string; isAttended: boolean }>,
  attendedCount: number,
  absentDates: string[],
  isComplete: boolean,
): string {
  const lines: string[] = [];
  lines.push(`*第${periodNumber}期：*`);

  // 列出出席堂數（present/late）的日期，帶編號
  let attendIdx = 0;
  for (const rec of records) {
    if (rec.isAttended) {
      attendIdx++;
      const lateTag = rec.status === 'late' ? '(遲到)' : '';
      lines.push(`  ${attendIdx}. ${rec.date}${lateTag}`);
    }
  }

  // 如果未滿12堂，標注進度
  if (!isComplete && attendedCount > 0) {
    lines.push(`  （今期已上到第${attendedCount}堂）`);
  }

  // 列出請假日期
  if (absentDates.length > 0) {
    lines.push(`  請假：${absentDates.join('、')}`);
  }

  return lines.join('\n');
}

/**
 * 計算預計第12堂日期
 * 從當前堂數和最後上堂日期推算（假設每週一堂）
 */
function estimateClass12Date(
  currentCount: number,
  lastRecordDate: string,
): string | null {
  if (currentCount >= 12) return null;
  // lastRecordDate 格式: "d/m/yyyy"
  const parts = lastRecordDate.split('/');
  if (parts.length < 2) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // 0-based
  const year = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear();
  const lastDate = new Date(year, month, day);
  if (isNaN(lastDate.getTime())) return null;

  // 剩餘堂數 × 7天
  const remainingClasses = 12 - currentCount;
  const estimatedDate = new Date(lastDate);
  estimatedDate.setDate(estimatedDate.getDate() + remainingClasses * 7);
  return `${estimatedDate.getDate()}/${estimatedDate.getMonth() + 1}/${estimatedDate.getFullYear()}`;
}

export function EliteWhatsAppButton({
  studentId,
  studentName,
  studentPhone,
  remainingClasses,
  paidClasses,
  attendedClasses,
  feePerClass = "200",
  size = "sm",
  variant = "ghost",
  showLabel = true,
}: EliteWhatsAppButtonProps) {
  const [lastRemindedAt, setLastRemindedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    const key = `elite_whatsapp_reminder_${studentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastRemindedAt(parseInt(stored, 10));
    }
  }, [studentId]);

  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!studentPhone || studentPhone === "" || studentPhone === "0") {
      alert(`無法發送 WhatsApp：${studentName} 沒有電話號碼記錄。請先在學生管理中新增電話號碼。`);
      return;
    }

    setLoading(true);

    try {
      // 即時從 API 獲取完整期數明細
      const breakdown = await utils.elite.getPeriodsBreakdown.fetch({ studentId });

      if (!breakdown || breakdown.periods.length === 0) {
        // 沒有出席記錄，使用簡單訊息
        const message = buildSimpleMessage(studentName, studentPhone);
        openWhatsApp(studentPhone, message);
        return;
      }

      const message = buildDetailedMessage(
        studentName,
        studentPhone,
        breakdown.periods,
        breakdown.unpaidPeriods,
        breakdown.paidPeriods,
        breakdown.feePerPeriod,
      );
      openWhatsApp(studentPhone, message);

    } catch (err) {
      console.error('[EliteWhatsApp] Failed to fetch breakdown, using simple message:', err);
      const message = buildSimpleMessage(studentName, studentPhone);
      openWhatsApp(studentPhone, message);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (phone: string, message: string) => {
    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${phone}&text=${encodeURIComponent(message)}`;
    const now = Date.now();
    const key = `elite_whatsapp_reminder_${studentId}`;
    localStorage.setItem(key, now.toString());
    setLastRemindedAt(now);
    window.open(whatsappUrl, "_blank");
  };

  const formatLastRemindedTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "剛剛";
    if (minutes < 60) return `${minutes}分鐘前`;
    if (hours < 24) return `${hours}小時前`;
    return `${days}天前`;
  };

  const hasPhone = studentPhone && studentPhone !== "" && studentPhone !== "0";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant={variant}
        size={size}
        onClick={handleWhatsAppClick}
        disabled={loading}
        className={`${
          remainingClasses <= 0
            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
            : remainingClasses <= 3
            ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            : "text-green-600 hover:text-green-700 hover:bg-green-50"
        } ${!hasPhone ? "opacity-50" : ""}`}
        title={
          !hasPhone
            ? "該學生沒有電話號碼"
            : `發送 WhatsApp 繳費提醒（剩餘 ${remainingClasses} 堂）`
        }
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <WhatsAppIcon className="w-4 h-4" />
        )}
        {showLabel && (
          <span className="ml-1">
            {remainingClasses <= 0 ? "急" : "通知"}
          </span>
        )}
      </Button>
      {lastRemindedAt && (
        <span className="text-[10px] text-gray-400 leading-none">
          {formatLastRemindedTime(lastRemindedAt)}
        </span>
      )}
    </div>
  );
}

// ── 訊息構建函數 ──

type Period = {
  periodNumber: number;
  records: Array<{ date: string; status: string; isAttended: boolean }>;
  attendedCount: number;
  absentDates: string[];
  isPaid: boolean;
  isComplete: boolean;
};

function buildDetailedMessage(
  studentName: string,
  studentPhone: string,
  allPeriods: Period[],
  unpaidPeriods: Period[],
  paidPeriodsCount: number,
  feePerPeriod: number,
): string {
  const systemUrl = window.location.origin;
  const sections: string[] = [];

  sections.push(`📌 *【精英班繳費通知】*\n\n你好呀，${studentName} 家長，`);

  if (unpaidPeriods.length > 0) {
    // ── 情況A：有未繳費的期數 ──
    // 檢查最後一期是否未完成（進行中）
    const lastPeriod = allPeriods[allPeriods.length - 1];
    const inProgressPeriod = lastPeriod && !lastPeriod.isComplete ? lastPeriod : null;
    // 已完成但未繳費的期數
    const completedUnpaid = unpaidPeriods.filter(p => p.isComplete);
    // 進行中且未繳費的期
    const inProgressUnpaid = inProgressPeriod && !inProgressPeriod.isPaid ? inProgressPeriod : null;

    sections.push(`\n需要繳交的期數：`);

    // 列出每期的詳細記錄
    for (const period of unpaidPeriods) {
      sections.push('');
      sections.push(formatPeriodDetail(
        period.periodNumber,
        period.records,
        period.attendedCount,
        period.absentDates,
        period.isComplete,
      ));
    }

    // 費用計算
    const totalUnpaid = unpaidPeriods.length;
    const totalAmount = totalUnpaid * feePerPeriod;
    sections.push('');
    sections.push(`💰 *需繳交 ${totalUnpaid} 期 × $${feePerPeriod.toLocaleString()} = $${totalAmount.toLocaleString()}*`);

  } else {
    // ── 情況B：沒有欠費（剛完成一期 or 全部繳清） ──
    const lastCompletePeriod = [...allPeriods].reverse().find(p => p.isComplete);
    const inProgressPeriod = allPeriods[allPeriods.length - 1]?.isComplete === false
      ? allPeriods[allPeriods.length - 1]
      : null;

    if (lastCompletePeriod) {
      sections.push(`\n剛完成的期數詳情：`);
      sections.push('');
      sections.push(formatPeriodDetail(
        lastCompletePeriod.periodNumber,
        lastCompletePeriod.records,
        lastCompletePeriod.attendedCount,
        lastCompletePeriod.absentDates,
        lastCompletePeriod.isComplete,
      ));
    }

    if (inProgressPeriod && inProgressPeriod.records.length > 0) {
      // 新一期已開始
      sections.push('');
      const firstRecord = inProgressPeriod.records[0];
      sections.push(`下一期開始日期：${firstRecord.date}`);
      const lastRecord = inProgressPeriod.records[inProgressPeriod.records.length - 1];
      const est12 = estimateClass12Date(inProgressPeriod.attendedCount, lastRecord.date);
      if (est12) {
        sections.push(`（如一直不請假不停課，預計第12堂的日期是：${est12}）`);
      }
    } else if (lastCompletePeriod) {
      // 下一期尚未開始，從最後一期最後一堂推算
      const lastRec = lastCompletePeriod.records[lastCompletePeriod.records.length - 1];
      if (lastRec) {
        // 下一期第1堂 = 最後一堂 + 7 天
        const parts = lastRec.date.split('/');
        if (parts.length >= 2) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear();
          const nextStart = new Date(year, month, day + 7);
          const nextStartStr = `${nextStart.getDate()}/${nextStart.getMonth() + 1}/${nextStart.getFullYear()}`;
          sections.push('');
          sections.push(`下一期開始日期：${nextStartStr}`);
          // 預計第12堂
          const est12 = new Date(nextStart);
          est12.setDate(est12.getDate() + 11 * 7);
          sections.push(`（如一直不請假不停課，預計第12堂的日期是：${est12.getDate()}/${est12.getMonth() + 1}/${est12.getFullYear()}）`);
        }
      }
    }

    sections.push('');
    sections.push(`💰 *需繳交下一期精英班學費：$${feePerPeriod.toLocaleString()}（12堂）*`);
  }

  // 繳費資料
  sections.push(`
───────────────
💳 *入帳資料：*

銀行：匯豐銀行
帳戶號碼：484-287123-838

銀行：中國銀行
帳戶號碼：012-692-2-0114816

轉數快ID：164577132

帳戶名稱：Chong Mo Company Limited
───────────────

📱 *上傳收據步驟*

1️⃣ 完成轉帳並截圖
2️⃣ 登入系統：${systemUrl}
3️⃣ 使用您的電話號碼登入
   · 帳號：${studentPhone}
   · 密碼：${studentPhone}
   （登入後可自行修改密碼）
4️⃣ 上傳收據截圖
5️⃣ 完成！

如有任何疑問，歡迎隨時聯絡我們！🙏`);

  return sections.join('\n');
}

function buildSimpleMessage(studentName: string, studentPhone: string): string {
  const systemUrl = window.location.origin;
  return `📌 *【精英班繳費】*

你好呀，${studentName} 家長，

繳費金額：*$2,400（12堂）*

───────────────
💳 *入帳資料：*

銀行：匯豐銀行
帳戶號碼：484-287123-838

銀行：中國銀行
帳戶號碼：012-692-2-0114816

轉數快ID：164577132

帳戶名稱：Chong Mo Company Limited
───────────────

📱 *上傳收據步驟*

1️⃣ 完成轉帳並截圖
2️⃣ 登入系統：${systemUrl}
3️⃣ 使用您的電話號碼登入
   · 帳號：${studentPhone}
   · 密碼：${studentPhone}
   （登入後可自行修改密碼）
4️⃣ 上傳收據截圖
5️⃣ 完成！

如有任何疑問，歡迎隨時聯絡我們！🙏`;
}
