import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  // Server data as a stable map
  const serverAttendance = useMemo(() => {
    const map = new Map<string, "present" | "absent">();
    attendanceRecords.forEach((record) => {
      const key = `${record.studentId}-${format(new Date(record.attendanceDate), "yyyy-MM-dd")}`;
      map.set(key, record.status === "present" ? "present" : "absent");
    });
    return map;
  }, [attendanceRecords]);

  // Optimistic overlay: only stores user clicks that haven't been confirmed by server yet
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, "present" | "absent" | null>>(new Map());

  // Track in-flight mutations to avoid premature clearing
  const inflightCount = useRef(0);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When server data refreshes, clear optimistic overlay
  useEffect(() => {
    setOptimisticUpdates(new Map());
  }, [serverAttendance]);

  // Merged attendance: optimistic overrides server
  const localAttendance = useMemo(() => {
    const merged = new Map<string, "present" | "absent" | null>(serverAttendance);
    optimisticUpdates.forEach((status, key) => {
      if (status === null) {
        merged.delete(key);
      } else {
        merged.set(key, status);
      }
    });
    return merged;
  }, [serverAttendance, optimisticUpdates]);

  // Schedule a delayed refetch after all mutations complete
  const scheduleRefetch = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      if (inflightCount.current > 0) {
        scheduleRefetch();
        return;
      }
      // Trigger parent to refetch attendance data
      onScheduleStatusChanged?.();
    }, 800);
  }, [onScheduleStatusChanged]);

  const upsertAttendanceMutation = trpc.attendance.upsertAttendance.useMutation({
    onMutate: () => {
      inflightCount.current++;
    },
    onSuccess: () => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      scheduleRefetch();
    },
    onError: (_err, variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      // Revert optimistic entry
      const key = `${variables.studentId}-${format(new Date(variables.attendanceDate), "yyyy-MM-dd")}`;
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error("更新出席狀態失敗");
      scheduleRefetch();
    },
  });
  const deleteAttendanceMutation = trpc.attendance.deleteAttendance.useMutation({
    onMutate: () => {
      inflightCount.current++;
    },
    onSuccess: () => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      scheduleRefetch();
    },
    onError: (_err, variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      const key = `${variables.studentId}-${format(new Date(), "yyyy-MM-dd")}`;
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error("取消點名失敗");
      scheduleRefetch();
    },
  });
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

  // 批量標記缺席
  const batchMarkAbsentMutation = trpc.attendance.batchMarkAbsent.useMutation({
    onMutate: () => {
      inflightCount.current++;
    },
    onSuccess: (data) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      toast.success(`已將 ${data.count} 位未點名學生標記為缺席`);
      scheduleRefetch();
    },
    onError: () => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      toast.error("批量標記缺席失敗");
      scheduleRefetch();
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
  const handleToggleAttendance = (studentId: number, date: Date, scheduleId: number) => {
    const key = `${studentId}-${format(date, "yyyy-MM-dd")}`;
    const currentStatus = localAttendance.get(key) ?? null;
    let newStatus: "present" | "absent" | null;
    
    if (currentStatus === null || currentStatus === undefined) {
      newStatus = "present";
      vibrate(30);
    } else if (currentStatus === "present") {
      newStatus = "absent";
      vibrate([20, 30, 20]);
    } else {
      newStatus = null;
      vibrate(15);
    }

    // Optimistic update: immediately update UI
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      next.set(key, newStatus);
      return next;
    });

    // Call API
    if (newStatus === null) {
      // Delete the attendance record from DB
      deleteAttendanceMutation.mutate({ studentId, scheduleId });
    } else {
      upsertAttendanceMutation.mutate({
        studentId,
        attendanceDate: date,
        status: newStatus,
        scheduleId,
      });
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

  // 計算某日期未點名的學生列表
  const getUnmarkedStudents = (td: TrainingDate): Student[] => {
    return students.filter(s => getAttendanceStatus(s.id, td.date) === null);
  };

  // 批量標記未點名學生為缺席
  const handleBatchMarkAbsent = (td: TrainingDate) => {
    const unmarked = getUnmarkedStudents(td);
    if (unmarked.length === 0) return;

    // Optimistic: 立即在 UI 顯示為缺席
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      unmarked.forEach(s => {
        const key = `${s.id}-${format(td.date, "yyyy-MM-dd")}`;
        next.set(key, "absent");
      });
      return next;
    });
    vibrate([20, 40, 20]);

    // 呼叫 API
    batchMarkAbsentMutation.mutate({
      scheduleId: td.scheduleId,
      attendanceDate: td.date,
      studentIds: unmarked.map(s => s.id),
    });
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
              {/* 日期行 + 取消/恢復按鈕整合 */}
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
                      className={`border-b border-r border-blue-400 px-0 sm:px-1 py-1 sm:py-2 text-center ${
                        isCancelled ? "bg-blue-400/50" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[10px] sm:text-sm font-bold leading-tight ${isCancelled ? "line-through opacity-60" : ""}`}>
                          {format(td.date, "d/M", { locale: zhTW })}
                        </span>
                        {isCancelled ? (
                          <button
                            onClick={() => handleActivateSchedule(td.scheduleId)}
                            disabled={activateScheduleMutation.isPending}
                            className="inline-flex items-center justify-center px-1 h-5 sm:h-6 rounded bg-yellow-300/90 hover:bg-yellow-400 text-yellow-900 transition-colors text-[8px] sm:text-[10px] font-bold leading-none whitespace-nowrap"
                            title="恢復此課堂"
                          >
                            休息
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCancelSchedule(td.scheduleId)}
                            disabled={cancelScheduleMutation.isPending}
                            className="inline-flex items-center justify-center px-1 h-5 sm:h-6 rounded bg-white/20 hover:bg-white/40 text-white/80 hover:text-white transition-colors text-[8px] sm:text-[10px] font-medium leading-none whitespace-nowrap"
                            title="取消此課堂（休息日）"
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="border-b border-r border-blue-400 px-1 sm:px-2 py-1 sm:py-2 text-center w-10 sm:w-14">
                  <span className="text-[10px] sm:text-sm font-semibold">出席</span>
                </th>
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
                  {/* 出席統計 */}
                  <td className="border-b border-r border-gray-200 p-1 sm:p-2 text-center w-10 sm:w-14">
                    {(() => {
                      const presentCount = activeDates.filter((td) => getAttendanceStatus(student.id, td.date) === "present").length;
                      const markedCount = activeDates.filter((td) => getAttendanceStatus(student.id, td.date) !== null).length;
                      return (
                        <span className={`text-[11px] sm:text-sm font-bold ${presentCount > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                          {markedCount > 0 ? `${presentCount}/${markedCount}` : "0"}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {/* 底部操作列：批量標記缺席按鈕 */}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-1 sm:px-2 py-1.5 text-center" colSpan={1}>
                </td>
                <td className="sticky left-10 sm:left-12 z-10 bg-gray-50 border-b border-r border-gray-200 px-1 sm:px-3 py-1.5 text-center">
                  <span className="text-[10px] sm:text-xs text-gray-500 font-medium">未點名</span>
                </td>
                {trainingDates.map((td) => {
                  const isCancelled = td.status === "cancelled";
                  const unmarkedCount = isCancelled ? 0 : getUnmarkedStudents(td).length;
                  return (
                    <td
                      key={`batch-${td.scheduleId}`}
                      className={`border-b border-r border-gray-200 p-1 text-center ${isCancelled ? "bg-gray-100" : ""}`}
                    >
                      {!isCancelled && unmarkedCount > 0 ? (
                        <button
                          onClick={() => handleBatchMarkAbsent(td)}
                          disabled={batchMarkAbsentMutation.isPending}
                          className="inline-flex flex-col items-center justify-center w-full px-0.5 py-0.5 rounded bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-colors group"
                          title={`將 ${unmarkedCount} 位未點名學生標記為缺席`}
                        >
                          <X className="h-3 w-3 text-red-400 group-hover:text-red-600" />
                          <span className="text-[9px] sm:text-[10px] text-red-500 group-hover:text-red-700 font-bold leading-tight">
                            {unmarkedCount}
                          </span>
                        </button>
                      ) : !isCancelled ? (
                        <span className="text-[9px] sm:text-[10px] text-emerald-500 font-medium">✓</span>
                      ) : null}
                    </td>
                  );
                })}
                <td className="border-b border-r border-gray-200 p-1 text-center">
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 說明 */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <span className="text-base">💡</span>
          <span>點擊格子切換出席狀態，點擊日期下方的「取消」可取消課堂</span>
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
              <Check className="h-3 w-3 text-emerald-700" />
            </span>
            <span className="text-green-700 dark:text-green-300 font-medium">出席</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-red-400 flex items-center justify-center">
              <X className="h-3 w-3 text-white" />
            </span>
            <span className="text-red-700 dark:text-red-300 font-medium">缺席</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-gray-400 text-xs">-</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400 font-medium">未點名</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-red-50 border border-red-200 flex items-center justify-center">
              <X className="h-3 w-3 text-red-400" />
            </span>
            <span className="text-red-600 dark:text-red-400 font-medium">未點→缺席</span>
          </span>
          <span className="ml-1 text-muted-foreground">點擊格子切換狀態，底部按鈕可一次過將未點名標記為缺席</span>
        </div>
      </div>
    </div>
  );
}
