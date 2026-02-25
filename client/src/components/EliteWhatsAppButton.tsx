import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

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

  useEffect(() => {
    const key = `elite_whatsapp_reminder_${studentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastRemindedAt(parseInt(stored, 10));
    }
  }, [studentId]);

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!studentPhone || studentPhone === "" || studentPhone === "0") {
      alert(`無法發送 WhatsApp：${studentName} 沒有電話號碼記錄。請先在學生管理中新增電話號碼。`);
      return;
    }

    const systemUrl = window.location.origin;

    const message = `📌 *【精英班繳費】*

你好呀，${studentName} 家長，

．上期已上堂數：*${attendedClasses} 堂*
．剩餘堂數：*${remainingClasses} 堂*
．繳費金額：*$2,400（12堂）*

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

    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;

    // 記錄提醒時間到 localStorage
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
        <WhatsAppIcon className="w-4 h-4 text-green-600" />
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
