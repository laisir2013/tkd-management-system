import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar, Ban, RotateCcw } from "lucide-react";
import { EliteWhatsAppButton } from "@/components/EliteWhatsAppButton";
import { EliteAttendanceWhatsAppButton } from "@/components/EliteAttendanceWhatsAppButton";

export default function EliteHistory() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const { data: availableYears, isLoading: yearsLoading } = trpc.elite.getAvailableYears.useQuery();
  const { data: historyData, isLoading: historyLoading } = trpc.elite.getHistoryByYear.useQuery({ year: selectedYear });
  const { data: cycleInfoList = [] } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: balances = [] } = trpc.elite.getAllBalances.useQuery();

  // balance map
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
      utils.elite.getAllBalances.invalidate();
    },
  });

  // 取消/恢復課堂
  const cancelScheduleMutation = trpc.elite.cancelSchedule.useMutation({
    onSuccess: () => { utils.elite.getHistoryByYear.invalidate(); toast.success("已取消課堂"); },
  });
  const activateScheduleMutation = trpc.elite.activateSchedule.useMutation({
    onSuccess: () => { utils.elite.getHistoryByYear.invalidate(); toast.success("已恢復課堂"); },
  });

  // cycle map
  const cycleMap = useMemo(() => {
    const map: Record<number, any> = {};
    cycleInfoList.forEach((c: any) => { map[c.studentId] = c; });
    return map;
  }, [cycleInfoList]);

  // 所有 schedules (排序)
  const allSchedules = useMemo(() => {
    if (!historyData?.schedules) return [];
    return [...historyData.schedules].sort((a: any, b: any) =>
      new Date(a.trainingDate).getTime() - new Date(b.trainingDate).getTime()
    );
  }, [historyData?.schedules]);

  // 當月的 schedules
  const monthSchedules = useMemo(() => {
    return allSchedules.filter((s: any) => {
      const d = new Date(s.trainingDate);
      return d.getMonth() + 1 === selectedMonth;
    });
  }, [allSchedules, selectedMonth]);

  // 當月活躍的 schedules（不含取消的，用於統計）
  const monthActiveSchedules = useMemo(() => {
    return monthSchedules.filter((s: any) => s.status !== 'cancelled');
  }, [monthSchedules]);

  // 年度活躍 schedules（用於年度統計）
  const yearActiveSchedules = useMemo(() => {
    return allSchedules.filter((s: any) => s.status !== 'cancelled');
  }, [allSchedules]);

  // attendance map
  const attendanceMap = useMemo(() => {
    if (!historyData?.attendance) return new Map<string, string>();
    const map = new Map<string, string>();
    historyData.attendance.forEach((a: any) => {
      map.set(`${a.scheduleId}-${a.studentId}`, a.status);
    });
    return map;
  }, [historyData?.attendance]);

  // active students
  const students = useMemo(() => {
    if (!historyData?.students) return [];
    return historyData.students.filter((s: any) => s.status === 'active');
  }, [historyData?.students]);

  const formatDay = (date: string | Date) => {
    const d = new Date(date);
    return `${d.getDate()}`;
  };

  const formatFullDate = (date: string | Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const getDayOfWeek = (date: string | Date) => {
    const d = new Date(date);
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[d.getDay()];
  };

  const isStudentJoined = (student: any, scheduleDate: string | Date) => {
    if (!student.joinDate) return true;
    const joinDate = new Date(student.joinDate);
    const sDate = new Date(scheduleDate);
    joinDate.setHours(0, 0, 0, 0);
    sDate.setHours(0, 0, 0, 0);
    return sDate >= joinDate;
  };

  // 點擊格子切換
  function toggleAttendance(scheduleId: number, studentId: number) {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    const next = !current ? "present" : current === "present" ? "excused" : null;
    if (next === null) {
      upsertAttendanceMutation.mutate({ scheduleId, studentId, status: "absent" });
      return;
    }
    upsertAttendanceMutation.mutate({ scheduleId, studentId, status: next });
  }

  // 當月每位學生的統計
  const studentMonthStats = useMemo(() => {
    const stats = new Map<number, { present: number; excused: number; total: number }>();
    students.forEach((student: any) => {
      let present = 0, excused = 0, total = 0;
      monthActiveSchedules.forEach((schedule: any) => {
        if (isStudentJoined(student, schedule.trainingDate)) {
          total++;
          const key = `${schedule.id}-${student.id}`;
          const status = attendanceMap.get(key);
          if (status === 'present' || status === 'late') present++;
          else if (status === 'excused') excused++;
        }
      });
      stats.set(student.id, { present, excused, total });
    });
    return stats;
  }, [students, monthActiveSchedules, attendanceMap]);

  // 當月統計
  const monthStats = useMemo(() => {
    let totalPresent = 0, totalExcused = 0, totalSlots = 0;
    studentMonthStats.forEach((stat) => {
      totalPresent += stat.present;
      totalExcused += stat.excused;
      totalSlots += stat.total;
    });
    return { totalPresent, totalExcused, totalSlots, scheduleDays: monthActiveSchedules.length };
  }, [studentMonthStats, monthActiveSchedules]);

  // 需繳費學生
  const needPaymentStudents = students.filter((s: any) => {
    const bal = balanceMap[s.id];
    return bal && bal.amountDue > 0;
  });

  // 月份導航
  const goPreMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };
  const goNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // 判斷是否可以往前/後
  const minYear = availableYears ? Math.min(...availableYears) : 2022;
  const maxYear = availableYears ? Math.max(...availableYears) : 2026;
  const canGoPrev = selectedYear > minYear || selectedMonth > 1;
  const canGoNext = selectedYear < maxYear || selectedMonth < 12;

  // 該年有哪些月份有 schedule
  const monthsWithData = useMemo(() => {
    const months = new Set<number>();
    allSchedules.forEach((s: any) => {
      const d = new Date(s.trainingDate);
      months.add(d.getMonth() + 1);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [allSchedules]);

  if (yearsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const MONTH_NAMES = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return (
    <div className="space-y-4 px-3 md:px-0">
      {/* 標題 + 年份選擇 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          精英班點名表
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(availableYears || []).map((year: number) => (
            <Button
              key={year}
              variant={selectedYear === year ? "default" : "outline"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => { setSelectedYear(year); }}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>

      {/* 月份導航 */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-2 sm:px-4 py-3">
        <Button variant="ghost" size="sm" className="px-2 sm:px-3 shrink-0" onClick={goPreMonth} disabled={!canGoPrev}>
          <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">上月</span>
        </Button>
        <div className="text-center min-w-0">
          <span className="text-lg sm:text-xl font-bold">{selectedYear}年 {MONTH_NAMES[selectedMonth]}</span>
          <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2">（{monthActiveSchedules.length} 堂）</span>
        </div>
        <Button variant="ghost" size="sm" className="px-2 sm:px-3 shrink-0" onClick={goNextMonth} disabled={!canGoNext}>
          <span className="hidden sm:inline">下月</span><ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>

      {/* 月份快速跳轉 */}
      <div className="flex gap-1 flex-wrap">
        {monthsWithData.map((m: number) => (
          <Button
            key={m}
            variant={selectedMonth === m ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setSelectedMonth(m)}
          >
            {m}月
          </Button>
        ))}
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{monthStats.scheduleDays}</div>
            <div className="text-xs text-muted-foreground">本月訓練日</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{monthStats.totalPresent}</div>
            <div className="text-xs text-muted-foreground">出席人次</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{monthStats.totalExcused}</div>
            <div className="text-xs text-muted-foreground">請假人次</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {monthStats.totalSlots > 0 ? Math.round((monthStats.totalPresent / monthStats.totalSlots) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">本月出席率</div>
          </CardContent>
        </Card>
        {needPaymentStudents.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{needPaymentStudents.length}</div>
              <div className="text-xs text-orange-600">需繳費</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 出席表格 */}
      {historyLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : monthSchedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {selectedYear}年{selectedMonth}月沒有訓練日
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div ref={tableContainerRef} className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-30">
                  {/* 年月標題 bar */}
                  <tr className="bg-slate-700 text-white">
                    <th className="sticky left-0 z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600" rowSpan={1}></th>
                    <th className="sticky left-[40px] z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600" rowSpan={1}></th>
                    <th
                      colSpan={monthSchedules.length}
                      className="px-2 py-1.5 text-center font-bold text-sm tracking-wider border-r border-b border-slate-600"
                    >
                      {selectedYear}年{selectedMonth}月
                    </th>
                    <th colSpan={6} className="px-2 py-1.5 text-center text-[10px] font-medium border-b border-slate-600 text-slate-300">統計</th>
                  </tr>
                  <tr className="bg-muted border-b">
                    <th className="sticky left-0 z-40 bg-muted px-2 py-2 text-left font-medium w-[40px] min-w-[40px] border-r border-b">#</th>
                    <th className="sticky left-[40px] z-40 bg-muted px-2 py-2 text-left font-medium w-[90px] min-w-[90px] border-r border-b">姓名</th>
                    {monthSchedules.map((schedule: any) => {
                      const isCancelled = schedule.status === 'cancelled';
                      return (
                        <th
                          key={schedule.id}
                          className={`px-1 py-1 text-center font-medium min-w-[48px] w-[48px] border-r border-b ${
                            isCancelled ? 'bg-gray-300 text-gray-500 line-through' : 'bg-muted'
                          }`}
                          title={`${formatFullDate(schedule.trainingDate)}${isCancelled ? ' (已取消)' : ''}`}
                        >
                          <div className="flex flex-col items-center gap-0">
                            <span className="text-[11px] font-bold">{formatDay(schedule.trainingDate)}</span>
                            <span className="text-[9px] text-muted-foreground">({getDayOfWeek(schedule.trainingDate)})</span>
                            {!isCancelled ? (
                              <button
                                className="text-red-400 hover:text-red-600 opacity-30 hover:opacity-100"
                                title="取消課堂"
                                onClick={() => cancelScheduleMutation.mutate({ id: schedule.id })}
                              >
                                <Ban className="h-2.5 w-2.5" />
                              </button>
                            ) : (
                              <button
                                className="text-green-500 hover:text-green-700 opacity-60 hover:opacity-100"
                                title="恢復課堂"
                                onClick={() => activateScheduleMutation.mutate({ id: schedule.id })}
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-blue-100 border-r border-b">出席</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-red-100 border-r border-b">請假</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[55px] bg-purple-100 border-r border-b">循環</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[42px] bg-green-100 border-r border-b" title="WhatsApp 通知上了第幾堂">通知</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[68px] bg-indigo-100 border-r border-b">今期開始</th>
                    <th className="px-2 py-2 text-center font-medium min-w-[55px] bg-orange-100 border-b">應繳</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student: any, index: number) => {
                    const stats = studentMonthStats.get(student.id) || { present: 0, excused: 0, total: 0 };
                    const cycle = cycleMap[student.id];
                    const cycleNum = cycle?.cycleNumber || 0;
                    const bal = balanceMap[student.id];
                    const amountDue = bal?.amountDue || 0;

                    return (
                      <tr key={student.id} className={`${amountDue > 0 ? 'bg-orange-50/40' : 'hover:bg-muted/30'}`}>
                        <td className={`sticky left-0 z-10 px-2 py-1.5 font-medium text-muted-foreground border-r border-b ${amountDue > 0 ? 'bg-orange-50' : 'bg-background'}`}>
                          {index + 1}
                        </td>
                        <td className={`sticky left-[40px] z-10 px-2 py-1.5 font-medium whitespace-nowrap border-r border-b ${amountDue > 0 ? 'bg-orange-50' : 'bg-background'}`}>
                          <span className="truncate max-w-[70px]">{student.name}</span>
                        </td>
                        {monthSchedules.map((schedule: any) => {
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
                              <td key={schedule.id} className="px-1 py-1.5 text-center bg-gray-900 border-r border-b" title="未加入">
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
                        {/* 月出席 */}
                        <td className="px-2 py-1.5 text-center font-medium bg-blue-50 text-blue-700 border-r border-b">
                          {stats.present}
                        </td>
                        {/* 月請假 */}
                        <td className="px-2 py-1.5 text-center font-medium bg-red-50 text-red-700 border-r border-b">
                          {stats.excused}
                        </td>
                        {/* 循環堂數 */}
                        <td className="px-2 py-1.5 text-center bg-purple-50 border-r border-b">
                          {cycleNum > 0 ? (
                            <Badge
                              variant="outline"
                              className={`font-bold text-[10px] ${
                                cycleNum >= 10
                                  ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                                  : cycleNum >= 7
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-400"
                                  : ""
                              }`}
                            >
                              {cycleNum}堂/12堂
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-[10px]">0堂/12堂</span>
                          )}
                        </td>
                        {/* WhatsApp 通知堂數 */}
                        <td className="px-1 py-1.5 text-center bg-green-50 border-r border-b">
                          <EliteAttendanceWhatsAppButton
                            studentId={student.id}
                            studentName={student.name}
                            studentPhone={student.phone || ''}
                            cycleNumber={cycleNum}
                            totalAttended={cycle?.totalAttended || 0}
                            lastAttendedDate={cycle?.lastAttendedDate || null}
                            amountDue={amountDue}
                          />
                        </td>
                        {/* 今期開始日期 */}
                        <td className="px-1 py-1.5 text-center bg-indigo-50 border-r border-b">
                          {cycle?.cycleStartDate ? (
                            <span className="text-[10px] text-indigo-700 font-medium whitespace-nowrap">
                              {(() => {
                                const d = new Date(cycle.cycleStartDate);
                                return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
                              })()}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </td>
                        {/* 應繳 */}
                        <td className="px-1 py-1.5 text-center border-b">
                          {amountDue > 0 ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="text-orange-600 font-bold text-[10px]">${amountDue.toLocaleString()}</span>
                              {bal && (
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
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
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
          <span>已取消</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="text-muted-foreground">循環：</span>
        <span><Badge variant="outline" className="text-[10px]">1-6堂/12堂</Badge> 正常</span>
        <span><Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-400">7-9堂/12堂</Badge> 接近</span>
        <span><Badge variant="outline" className="text-[10px] bg-orange-500 text-white border-orange-500">10-12堂/12堂</Badge> 需繳費 $2,400</span>
      </div>
    </div>
  );
}
