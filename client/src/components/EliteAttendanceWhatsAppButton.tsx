import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { trpc } from "@/lib/trpc";

interface CycleDetail {
  date: string;
  status: string; // 'present' | 'absent' | 'late'
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

function buildWhatsAppMessage(
  studentName: string,
  cycleNum: number,
  details: CycleDetail[],
  lastPaymentDate?: string | null,
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

  // 本期出席詳情
  sections.push(`*今期出席（第 ${cycleNum}/12 堂）：*`);

  // 列出每堂出席日期（present/late）
  let attendIdx = 0;
  const absentDates: string[] = [];
  for (const rec of details) {
    if (rec.status === 'present' || rec.status === 'late') {
      attendIdx++;
      const lateTag = rec.status === 'late' ? '（遲到）' : '';
      sections.push(`第${attendIdx}堂：${rec.date}${lateTag}`);
    } else {
      // absent / excused
      absentDates.push(rec.date);
    }
  }

  // 請假日期
  if (absentDates.length > 0) {
    sections.push('');
    sections.push(`請假日期：${absentDates.join('、')}`);
  }

  // 第10堂或以上需繳費提醒
  if (cycleNum >= 10) {
    sections.push('');
    sections.push(`⚠️ *已上到第 ${cycleNum} 堂，需繳交下一期精英班學費 $2,400*`);
    sections.push('');
    sections.push(`💳 *繳費方式*`);
    sections.push('');
    sections.push(`銀行轉帳：`);
    sections.push(`• 銀行：中國銀行`);
    sections.push(`• 帳戶號碼：012-692-2-0114816`);
    sections.push(`• 帳戶名稱：Chong Mo Company Limited`);
    sections.push('');
    sections.push(`轉數快 (FPS)：`);
    sections.push(`• ID：164577132`);
  }

  sections.push('');
  sections.push(`───────────────`);
  if (cycleNum >= 10) {
    sections.push(`ℹ️ 如有任何疑問，歡迎隨時聯絡我們！`);
    sections.push('');
    sections.push(`✅ *已繳費者請忽略此訊息*`);
    sections.push(`謝謝您的配合！🙏`);
  } else {
    sections.push(`方便大家紀錄番堂數`);
    sections.push(`如有錯誤，可即時通知我地 🙏`);
  }

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
      // 即時從 API 獲取最新 cycleInfo（不依賴 prop，確保數據最新）
      const freshCycleInfo = await utils.elite.getCycleInfo.fetch({ studentId });

      const finalCycleNumber = freshCycleInfo?.cycleNumber ?? cycleNumber;
      const finalDetails: CycleDetail[] = freshCycleInfo?.cycleDetails ?? cycleDetails;
      const lastPaymentDate = freshCycleInfo?.lastPaymentDate ?? null;

      const message = buildWhatsAppMessage(studentName, finalCycleNumber, finalDetails, lastPaymentDate);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;

      // 記錄發送時間到 localStorage
      const now = Date.now();
      const key = `elite_wa_attendance_${studentId}`;
      localStorage.setItem(key, now.toString());
      setLastSentAt(now);

      window.open(whatsappUrl, "_blank");
    } catch (err) {
      console.error('[WhatsApp] Failed to fetch cycleInfo, using props fallback:', err);
      // Fallback: 使用 prop 傳入的資料
      const message = buildWhatsAppMessage(studentName, cycleNumber, cycleDetails, null);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;

      const now = Date.now();
      const key = `elite_wa_attendance_${studentId}`;
      localStorage.setItem(key, now.toString());
      setLastSentAt(now);

      window.open(whatsappUrl, "_blank");
    } finally {
      setLoading(false);
    }
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
