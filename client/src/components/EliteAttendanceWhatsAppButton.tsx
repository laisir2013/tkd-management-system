import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface EliteAttendanceWhatsAppButtonProps {
  studentId: number;
  studentName: string;
  studentPhone: string;
  cycleNumber: number; // 當前循環中的堂數 (1-12)
  totalAttended: number; // 總出席堂數
  amountDue?: number; // 應繳費用
}

export function EliteAttendanceWhatsAppButton({
  studentId,
  studentName,
  studentPhone,
  cycleNumber,
  totalAttended,
  amountDue = 0,
}: EliteAttendanceWhatsAppButtonProps) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  useEffect(() => {
    const key = `elite_wa_attendance_${studentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastSentAt(parseInt(stored, 10));
    }
  }, [studentId]);

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!studentPhone || studentPhone === "" || studentPhone === "0") {
      alert(`無法發送 WhatsApp：${studentName} 沒有電話號碼記錄。請先在學生管理中新增電話號碼。`);
      return;
    }

    // 根據堂數位置決定訊息內容
    let message = "";

    if (cycleNumber >= 10) {
      // 接近 12 堂循環尾聲，提醒繳費
      message = `🥋 ${studentName} 家長您好！

📌 *精英班堂數通知*

您的孩子目前已上到今期第 *${cycleNumber} 堂*（共 12 堂）。
累計總出席：*${totalAttended} 堂*

⚠️ *今期即將完結，請準備繳交下期費用。*

💰 *下期費用：$2,400（12堂）*

───────────────
💳 *繳費方式*

銀行轉帳：
• 銀行：中國銀行
• 帳戶號碼：012-692-2-0114816
• 帳戶名稱：Chong Mo Company Limited

轉數快 (FPS)：
• ID：164577132
───────────────

如有任何疑問，歡迎隨時聯絡我們！
謝謝您的配合！🙏`;
    } else if (amountDue > 0) {
      // 已欠費
      message = `🥋 ${studentName} 家長您好！

📌 *精英班堂數通知*

您的孩子目前已上到今期第 *${cycleNumber} 堂*（共 12 堂）。
累計總出席：*${totalAttended} 堂*

⚠️ *目前尚有未繳費用：$${amountDue.toLocaleString()}*
請盡快繳費以確保孩子能繼續上課。

💰 *繳費金額：$2,400（12堂）*

───────────────
💳 *繳費方式*

銀行轉帳：
• 銀行：中國銀行
• 帳戶號碼：012-692-2-0114816
• 帳戶名稱：Chong Mo Company Limited

轉數快 (FPS)：
• ID：164577132
───────────────

如有任何疑問，歡迎隨時聯絡我們！
謝謝您的配合！🙏`;
    } else {
      // 正常堂數通知
      message = `🥋 ${studentName} 家長您好！

📌 *精英班堂數通知*

您的孩子目前已上到今期第 *${cycleNumber} 堂*（共 12 堂）。
累計總出席：*${totalAttended} 堂*

感謝您的支持！如有任何疑問，歡迎隨時聯絡我們！🙏`;
    }

    const whatsappUrl = `https://wa.me/852${studentPhone}?text=${encodeURIComponent(message)}`;

    // 記錄發送時間到 localStorage
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
        <MessageCircle className="w-3.5 h-3.5" />
      </Button>
      {lastSentAt && (
        <span className="text-[9px] text-gray-400 leading-none">
          {formatLastSentTime(lastSentAt)}
        </span>
      )}
    </div>
  );
}
