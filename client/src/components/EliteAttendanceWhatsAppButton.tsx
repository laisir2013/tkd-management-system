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
 * 用 getPeriodsBreakdown 構建訊息，包含「上期」和「今期」兩段
 * - 上期：上期付款日期 + 完整出席明細
 * - 今期：今期付款日期 + 已上堂數明細（可能尚未開始）
 */
function buildWhatsAppMessageFromBreakdown(
  studentName: string,
  paidPeriods: number,
  periods: Period[],
  paymentDatesPerPeriod: (string | null)[],
): string {
  const sections: string[] = [];

  sections.push(`🥋 ${studentName} 家長您好！`);
  sections.push('');
  sections.push(`📌 *【精英班上課詳情】*`);

  // 上期（倒數第二期，即 paidPeriods - 1）
  const prevPeriodNum = paidPeriods - 1;
  if (prevPeriodNum >= 1) {
    const prevPeriod = periods.find((p: Period) => p.periodNumber === prevPeriodNum) || null;
    const prevPaymentDate = paymentDatesPerPeriod[prevPeriodNum - 1] || null;

    sections.push('');
    sections.push(`━━━━━━━━━━━━━━━`);
    sections.push(`📋 *上期（第${prevPeriodNum}期）：*`);
    if (prevPaymentDate) {
      const d = new Date(prevPaymentDate);
      sections.push(`繳費日期：${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
    }

    if (prevPeriod && prevPeriod.records.length > 0) {
      let attendIdx = 0;
      const absentDates: string[] = [];
      for (const rec of prevPeriod.records) {
        if (rec.isAttended) {
          attendIdx++;
          const lateTag = rec.status === 'late' ? '（遲到）' : '';
          sections.push(`第${attendIdx}堂：${rec.date}${lateTag}`);
        } else {
          absentDates.push(rec.date);
        }
      }
      if (absentDates.length > 0) {
        sections.push(`請假日期：${absentDates.join('、')}`);
      }
    } else {
      sections.push(`（無上課記錄）`);
    }
  }

  // 今期（paidPeriods 對應的期）
  const currentPeriodNum = paidPeriods;
  if (currentPeriodNum >= 1) {
    const currentPeriod = periods.find((p: Period) => p.periodNumber === currentPeriodNum) || null;
    const currentPaymentDate = paymentDatesPerPeriod[currentPeriodNum - 1] || null;

    sections.push('');
    sections.push(`━━━━━━━━━━━━━━━`);
    sections.push(`📋 *今期（第${currentPeriodNum}期）：*`);
    if (currentPaymentDate) {
      const d = new Date(currentPaymentDate);
      sections.push(`繳費日期：${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
    }

    if (currentPeriod && currentPeriod.records.length > 0) {
      const cycleNum = currentPeriod.attendedCount;
      sections.push(`已上堂數：第 ${cycleNum}/12 堂`);
      let attendIdx = 0;
      const absentDates: string[] = [];
      for (const rec of currentPeriod.records) {
        if (rec.isAttended) {
          attendIdx++;
          const lateTag = rec.status === 'late' ? '（遲到）' : '';
          sections.push(`第${attendIdx}堂：${rec.date}${lateTag}`);
        } else {
          absentDates.push(rec.date);
        }
      }
      if (absentDates.length > 0) {
        sections.push(`請假日期：${absentDates.join('、')}`);
      }
    } else {
      sections.push(`（尚未開始上堂）`);
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
        const message = buildWhatsAppMessageFromBreakdown(studentName, 0, [], []);
        openWhatsApp(studentPhone, message);
        return;
      }

      const message = buildWhatsAppMessageFromBreakdown(
        studentName,
        breakdown.paidPeriods,
        breakdown.periods as Period[],
        (breakdown as any).paymentDatesPerPeriod || [],
      );
      openWhatsApp(studentPhone, message);

    } catch (err) {
      console.error('[WhatsApp] Failed to fetch breakdown, using fallback:', err);
      const message = buildWhatsAppMessageFromBreakdown(studentName, 0, [], []);
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
