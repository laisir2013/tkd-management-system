import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { trpc } from "@/lib/trpc";

interface CycleDetail {
  date: string;
  status: string; // 'present' | 'absent' | 'late'
}

interface PeriodRecord {
  date: string;
  status: string;
  isAttended: boolean;
}

interface Period {
  periodNumber: number;
  records: PeriodRecord[];
  attendedCount: number;
  absentDates: string[];
  isPaid: boolean;
  isComplete: boolean;
}

interface EliteAttendanceWhatsAppButtonProps {
  studentId: number;
  studentName: string;
  studentPhone: string;
  cycleNumber: number; // 當前循環中的堂數 (1-12)
  totalAttended: number; // 總出席堂數
  lastAttendedDate?: string | null; // 最近一次上堂日期
  amountDue?: number; // 應繳費用
  cycleDetails?: CycleDetail[]; // 當期各堂日期和狀態（備用，優先用 API 即時查詢）
}

/**
 * 用 getPeriodsBreakdown 的「最新一期」資料構建訊息
 * 邏輯：以繳費為基準，顯示「最近繳費對應的那期」的上課狀態
 * - 如果最新繳費對應的期尚未開始上堂 → 顯示「尚未開始」
 * - 如果已上了幾堂 → 第1堂: date, 第2堂: date...
 */
function buildWhatsAppMessageFromBreakdown(
  studentName: string,
  lastPaymentDate: string | null,
  latestPaidPeriod: Period | null,
): string {
  const sections: string[] = [];

  sections.push(`🥋 ${studentName} 家長您好！`);
  sections.push('');
  sections.push(`📌 *【精英班上課詳情】*`);
  sections.push('');

  // 最近1次繳費日期
  if (lastPaymentDate) {
    const d = new Date(lastPaymentDate);
    const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    sections.push(`最近1次繳費日期：${dateStr}`);
  } else {
    sections.push(`最近1次繳費日期：（無紀錄）`);
  }
  sections.push('');

  if (!latestPaidPeriod || latestPaidPeriod.records.length === 0) {
    // 這期還沒有任何上課記錄
    sections.push(`*這期出席（第 0/12 堂）：*`);
    sections.push(`（尚未開始上堂）`);
  } else {
    const cycleNum = latestPaidPeriod.attendedCount;
    sections.push(`*這期出席（第 ${cycleNum}/12 堂）：*`);

    // 列出每堂出席日期（present/late）
    let attendIdx = 0;
    const absentDates: string[] = [];
    for (const rec of latestPaidPeriod.records) {
      if (rec.isAttended) {
        attendIdx++;
        const lateTag = rec.status === 'late' ? '（遲到）' : '';
        sections.push(`第${attendIdx}堂：${rec.date}${lateTag}`);
      } else {
        absentDates.push(rec.date);
      }
    }

    // 請假日期
    if (absentDates.length > 0) {
      sections.push('');
      sections.push(`請假日期：${absentDates.join('、')}`);
    }
  }

  sections.push('');
  sections.push(`───────────────`);
  sections.push(`方便大家紀錄番堂數`);
  sections.push(`如有錯誤，可即時通知我地 🙏`);

  return sections.join('\n');
}

export function EliteAttendanceWhatsAppButton({
  studentId,
  studentName,
  studentPhone,
  cycleNumber,
  totalAttended,
  lastAttendedDate,
  amountDue = 0,
  cycleDetails = [],
}: EliteAttendanceWhatsAppButtonProps) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // tRPC utility for on-demand fetch
  const utils = trpc.useUtils();

  useEffect(() => {
    const key = `elite_wa_attendance_${studentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastSentAt(parseInt(stored, 10));
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
      // 使用 getPeriodsBreakdown 取得完整期數明細（以繳費為基準分期）
      const breakdown = await utils.elite.getPeriodsBreakdown.fetch({ studentId });

      if (!breakdown) {
        const message = buildWhatsAppMessageFromBreakdown(studentName, null, null);
        openWhatsApp(studentPhone, message);
        return;
      }

      // 取最近繳費日期
      const cycleInfo = await utils.elite.getCycleInfo.fetch({ studentId });
      const lastPaymentDate = cycleInfo?.lastPaymentDate ?? null;

      // 找到「最近繳費對應的那一期」
      // paidPeriods = 已付期數
      const paidPeriods = breakdown.paidPeriods;
      let latestPaidPeriod: Period | null = null;
      
      if (paidPeriods > 0) {
        // 找到最後付費對應的期
        latestPaidPeriod = breakdown.periods.find(
          (p: Period) => p.periodNumber === paidPeriods
        ) || null;
        
        // 如果這期在數據中不存在（還沒上任何堂），
        // 代表付了但還沒開始，回傳 null 讓訊息顯示「尚未開始」
      }

      // 如果沒有付款記錄，顯示當前最新一期
      if (paidPeriods === 0 && breakdown.periods.length > 0) {
        latestPaidPeriod = breakdown.periods[breakdown.periods.length - 1] as Period;
      }

      const message = buildWhatsAppMessageFromBreakdown(studentName, lastPaymentDate, latestPaidPeriod);
      openWhatsApp(studentPhone, message);

    } catch (err) {
      console.error('[WhatsApp] Failed to fetch breakdown, using fallback:', err);
      // Fallback: 簡單訊息
      const message = buildWhatsAppMessageFromBreakdown(studentName, null, null);
      openWhatsApp(studentPhone, message);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (phone: string, message: string) => {
    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${phone}&text=${encodeURIComponent(message)}`;
    const now = Date.now();
    const key = `elite_wa_attendance_${studentId}`;
    localStorage.setItem(key, now.toString());
    setLastSentAt(now);
    window.open(whatsappUrl, "_blank");
  };

  const formatLastSentTime = (timestamp: number): string => {
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
        variant="ghost"
        size="sm"
        onClick={handleWhatsAppClick}
        disabled={loading}
        className={`h-6 px-1.5 ${
          amountDue > 0 || cycleNumber >= 10
            ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            : "text-green-600 hover:text-green-700 hover:bg-green-50"
        } ${!hasPhone ? "opacity-50" : ""}`}
        title={
          !hasPhone
            ? "該學生沒有電話號碼"
            : `WhatsApp 通知：今期第 ${cycleNumber} 堂/12堂`
        }
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <WhatsAppIcon className="w-3.5 h-3.5" />
        )}
      </Button>
      {lastSentAt && (
        <span className="text-[9px] text-gray-400 leading-none">
          {formatLastSentTime(lastSentAt)}
        </span>
      )}
    </div>
  );
}
