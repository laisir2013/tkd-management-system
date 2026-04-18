import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

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
  cycleDetails?: CycleDetail[]; // 當期各堂日期和狀態
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
      alert(`\u7121\u6cd5\u767c\u9001 WhatsApp\uff1a${studentName} \u6c92\u6709\u96fb\u8a71\u865f\u78bc\u8a18\u9304\u3002\u8acb\u5148\u5728\u5b78\u751f\u7ba1\u7406\u4e2d\u65b0\u589e\u96fb\u8a71\u865f\u78bc\u3002`);
      return;
    }

    // 分類出席/遲到/缺席日期
    const presentDates = cycleDetails.filter(d => d.status === 'present').map(d => d.date);
    const lateDates = cycleDetails.filter(d => d.status === 'late').map(d => d.date);
    const absentDates = cycleDetails.filter(d => d.status === 'absent').map(d => d.date);

    // 構建詳細訊息
    let detailLines = '';

    // 出席日期（含遲到）
    const attendedAll = [...presentDates];
    if (attendedAll.length > 0 || lateDates.length > 0) {
      const allAttendedDates = cycleDetails
        .filter(d => d.status === 'present' || d.status === 'late')
        .map((d, i) => `  ${i + 1}. ${d.date}${d.status === 'late' ? '(\u9072\u5230)' : ''}`)
        .join('\n');
      detailLines += `\n\u2705 *\u5df2\u51fa\u5e2d ${cycleNumber} \u5802\uff1a*\n${allAttendedDates}`;
    }

    // 缺席日期
    if (absentDates.length > 0) {
      detailLines += `\n\n\u274c *\u8acb\u5047/\u7f3a\u5e2d ${absentDates.length} \u5802\uff1a*\n${absentDates.map(d => `  \u2022 ${d}`).join('\n')}`;
    }

    const message = `\ud83e\udd4b ${studentName} \u5bb6\u9577\u60a8\u597d\uff01

\ud83d\udccc *\u3010\u7cbe\u82f1\u73ed\u5802\u6578\u901a\u77e5\u3011*

\u60a8\u7684\u5b78\u751f *${studentName}* \u76ee\u524d\u4eca\u671f\u5df2\u4e0a\u5230\u7b2c *${cycleNumber} \u5802*\uff08\u5171 12 \u5802\uff09
${detailLines}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u65b9\u4fbf\u5927\u5bb6\u7d00\u9304\u756a\u5802\u6578
\u5982\u6709\u932f\u8aa4\uff0c\u53ef\u5373\u6642\u901a\u77e5\u6211\u5730 \ud83d\ude4f`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${studentPhone}&text=${encodeURIComponent(message)}`;

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

    if (minutes < 1) return "\u525b\u525b";
    if (minutes < 60) return `${minutes}\u5206\u9418\u524d`;
    if (hours < 24) return `${hours}\u5c0f\u6642\u524d`;
    return `${days}\u5929\u524d`;
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
            ? "\u8a72\u5b78\u751f\u6c92\u6709\u96fb\u8a71\u865f\u78bc"
            : `WhatsApp \u901a\u77e5\uff1a\u4eca\u671f\u7b2c ${cycleNumber} \u5802/12\u5802`
        }
      >
        <WhatsAppIcon className="w-3.5 h-3.5" />
      </Button>
      {lastSentAt && (
        <span className="text-[9px] text-gray-400 leading-none">
          {formatLastSentTime(lastSentAt)}
        </span>
      )}
    </div>
  );
}
