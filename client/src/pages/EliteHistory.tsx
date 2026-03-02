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

// 教練顏色映射
const COACH_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  '賴政堡教練': { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  '鄺富華教練': { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  '林學曉教練': { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  '何翰錕教練': { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  '許悠教練': { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const getCoachColor = (coach: string) => {
  return COACH_COLORS[coach] || { bg: 'bg-gray-50', border: 'border-l-gray-400', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800 border-gray-300' };
};

export default function EliteHistory() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

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

  // mutations
  const upsertAttendanceMutation = trpc.elite.upsertAttendance.useMutation({
    onSuccess: () => {
      utils.elite.getHistoryByYear.invalidate();
      utils.elite.getAllCycleInfo.invalidate();
      utils.elite.getAllBalances.invalidate();
    },
    onError: (err: any) => { toast.error(`點名更新失敗：${err.message}`); },
  });
  const cancelScheduleMutation = trpc.elite.cancelSchedule.useMutation({
    onSuccess: () => { utils.elite.getHistoryByYear.invalidate(); toast.success("已取消課堂"); },
    onError: (err: any) => { toast.error(`取消失敗：${err.message}`); },
  });
  const activateScheduleMutation = trpc.elite.activateSchedule.useMutation({
    onSuccess: () => { utils.elite.getHistoryByYear.invalidate(); toast.success("已恢復課堂"); },
    onError: (err: any) => { toast.error(`恢復失敗：${err.message}`); },
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

  const classTimeA = '12:00-2:00pm';
  const classTimeB = '4:30-6:30pm';

  // 按月份過濾 schedules（訓練日期兩班共用，不按 scheduleTime 過濾）
  const getMonthSchedules = () => {
    return allSchedules.filter((s: any) => {
      const d = new Date(s.trainingDate);
      return d.getMonth() + 1 === selectedMonth;
    });
  };

  // A班和B班共用相同訓練日期
  const monthSchedulesA = useMemo(() => getMonthSchedules(), [allSchedules, selectedMonth]);
  const monthSchedulesB = useMemo(() => getMonthSchedules(), [allSchedules, selectedMonth]);

  // attendance map
  const attendanceMap = useMemo(() => {
    if (!historyData?.attendance) return new Map<string, string>();
    const map = new Map<string, string>();
    historyData.attendance.forEach((a: any) => {
      map.set(`${a.scheduleId}-${a.studentId}`, a.status);
    });
    return map;
  }, [historyData?.attendance]);

  // active students split by class
  const allActiveStudents = useMemo(() => {
    if (!historyData?.students) return [];
    return historyData.students.filter((s: any) => s.status === 'active');
  }, [historyData?.students]);

  const studentsA = useMemo(() => allActiveStudents.filter((s: any) => s.scheduleTime === classTimeA), [allActiveStudents]);
  const studentsB = useMemo(() => allActiveStudents.filter((s: any) => s.scheduleTime === classTimeB), [allActiveStudents]);

  // helpers
  const formatDay = (date: string | Date) => new Date(date).getDate().toString();
  const formatFullDate = (date: string | Date) => { const d = new Date(date); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const getDayOfWeek = (date: string | Date) => ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];

  const isStudentJoined = (student: any, scheduleDate: string | Date) => {
    if (!student.joinDate) return true;
    const joinDate = new Date(student.joinDate);
    const sDate = new Date(scheduleDate);
    joinDate.setHours(0, 0, 0, 0);
    sDate.setHours(0, 0, 0, 0);
    return sDate >= joinDate;
  };

  function toggleAttendance(scheduleId: number, studentId: number) {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    const next = !current ? "present" : current === "present" ? "excused" : "absent";
    upsertAttendanceMutation.mutate({ scheduleId, studentId, status: next });
  }

  // 按班別計算統計
  const getMonthStats = (students: any[], monthSchedules: any[]) => {
    const activeSchedules = monthSchedules.filter((s: any) => s.status !== 'cancelled');
    const studentStats = new Map<number, { present: number; excused: number; total: number }>();
    let totalPresent = 0, totalExcused = 0, totalSlots = 0;
    students.forEach((student: any) => {
      let present = 0, excused = 0, total = 0;
      activeSchedules.forEach((schedule: any) => {
        if (isStudentJoined(student, schedule.trainingDate)) {
          total++;
          const key = `${schedule.id}-${student.id}`;
          const status = attendanceMap.get(key);
          if (status === 'present' || status === 'late') present++;
          else if (status === 'excused') excused++;
        }
      });
      studentStats.set(student.id, { present, excused, total });
      totalPresent += present;
      totalExcused += excused;
      totalSlots += total;
    });
    return { studentStats, totalPresent, totalExcused, totalSlots, scheduleDays: activeSchedules.length };
  };

  const statsA = useMemo(() => getMonthStats(studentsA, monthSchedulesA), [studentsA, monthSchedulesA, attendanceMap]);
  const statsB = useMemo(() => getMonthStats(studentsB, monthSchedulesB), [studentsB, monthSchedulesB, attendanceMap]);

  // 月份導航
  const goPreMonth = () => {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
    else { setSelectedMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
    else { setSelectedMonth(m => m + 1); }
  };

  const minYear = availableYears ? Math.min(...availableYears) : 2022;
  const maxYear = availableYears ? Math.max(...availableYears) : 2026;
  const canGoPrev = selectedYear > minYear || selectedMonth > 1;
  const canGoNext = selectedYear < maxYear || selectedMonth < 12;

  const monthsWithData = useMemo(() => {
    const months = new Set<number>();
    allSchedules.forEach((s: any) => { months.add(new Date(s.trainingDate).getMonth() + 1); });
    return Array.from(months).sort((a, b) => a - b);
  }, [allSchedules]);

  const MONTH_NAMES = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 需繳費 (combined)
  const needPaymentAll = allActiveStudents.filter((s: any) => {
    const bal = balanceMap[s.id];
    return bal && bal.amountDue > 0;
  });

  // 找出所有教練
  const activeCoaches = useMemo(() => {
    const coaches = new Set<string>();
    allActiveStudents.forEach((s: any) => { if (s.coach) coaches.add(s.coach); });
    return Array.from(coaches).sort();
  }, [allActiveStudents]);

  if (yearsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // 渲染單班表格
  const renderClassTable = (
    className: string,
    classLabel: string,
    classTime: string,
    headerColor: string,
    monthSchedules: any[],
    students: any[],
    stats: ReturnType<typeof getMonthStats>,
  ) => {
    // 按教練分組排序
    const sortedStudents = [...students].sort((a: any, b: any) => {
      const coachA = a.coach || '';
      const coachB = b.coach || '';
      if (coachA !== coachB) return coachA.localeCompare(coachB, 'zh');
      return (a.name || '').localeCompare(b.name || '', 'zh');
    });

    return (
      <div key={className}>
        {/* 班別標題 + 統計 */}
        <div className={`flex items-center gap-3 px-3 py-2 rounded-t-lg ${headerColor}`}>
          <h3 className="text-base font-bold text-white">{classLabel}</h3>
          <span className="text-white/80 text-sm">{students.length}人</span>
          <div className="flex-1" />
          <div className="flex gap-3 text-xs text-white/90">
            <span>{stats.scheduleDays}堂</span>
            <span>出席 {stats.totalPresent}</span>
            <span>請假 {stats.totalExcused}</span>
            <span>
              {stats.totalSlots > 0 ? Math.round((stats.totalPresent / stats.totalSlots) * 100) : 0}%
            </span>
          </div>
        </div>

        {monthSchedules.length === 0 ? (
          <Card className="rounded-t-none">
            <CardContent className="py-8 text-center text-muted-foreground">
              {selectedYear}年{selectedMonth}月沒有訓練日
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-t-none">
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[65vh]" style={{ touchAction: 'pan-x pan-y' }}>
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-700 text-white">
                      <th className="sticky left-0 z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600 w-[32px]"></th>
                      <th className="sticky left-[32px] z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600 w-[80px]"></th>
                      <th
                        colSpan={monthSchedules.length}
                        className="px-2 py-1.5 text-center font-bold text-sm tracking-wider border-r border-b border-slate-600"
                      >
                        {selectedYear}年{selectedMonth}月
                      </th>
                      <th colSpan={6} className="px-2 py-1.5 text-center text-[10px] font-medium border-b border-slate-600 text-slate-300">統計</th>
                    </tr>
                    <tr className="bg-muted border-b">
                      <th className="sticky left-0 z-40 bg-muted px-1 py-2 text-center font-medium w-[32px] min-w-[32px] border-r border-b">#</th>
                      <th className="sticky left-[32px] z-40 bg-muted px-2 py-2 text-left font-medium w-[80px] min-w-[80px] border-r border-b">姓名</th>
                      {monthSchedules.map((schedule: any) => {
                        const isCancelled = schedule.status === 'cancelled';
                        return (
                          <th
                            key={schedule.id}
                            className={`px-1 py-1 text-center font-medium min-w-[48px] w-[48px] border-r border-b ${isCancelled ? 'bg-gray-300 text-gray-500 line-through' : 'bg-muted'}`}
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
                      <th className="px-2 py-2 text-center font-medium min-w-[42px] bg-blue-100 border-r border-b">出席</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[42px] bg-red-100 border-r border-b">請假</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-purple-100 border-r border-b">循環</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[38px] bg-green-100 border-r border-b" title="WhatsApp 通知">通知</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[60px] bg-indigo-100 border-r border-b">今期開始</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-orange-100 border-b">應繳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((student: any, index: number) => {
                      const stat = stats.studentStats.get(student.id) || { present: 0, excused: 0, total: 0 };
                      const cycle = cycleMap[student.id];
                      const cycleNum = cycle?.cycleNumber || 0;
                      const bal = balanceMap[student.id];
                      const amountDue = bal?.amountDue || 0;
                      const coachColor = getCoachColor(student.coach || '');

                      return (
                        <tr key={student.id} className={`${amountDue > 0 ? 'bg-orange-50/40' : 'hover:bg-muted/30'} border-l-[3px] ${coachColor.border}`}>
                          <td className={`sticky left-0 z-10 px-1 py-1.5 text-center font-medium text-muted-foreground border-r border-b ${amountDue > 0 ? 'bg-orange-50' : 'bg-background'}`}>
                            {index + 1}
                          </td>
                          <td className={`sticky left-[32px] z-10 px-2 py-1.5 font-medium whitespace-nowrap border-r border-b ${amountDue > 0 ? 'bg-orange-50' : 'bg-background'}`}>
                            <div className="flex flex-col">
                              <span className="truncate max-w-[65px]">{student.name}</span>
                              <span className={`text-[9px] ${coachColor.text}`}>{student.coach || '-'}</span>
                            </div>
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
                                className={`px-0 py-0 text-center cursor-pointer select-none border-r border-b ${
                                  status === 'present' ? 'bg-green-100 text-green-700'
                                  : status === 'excused' ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-50 text-yellow-600'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAttendance(schedule.id, student.id);
                                }}
                              >
                                <div className="w-full min-h-[40px] flex items-center justify-center">
                                  {status === 'present' ? '✅' : status === 'excused' ? '❌' : '·'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center font-medium bg-blue-50 text-blue-700 border-r border-b">{stat.present}</td>
                          <td className="px-2 py-1.5 text-center font-medium bg-red-50 text-red-700 border-r border-b">{stat.excused}</td>
                          <td className="px-2 py-1.5 text-center bg-purple-50 border-r border-b">
                            {cycleNum > 0 ? (
                              <Badge variant="outline" className={`font-bold text-[10px] ${
                                cycleNum >= 10 ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                                : cycleNum >= 7 ? "bg-yellow-100 text-yellow-800 border-yellow-400" : ""
                              }`}>{cycleNum}/12</Badge>
                            ) : (
                              <span className="text-gray-400 text-[10px]">0/12</span>
                            )}
                          </td>
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
                          <td className="px-1 py-1.5 text-center bg-indigo-50 border-r border-b">
                            {cycle?.cycleStartDate ? (
                              <span className="text-[10px] text-indigo-700 font-medium whitespace-nowrap">
                                {(() => {
                                  const d = new Date(cycle.cycleStartDate);
                                  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
                                })()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </td>
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
      </div>
    );
  };

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

      {/* 教練圖例 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground font-medium">教練：</span>
        {activeCoaches.map((coach) => {
          const c = getCoachColor(coach);
          const countA = studentsA.filter((s: any) => s.coach === coach).length;
          const countB = studentsB.filter((s: any) => s.coach === coach).length;
          return (
            <Badge key={coach} variant="outline" className={`text-[10px] px-2 py-0.5 ${c.badge}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${c.border.replace('border-l-', 'bg-')}`}></span>
              {coach} (A:{countA} B:{countB})
            </Badge>
          );
        })}
      </div>

      {/* 總統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{allActiveStudents.length}</div>
            <div className="text-xs text-muted-foreground">總學生數</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{studentsA.length}</div>
            <div className="text-xs text-muted-foreground">A班</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{studentsB.length}</div>
            <div className="text-xs text-muted-foreground">B班</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {(statsA.totalSlots + statsB.totalSlots) > 0
                ? Math.round(((statsA.totalPresent + statsB.totalPresent) / (statsA.totalSlots + statsB.totalSlots)) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">本月出席率</div>
          </CardContent>
        </Card>
        {needPaymentAll.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{needPaymentAll.length}</div>
              <div className="text-xs text-orange-600">需繳費</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* A班 表格 */}
      {historyLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {renderClassTable('A', 'A班（12:00-2:00pm）', classTimeA, 'bg-blue-600', monthSchedulesA, studentsA, statsA)}
          <div className="h-4" />
          {renderClassTable('B', 'B班（4:30-6:30pm）', classTimeB, 'bg-orange-600', monthSchedulesB, studentsB, statsB)}
        </>
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
        <span><Badge variant="outline" className="text-[10px]">1-6/12</Badge> 正常</span>
        <span><Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-400">7-9/12</Badge> 接近</span>
        <span><Badge variant="outline" className="text-[10px] bg-orange-500 text-white border-orange-500">10-12/12</Badge> 需繳費 $2,400</span>
      </div>
    </div>
  );
}
