import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar, Ban, RotateCcw, ChevronsLeft, ChevronsRight, MessageCircle } from "lucide-react";
import { EliteWhatsAppButton } from "@/components/EliteWhatsAppButton";

const VISIBLE_COLUMNS = 6;

export default function EliteHistory() {
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [startIndex, setStartIndex] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const { data: availableYears, isLoading: yearsLoading } = trpc.elite.getAvailableYears.useQuery();
  const { data: historyData, isLoading: historyLoading } = trpc.elite.getHistoryByYear.useQuery({ year: selectedYear });
  const { data: cycleInfoList = [] } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: balances = [] } = trpc.elite.getAllBalances.useQuery();

  // 建立 balance map
  const balanceMap = useMemo(() => {
    const map: Record<number, any> = {};
    balances.forEach((b: any) => { if (b) map[b.studentId] = b; });
    return map;
  }, [balances]);

  // 點名 mutation
  const upsertAttendanceMutation = trpc.elite.upsertAttendance.useMutation({
    onSuccess: () => {
      utils.elite.getHistoryByYear.invalidate();
      utils.elite.getAllCycleInfo.invalidate();
    },
  });

  // 取消/恢復課堂 mutation
  const cancelScheduleMutation = trpc.elite.cancelSchedule.useMutation({
    onSuccess: () => {
      utils.elite.getHistoryByYear.invalidate();
      toast.success("已取消課堂");
    },
  });
  const activateScheduleMutation = trpc.elite.activateSchedule.useMutation({
    onSuccess: () => {
      utils.elite.getHistoryByYear.invalidate();
      toast.success("已恢復課堂");
    },
  });

  // 建立循環資訊 map
  const cycleMap = useMemo(() => {
    const map: Record<number, any> = {};
    cycleInfoList.forEach((c: any) => {
      map[c.studentId] = c;
    });
    return map;
  }, [cycleInfoList]);

  const allSchedules = useMemo(() => {
    if (!historyData?.schedules) return [];
    return [...historyData.schedules].sort((a: any, b: any) =>
      new Date(a.trainingDate).getTime() - new Date(b.trainingDate).getTime()
    );
  }, [historyData?.schedules]);

  const yearSchedules = useMemo(() => {
    return allSchedules.filter((s: any) => s.status !== 'cancelled');
  }, [allSchedules]);

  // 當年份改變時重置 startIndex
  useEffect(() => {
    setStartIndex(0);
  }, [selectedYear]);

  // 可見的 schedules（當前窗口）
  const visibleSchedules = useMemo(() => {
    return allSchedules.slice(startIndex, startIndex + VISIBLE_COLUMNS);
  }, [allSchedules, startIndex]);

  const totalSchedules = allSchedules.length;
  const maxStartIndex = Math.max(0, totalSchedules - VISIBLE_COLUMNS);

  const attendanceMap = useMemo(() => {
    if (!historyData?.attendance) return new Map<string, string>();
    const map = new Map<string, string>();
    historyData.attendance.forEach((a: any) => {
      map.set(`${a.scheduleId}-${a.studentId}`, a.status);
    });
    return map;
  }, [historyData?.attendance]);

  const students = useMemo(() => {
    if (!historyData?.students) return [];
    return historyData.students.filter((s: any) => s.status === 'active');
  }, [historyData?.students]);

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatFullDate = (date: string | Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const isStudentJoined = (student: any, scheduleDate: string | Date) => {
    if (!student.joinDate) return true;
    const joinDate = new Date(student.joinDate);
    const sDate = new Date(scheduleDate);
    joinDate.setHours(0, 0, 0, 0);
    sDate.setHours(0, 0, 0, 0);
    return sDate >= joinDate;
  };

  // 點擊格子切換出席狀態
  function toggleAttendance(scheduleId: number, studentId: number) {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    const next = !current ? "present" : current === "present" ? "excused" : null;
    if (next === null) {
      // excused -> 未記錄: delete attendance
      upsertAttendanceMutation.mutate({ scheduleId, studentId, status: "absent" });
      return;
    }
    upsertAttendanceMutation.mutate({ scheduleId, studentId, status: next });
  }

  // 計算每位學生的統計（全年）
  const studentStats = useMemo(() => {
    const stats = new Map<number, { present: number; excused: number; total: number }>();
    students.forEach((student: any) => {
      let present = 0;
      let excused = 0;
      let total = 0;
      yearSchedules.forEach((schedule: any) => {
        if (isStudentJoined(student, schedule.trainingDate)) {
          total++;
          const key = `${schedule.id}-${student.id}`;
          const status = attendanceMap.get(key);
          if (status === 'present' || status === 'late') {
            present++;
          } else if (status === 'excused') {
            excused++;
          }
        }
      });
      stats.set(student.id, { present, excused, total });
    });
    return stats;
  }, [students, yearSchedules, attendanceMap]);

  // 年份統計
  const yearStats = useMemo(() => {
    let totalPresent = 0;
    let totalExcused = 0;
    let totalSlots = 0;
    studentStats.forEach((stat) => {
      totalPresent += stat.present;
      totalExcused += stat.excused;
      totalSlots += stat.total;
    });
    return { totalPresent, totalExcused, totalSlots, scheduleDays: yearSchedules.length };
  }, [studentStats, yearSchedules]);

  // 統計需要繳費提醒的學生數
  const needPaymentStudents = students.filter((s: any) => {
    const cycle = cycleMap[s.id];
    return cycle && cycle.needPaymentReminder;
  });

  // 導航函數
  const goLeft = () => setStartIndex(i => Math.max(0, i - VISIBLE_COLUMNS));
  const goRight = () => setStartIndex(i => Math.min(maxStartIndex, i + VISIBLE_COLUMNS));
  const goFirst = () => setStartIndex(0);
  const goLast = () => setStartIndex(maxStartIndex);

  if (yearsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 年份選擇器 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          精英班點名表
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(y => y - 1)}
            disabled={!availableYears || selectedYear <= Math.min(...(availableYears || [2022]))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-bold min-w-[80px] text-center">{selectedYear} 年</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={!availableYears || selectedYear >= Math.max(...(availableYears || [2026]))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 年份快速選擇 */}
      <div className="flex gap-2 flex-wrap">
        {(availableYears || []).map((year: number) => (
          <Button
            key={year}
            variant={selectedYear === year ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedYear(year)}
          >
            {year}
          </Button>
        ))}
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{yearStats.scheduleDays}</div>
            <div className="text-xs text-muted-foreground">訓練日數</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{yearStats.totalPresent}</div>
            <div className="text-xs text-muted-foreground">總出席人次</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{yearStats.totalExcused}</div>
            <div className="text-xs text-muted-foreground">總請假人次</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {yearStats.totalSlots > 0 ? Math.round((yearStats.totalPresent / yearStats.totalSlots) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">整體出席率</div>
          </CardContent>
        </Card>
        {needPaymentStudents.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{needPaymentStudents.length}</div>
              <div className="text-xs text-orange-600">需繳費提醒</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 日期導航控制 */}
      {totalSchedules > 0 && (
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goFirst} disabled={startIndex === 0} title="第一頁">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goLeft} disabled={startIndex === 0} title="上一頁">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            顯示第 <span className="font-bold text-foreground">{startIndex + 1}</span> - <span className="font-bold text-foreground">{Math.min(startIndex + VISIBLE_COLUMNS, totalSchedules)}</span> 堂 / 共 <span className="font-bold text-foreground">{totalSchedules}</span> 堂
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goRight} disabled={startIndex >= maxStartIndex} title="下一頁">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goLast} disabled={startIndex >= maxStartIndex} title="最後一頁">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 出席表格 */}
      {historyLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div ref={tableContainerRef} className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-muted border-b">
                    <th className="sticky left-0 z-40 bg-muted px-2 py-2 text-left font-medium w-[40px] min-w-[40px] border-r border-b">#</th>
                    <th className="sticky left-[40px] z-40 bg-muted px-2 py-2 text-left font-medium w-[90px] min-w-[90px] border-r border-b">姓名</th>
                    {visibleSchedules.map((schedule: any) => {
                      const isCancelled = schedule.status === 'cancelled';
                      return (
                        <th
                          key={schedule.id}
                          className={`px-1 py-1 text-center font-medium min-w-[56px] w-[56px] border-r border-b ${
                            isCancelled ? 'bg-gray-300 text-gray-500 line-through' : 'bg-muted'
                          }`}
                          title={`${formatFullDate(schedule.trainingDate)}${isCancelled ? ' (已取消)' : ''}`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[11px]">{formatDate(schedule.trainingDate)}</span>
                            {!isCancelled ? (
                              <button
                                className="text-red-400 hover:text-red-600 opacity-40 hover:opacity-100"
                                title="取消課堂"
                                onClick={() => cancelScheduleMutation.mutate({ id: schedule.id })}
                              >
                                <Ban className="h-3 w-3" />
                              </button>
                            ) : (
                              <button
                                className="text-green-500 hover:text-green-700 opacity-60 hover:opacity-100"
                                title="恢復課堂"
                                onClick={() => activateScheduleMutation.mutate({ id: schedule.id })}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-center font-medium min-w-[55px] bg-purple-100 border-r border-b">循環</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-blue-100 border-r border-b">出席</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-red-100 border-r border-b">請假</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[55px] bg-green-100 border-r border-b">出席率</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-orange-100 border-b">通知</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student: any, index: number) => {
                    const stats = studentStats.get(student.id) || { present: 0, excused: 0, total: 0 };
                    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
                    const cycle = cycleMap[student.id];
                    const cycleNum = cycle?.cycleNumber || 0;
                    const needReminder = cycle?.needPaymentReminder || false;

                    return (
                      <tr key={student.id} className={`${needReminder ? 'bg-orange-50/60' : 'hover:bg-muted/30'}`}>
                        <td className={`sticky left-0 z-10 px-2 py-1.5 font-medium text-muted-foreground border-r border-b ${needReminder ? 'bg-orange-50' : 'bg-background'}`}>
                          {index + 1}
                        </td>
                        <td className={`sticky left-[40px] z-10 px-2 py-1.5 font-medium whitespace-nowrap border-r border-b ${needReminder ? 'bg-orange-50' : 'bg-background'}`}>
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[70px]">{student.name}</span>
                            {needReminder && <span className="text-orange-500 text-xs">💰</span>}
                          </div>
                        </td>
                        {visibleSchedules.map((schedule: any) => {
                          const isCancelled = schedule.status === 'cancelled';
                          const joined = isStudentJoined(student, schedule.trainingDate);
                          const key = `${schedule.id}-${student.id}`;
                          const status = attendanceMap.get(key);

                          if (isCancelled) {
                            return (
                              <td key={schedule.id} className="px-1 py-1.5 text-center bg-gray-200 border-r border-b">
                                <span className="text-gray-400">—</span>
                              </td>
                            );
                          }

                          if (!joined) {
                            return (
                              <td
                                key={schedule.id}
                                className="px-1 py-1.5 text-center bg-gray-900 border-r border-b"
                                title="未加入"
                              >
                                <span className="text-gray-900">■</span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={schedule.id}
                              className={`px-1 py-1.5 text-center cursor-pointer transition-colors border-r border-b ${
                                status === 'present'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : status === 'excused'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                              }`}
                              title={`${student.name} - ${formatFullDate(schedule.trainingDate)}: ${
                                status === 'present' ? '出席' : status === 'excused' ? '請假' : '未記錄'
                              }（點擊切換）`}
                              onClick={() => toggleAttendance(schedule.id, student.id)}
                            >
                              {status === 'present' ? '✅' : status === 'excused' ? '❌' : '·'}
                            </td>
                          );
                        })}
                        {/* 循環堂數 */}
                        <td className="px-2 py-1.5 text-center bg-purple-50 border-r border-b">
                          {cycleNum > 0 ? (
                            <Badge
                              variant={needReminder ? "destructive" : "outline"}
                              className={`font-bold text-[10px] ${
                                cycleNum >= 10
                                  ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                                  : cycleNum >= 7
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-400"
                                  : ""
                              }`}
                            >
                              {cycleNum}/12
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-[10px]">0/12</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-medium bg-blue-50 text-blue-700 border-r border-b">
                          {stats.present}
                        </td>
                        <td className="px-2 py-1.5 text-center font-medium bg-red-50 text-red-700 border-r border-b">
                          {stats.excused}
                        </td>
                        <td className={`px-2 py-1.5 text-center font-medium bg-green-50 border-r border-b ${
                          rate >= 90 ? 'text-green-700' : rate >= 70 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {stats.total > 0 ? `${rate}%` : '-'}
                        </td>
                        <td className="px-1 py-0.5 text-center bg-orange-50/30 border-b">
                          {(() => {
                            const bal = balanceMap[student.id];
                            if (!bal || bal.remainingClasses > 3) return null;
                            return (
                              <EliteWhatsAppButton
                                studentId={student.id}
                                studentName={student.name}
                                studentPhone={student.phone || ''}
                                remainingClasses={bal.remainingClasses}
                                paidClasses={bal.paidClasses}
                                attendedClasses={bal.attendedClasses}
                                feePerClass={student.feePerClass || '200'}
                                size="sm"
                                variant="ghost"
                                showLabel={false}
                              />
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-100 border rounded flex items-center justify-center">✅</div>
          <span>出席</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-100 border rounded flex items-center justify-center">❌</div>
          <span>請假</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-50 border rounded flex items-center justify-center text-yellow-600">·</div>
          <span>未記錄（點擊切換）</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-900 border rounded"></div>
          <span>未加入</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-200 border rounded flex items-center justify-center text-gray-400">—</div>
          <span>已取消課堂</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="text-muted-foreground">堂數循環：</span>
        <span><Badge variant="outline" className="text-[10px]">1-6/12</Badge> 正常</span>
        <span><Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-400">7-9/12</Badge> 接近完成</span>
        <span><Badge variant="outline" className="text-[10px] bg-orange-500 text-white border-orange-500">10-12/12</Badge> 請通知家長繳下期費用 $2,400</span>
        <span>💰 需繳費</span>
      </div>
    </div>
  );
}
