import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface NextUnpaidQuarter {
  year: number;
  quarter: number;
  quarterName: string;
  adjustedFee?: number;
  feeNote?: string;
  feeBreakdown?: string;
  isAlignmentNote?: boolean;
}

interface StudentWhatsAppButtonProps {
  studentId: number;
  studentName: string;
  studentPhone: string;
  feeAmount: string;
  nextUnpaidQuarter?: NextUnpaidQuarter | null;
}

export function StudentWhatsAppButton({
  studentId,
  studentName,
  studentPhone,
  feeAmount,
  nextUnpaidQuarter,
}: StudentWhatsAppButtonProps) {
  const [lastRemindedAt, setLastRemindedAt] = useState<number | null>(null);

  // 從 localStorage 讀取最後提醒時間
  useEffect(() => {
    const key = `whatsapp_reminder_${studentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastRemindedAt(parseInt(stored, 10));
    }
  }, [studentId]);

  const handleWhatsAppClick = () => {
    if (!nextUnpaidQuarter) return;

    const { year, quarterName, adjustedFee, feeNote, feeBreakdown } = nextUnpaidQuarter;
    // 使用調整後金額（如有），否則使用原始季度學費
    const displayFee = adjustedFee !== undefined ? adjustedFee.toLocaleString() : feeAmount;
    
    // 構建金額說明區塊
    let feeDetailBlock = '';
    if (feeBreakdown) {
      if (nextUnpaidQuarter.isAlignmentNote) {
        // 插班對齊：口語化友善解釋，不需要「費用計算明細」前綴
        feeDetailBlock = `\n\n${feeBreakdown}`;
      } else {
        // 請假/12堂覆蓋等：格式化計算明細
        feeDetailBlock = `\n\n📊 *費用計算明細*\n${feeBreakdown}`;
      }
    }

    const message = `🥋 *${studentName}* 家長您好！\n\n📌 *${year}年 ${quarterName} 學費通知*\n應繳學費：*$${displayFee}*${feeDetailBlock}\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;

    // 記錄提醒時間到 localStorage
    const now = Date.now();
    const key = `whatsapp_reminder_${studentId}`;
    localStorage.setItem(key, now.toString());
    setLastRemindedAt(now);

    // 開啟 WhatsApp
    window.open(whatsappUrl, "_blank");
  };

  // 格式化最後提醒時間
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

  if (!nextUnpaidQuarter) {
    return (
      <div className="text-xs text-gray-500 text-center">
        全部已繳
      </div>
    );
  }

  // 根據季度返回不同顏色
  const getQuarterColor = (quarterName: string) => {
    if (quarterName.includes("1-3")) {
      return {
        text: "text-blue-600",
        hover: "hover:text-blue-700 hover:bg-blue-50",
        badge: "bg-blue-100 text-blue-700",
      };
    }
    if (quarterName.includes("4-6")) {
      return {
        text: "text-green-600",
        hover: "hover:text-green-700 hover:bg-green-50",
        badge: "bg-green-100 text-green-700",
      };
    }
    if (quarterName.includes("7-9")) {
      return {
        text: "text-orange-600",
        hover: "hover:text-orange-700 hover:bg-orange-50",
        badge: "bg-orange-100 text-orange-700",
      };
    }
    if (quarterName.includes("10-12")) {
      return {
        text: "text-purple-600",
        hover: "hover:text-purple-700 hover:bg-purple-50",
        badge: "bg-purple-100 text-purple-700",
      };
    }
    return {
      text: "text-gray-600",
      hover: "hover:text-gray-700 hover:bg-gray-50",
      badge: "bg-gray-100 text-gray-700",
    };
  };

  const quarterColor = getQuarterColor(nextUnpaidQuarter.quarterName);
  const hasAdjustedFee = nextUnpaidQuarter.adjustedFee !== undefined;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleWhatsAppClick}
        className={`${quarterColor.text} ${quarterColor.hover}`}
        data-student-whatsapp-id={studentId}
      >
        <WhatsAppIcon className="w-4 h-4 mr-1" />
        {nextUnpaidQuarter.quarterName}
      </Button>
      {hasAdjustedFee && (
        <span className="text-[10px] text-orange-600 font-medium leading-tight text-center">
          ${nextUnpaidQuarter.adjustedFee!.toLocaleString()}
        </span>
      )}
      {nextUnpaidQuarter.feeNote && (
        <span className="text-[9px] text-gray-400 leading-tight text-center max-w-[80px] truncate" title={nextUnpaidQuarter.feeNote}>
          {nextUnpaidQuarter.feeNote}
        </span>
      )}
      {lastRemindedAt && (
        <span className="text-xs text-gray-500">
          {formatLastRemindedTime(lastRemindedAt)}
        </span>
      )}
    </div>
  );
}
