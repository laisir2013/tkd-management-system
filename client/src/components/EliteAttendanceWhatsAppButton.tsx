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
): string {
  // 分類出席/遲到/缺席日期
  const presentDates = details.filter(d => d.status === 'present').map(d => d.date);
  const lateDates = details.filter(d => d.status === 'late').map(d => d.date);
  const absentDates = details.filter(d => d.status === 'absent').map(d => d.date);

  // 構建詳細訊息
  let detailLines = '';

  // 出席日期（含遲到）
  if (presentDates.length > 0 || lateDates.length > 0) {
    const allAttendedDates = details
      .filter(d => d.status === 'present' || d.status === 'late')
      .map((d, i) => `  ${i + 1}. ${d.date}${d.status === 'late' ? '(遲到)' : ''}`)
      .join('\n');
    detailLines += `\n✅ *已出席 ${cycleNum} 堂：*\n${allAttendedDates}`;
  }

  // 缺席日期
  if (absentDates.length > 0) {
    detailLines += `\n\n❌ *請假/缺席 ${absentDates.length} 堂：*\n${absentDates.map(d => `  • ${d}`).join('\n')}`;
  }

  // 第10堂或以上需繳費提醒
  let paymentSection = '';
  if (cycleNum >= 10) {
    paymentSection = `

⚠️ *已上到第 ${cycleNum} 堂，需繳交下一期精英班學費 $2,400*

💳 *繳費方式*

銀行轉帳：
• 銀行：中國銀行
• 帳戶號碼：012-692-2-0114816
• 帳戶名稱：Chong Mo Company Limited

轉數快 (FPS)：
• ID：164577132`;
  }

  const footerSection = cycleNum >= 10
    ? `───────────────
ℹ️ 如有任何疑問，歡迎隨時聯絡我們！

✅ *已繳費者請忽略此訊息*
謝謝您的配合！🙏`
    : `───────────────
方便大家紀錄番堂數
如有錯誤，可即時通知我地 🙏`;

  return `🥋 ${studentName} 家長您好！

📌 *【精英班堂數通知】*

您的學生 *${studentName}* 目前今期已上到第 *${cycleNum} 堂*（共 12 堂）
${detailLines}${paymentSection}

${footerSection}`;
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

      const message = buildWhatsAppMessage(studentName, finalCycleNumber, finalDetails);
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
      const message = buildWhatsAppMessage(studentName, cycleNumber, cycleDetails);
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
