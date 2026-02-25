import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
}

interface TrainingDate {
  date: Date;
  scheduleId: number;
  status: string; // "active" | "cancelled"
}

interface AttendanceRecord {
  studentId: number;
  attendanceDate: Date;
  status: "present" | "absent" | "late" | "excused";
}

interface AttendanceTablePageProps {
  venue: string;
  day: string;
  time: string;
  students: Student[];
  trainingDates: TrainingDate[];
  attendanceRecords: AttendanceRecord[];
  selectedMonth: Date;
  onMonthChange: (direction: "prev" | "next" | "today") => void;
  onBack: () => void;
  onScheduleStatusChanged?: () => void;
}

export function AttendanceTablePage({
  venue,
  day,
  time,
  students,
  trainingDates,
  attendanceRecords,
  selectedMonth,
  onMonthChange,
  onBack,
  onScheduleStatusChanged,
}: AttendanceTablePageProps) {
  const [localAttendance, setLocalAttendance] = useState<Map<string, "present" | "absent" | null>>(
    new Map(
      attendanceRecords.map((record) => [
        `${record.studentId}-${format(new Date(record.attendanceDate), "yyyy-MM-dd")}`,
        record.status === "present" ? "present" : "absent",
      ])
    )
  );

  const upsertAttendanceMutation = trpc.attendance.upsertAttendance.useMutation();
  const cancelScheduleMutation = trpc.attendance.cancelTrainingSchedule.useMutation({
    onSuccess: () => {
      toast.success("已取消該堂課");
      onScheduleStatusChanged?.();
    },
    onError: () => {
      toast.error("取消課堂失敗");
    },
  });
  const activateScheduleMutation = trpc.attendance.activateTrainingSchedule.useMutation({
    onSuccess: () => {
      toast.success("已恢復該堂課");
      onScheduleStatusChanged?.();
    },
    onError: () => {
      toast.error("恢復課堂失敗");
    },
  });

  // 分離 active 和 cancelled 的訓練日期
  const activeDates = useMemo(() => trainingDates.filter(td => td.status === "active"), [trainingDates]);
  const cancelledDateIds = useMemo(() => new Set(trainingDates.filter(td => td.status === "cancelled").map(td => td.scheduleId)), [trainingDates]);

  // 獲取星期的中文名稱
  const dayLabel = useMemo(() => {
    const dayMap: Record<string, string> = {
      Monday: "星期一",
      Tuesday: "星期二",
      Wednesday: "星期三",
      Thursday: "星期四",
      Friday: "星期五",
      Saturday: "星期六",
      Sunday: "星期日",
    };
    return dayMap[day] || day;
  }, [day]);

  // 觸覺反饋
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // 靜默失敗
      }
    }
  };

  // 點擊切換出席狀態：未點名 → 出席 → 缺席 → 未點名
  const handleToggleAttendance = async (studentId: number, date: Date, courseId: number) => {
    const key = `${studentId}-${format(date, "yyyy-MM-dd")}`;
    const currentStatus = localAttendance.get(key) || null;
    let newStatus: "present" | "absent" | null;
    
    if (currentStatus === null) {
      newStatus = "present";
      vibrate(30);
    } else if (currentStatus === "present") {
      newStatus = "absent";
      vibrate([20, 30, 20]);
    } else {
      newStatus = null;
      vibrate(15);
    }

    // 樂觀更新 UI
    setLocalAttendance((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, newStatus);
      return newMap;
    });

    try {
      if (newStatus === null) {
        // 目前先不呼叫 API，只更新本地狀態
      } else {
        await upsertAttendanceMutation.mutateAsync({
          studentId,
          attendanceDate: date,
          status: newStatus,
          courseId,
        });
      }
    } catch (error) {
      // 回滾
      setLocalAttendance((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, currentStatus);
        return newMap;
      });
      toast.error("更新出席狀態失敗");
    }
  };

  // 取消課堂
  const handleCancelSchedule = (scheduleId: number) => {
    cancelScheduleMutation.mutate({ id: scheduleId });
  };

  // 恢復課堂
  const handleActivateSchedule = (scheduleId: number) => {
    activateScheduleMutation.mutate({ id: scheduleId });
  };

  // 獲取出席狀態
  const getAttendanceStatus = (studentId: number, date: Date): "present" | "absent" | null => {
    const key = `${studentId}-${format(date, "yyyy-MM-dd")}`;
    return localAttendance.get(key) ?? null;
  };

  // 計算每個學生的出席率（只計算 active 日期）
  const getAttendanceRate = (studentId: number): number => {
    if (activeDates.length === 0) return 0;
    const presentCount = activeDates.filter((td) => {
      const status = getAttendanceStatus(studentId, td.date);
      return status === "present";
    }).length;
    return Math.round((presentCount / activeDates.length) * 100);
  };

  // 切換月份
  const handlePreviousMonth = () => onMonthChange("prev");
  const handleNextMonth = () => onMonthChange("next");
  const handleToday = () => onMonthChange("today");

  return (
    <div className="space-y-4">
      {/* 標題和返回按鈕 */}
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回班別選擇
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold break-words">
              {venue} - {dayLabel} {time}
            </h2>
            <p className="text-sm text-muted-foreground">
              學生人數: {students.length} | 訓練日期: {activeDates.length} 次
              {cancelledDateIds.size > 0 && (
                <span className="text-orange-500 ml-1">（已取消 {cancelledDateIds.size} 次）</span>
              )}
            </p>
          </div>
          {/* 月份選擇器 */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[100px] text-center">
              {format(selectedMonth, "yyyy年 M月", { locale: zhTW })}
            </div>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              今天
            </Button>
          </div>
        </div>
      </div>

      {/* 點名表格 */}
      <div className="mx-[5%] sm:mx-0">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="border-collapse w-full table-fixed">
            <thead>
              {/* 取消/恢復按鈕行 */}
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-1 sm:px-2 py-1 w-10 sm:w-12"></th>
                <th className="sticky left-10 sm:left-12 z-20 bg-gray-50 border-b border-r border-gray-200 px-1 sm:px-3 py-1 text-center" style={{ width: trainingDates.length > 0 ? `${Math.max(20, Math.round(100 / (trainingDates.length + 1)))}%` : '25%' }}>
                  <span className="text-[9px] sm:text-xs text-muted-foreground">操作</span>
                </th>
                {trainingDates.map((td) => {
                  const isCancelled = td.status === "cancelled";
                  return (
                    <th
                      key={`action-${td.scheduleId}`}
                      className="border-b border-r border-gray-200 px-0 py-1 text-center"
                    >
                      {isCancelled ? (
                        <button
                          onClick={() => handleActivateSchedule(td.scheduleId)}
                          disabled={activateScheduleMutation.isPending}
                          className="inline-flex items-center justify-center px-1.5 h-6 sm:h-7 rounded bg-green-100 hover:bg-green-200 text-green-700 transition-colors text-[9px] sm:text-xs font-medium"
                          title="恢復此課堂"
                        >
                          恢復
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCancelSchedule(td.scheduleId)}
                          disabled={cancelScheduleMutation.isPending}
                          className="inline-flex items-center justify-center px-1.5 h-6 sm:h-7 rounded bg-red-100 hover:bg-red-200 text-red-600 transition-colors text-[9px] sm:text-xs font-medium"
                          title="取消此課堂（休息日）"
                        >
                          取消
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
              {/* 日期行 */}
              <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <th className="sticky left-0 z-20 bg-blue-600 border-b border-r border-blue-400 px-1 sm:px-2 py-1 sm:py-2 text-center w-10 sm:w-12">
                  <span className="text-[10px] sm:text-sm font-semibold">#</span>
                </th>
                <th className="sticky left-10 sm:left-12 z-20 bg-blue-600 border-b border-r border-blue-400 px-1 sm:px-3 py-1 sm:py-2 text-center" style={{ width: trainingDates.length > 0 ? `${Math.max(20, Math.round(100 / (trainingDates.length + 1)))}%` : '25%' }}>
                  <span className="text-[10px] sm:text-sm font-semibold">學生</span>
                </th>
                {trainingDates.map((td) => {
                  const isCancelled = td.status === "cancelled";
                  return (
                    <th
                      key={td.scheduleId}
                      className={`border-b border-r border-blue-400 px-0 sm:px-2 py-1 sm:py-2 text-center ${
                        isCancelled ? "opacity-50" : ""
                      }`}
                    >
                      <span className={`text-[10px] sm:text-sm font-bold ${isCancelled ? "line-through" : ""}`}>
                        {format(td.date, "d/M", { locale: zhTW })}
                      </span>
                      {isCancelled && (
                        <div className="text-[8px] sm:text-[10px] text-yellow-200 font-normal leading-tight">休息</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/80"}>
                  <td className="sticky left-0 z-10 border-b border-r border-gray-200 px-1 sm:px-2 py-0.5 sm:py-2 text-center text-[10px] sm:text-sm font-medium bg-inherit w-10 sm:w-12">
                    {index + 1}
                  </td>
                  <td className="sticky left-10 sm:left-12 z-10 border-b border-r border-gray-200 px-1 sm:px-3 py-0.5 sm:py-2 font-medium bg-inherit">
                    <span className="text-[15px] sm:text-base leading-tight truncate block text-center">{student.name}</span>
                  </td>
                  {trainingDates.map((td) => {
                    const isCancelled = td.status === "cancelled";
                    const status = getAttendanceStatus(student.id, td.date);
                    return (
                      <td
                        key={`${student.id}-${td.scheduleId}`}
                        className={`border-b border-r border-gray-100 p-1 sm:p-2 text-center ${
                          isCancelled ? "bg-gray-100" : ""
                        }`}
                      >
                        {isCancelled ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded text-xs text-gray-300">
                            —
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleAttendance(student.id, td.date, td.scheduleId)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded text-xs font-bold shadow-sm ${
                              status === "present"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "absent"
                                ? "bg-red-400 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {status === "present" ? (
                              <Check className="h-4 w-4" />
                            ) : status === "absent" ? (
                              <X className="h-4 w-4" />
                            ) : (
                              "-"
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 說明 */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <span className="text-base">💡</span>
          <span>點擊格子可以切換出席/缺席狀態，點擊日期上方的按鈕可以取消或恢復課堂</span>
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </span>
            <span className="text-green-700 dark:text-green-300 font-medium">出席</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
              <X className="h-3 w-3 text-red-600" />
            </span>
            <span className="text-red-700 dark:text-red-300 font-medium">缺席</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-gray-400 text-xs">—</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400 font-medium">未點名</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 h-5 rounded bg-red-100 flex items-center justify-center text-[9px] font-medium text-red-600">取消</span>
            <span className="text-red-600 dark:text-red-400 font-medium">取消課堂</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 h-5 rounded bg-green-100 flex items-center justify-center text-[9px] font-medium text-green-700">恢復</span>
            <span className="text-green-700 dark:text-green-300 font-medium">恢復課堂</span>
          </span>
        </div>
      </div>
    </div>
  );
}
