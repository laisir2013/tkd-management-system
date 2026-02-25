import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { formatDayMonthYear } from "@/lib/dateFormat";

interface WhatsAppReminderButtonProps {
  studentId: number;
  studentName: string;
  studentPhone: string;
  month: number;
  year: number;
  amount: string;
  lastRemindedAt?: string | null;
}

export function WhatsAppReminderButton({
  studentId,
  studentName,
  studentPhone,
  month,
  year,
  amount,
  lastRemindedAt,
}: WhatsAppReminderButtonProps) {
  const [localLastReminded, setLocalLastReminded] = useState<string | null>(
    lastRemindedAt || null
  );

  const handleWhatsAppClick = () => {
    // 記錄提醒時間到 localStorage
    const reminderKey = `reminder_${studentId}_${year}_${month}`;
    const now = new Date().toISOString();
    localStorage.setItem(reminderKey, now);
    setLocalLastReminded(now);

    // 開啟 WhatsApp
    const systemUrl = window.location.origin;
    const quarterMap: Record<number, string> = {
      1: "1-3月",
      2: "1-3月",
      3: "1-3月",
      4: "4-6月",
      5: "4-6月",
      6: "4-6月",
      7: "7-9月",
      8: "7-9月",
      9: "7-9月",
      10: "10-12月",
      11: "10-12月",
      12: "10-12月",
    };
    const quarterName = quarterMap[month] || `${month}月`;
    const message = `🥋 ${studentName} 家長您好！\n\n📌 *${year}年${quarterName}學費通知*\n應繳學費：*$${amount}*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\n📱 *上傳收據步驟*\n\n1️⃣ 完成轉帳並截圖\n2️⃣ 登入系統：${systemUrl}\n3️⃣ 使用您的電話號碼登入\n   · 帳號：${studentPhone}\n   · 密碼：${studentPhone}\n   (登入後可自行修改密碼)\n4️⃣ 上傳收據截圖\n5️⃣ 完成！可隨時查閱繳費記錄\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const formatLastReminded = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "剛剛";
    if (diffMins < 60) return `${diffMins}分鐘前`;
    if (diffHours < 24) return `${diffHours}小時前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return formatDayMonthYear(date);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={handleWhatsAppClick}
      >
        <WhatsAppIcon className="w-4 h-4 mr-1" />
        WhatsApp
      </Button>
      {localLastReminded && (
        <span className="text-xs text-muted-foreground">
          上次提醒: {formatLastReminded(localLastReminded)}
        </span>
      )}
    </div>
  );
}
