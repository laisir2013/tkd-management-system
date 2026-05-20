import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar, Ban, RotateCcw, X, CheckSquare, Square, Users } from "lucide-react";
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
  // 季度模式：1=1-3月, 2=4-6月, 3=7-9月, 4=10-12月
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((now.getMonth() + 1) / 3));

  const { data: availableYears, isLoading: yearsLoading } = trpc.elite.getAvailableYears.useQuery();
  const { data: historyData, isLoading: historyLoading } = trpc.elite.getHistoryByYear.useQuery({ year: selectedYear });
  const { data: cycleInfoList = [] } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: balances = [] } = trpc.elite.getAllBalances.useQuery();

  // ── 批量點名模式 ──
  const [batchMode, setBatchMode] = useState(false);
  // selectedCells: Set of "scheduleId-studentId" keys
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const batchMutation = trpc.elite.batchUpsertAttendance.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量更新 ${data.count} 條記錄`);
      setSelectedCells(new Set());
      setBatchMode(false);
      Promise.all([
        utils.elite.getHistoryByYear.invalidate(),
        utils.elite.getAllCycleInfo.invalidate(),
        utils.elite.getAllBalances.invalidate(),
      ]);
    },
    onError: (err: any) => toast.error(`批量更新失敗：${err.message}`),
  });

  const toggleCellSelection = useCallback((scheduleId: number, studentId: number) => {
    const key = `${scheduleId}-${studentId}`;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllForSchedule = useCallback((scheduleId: number, studentIds: number[]) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = studentIds.every(sid => next.has(`${scheduleId}-${sid}`));
      studentIds.forEach(sid => {
        const key = `${scheduleId}-${sid}`;
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }, []);

  const selectAllForStudent = useCallback((studentId: number, scheduleIds: number[]) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = scheduleIds.every(sid => next.has(`${sid}-${studentId}`));
      scheduleIds.forEach(sid => {
        const key = `${sid}-${studentId}`;
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }, []);

  const applyBatchStatus = useCallback((status: string) => {
    if (selectedCells.size === 0) { toast.warning("請先選擇要點名的格子"); return; }
    const entries = Array.from(selectedCells).map(key => {
      const [scheduleId, studentId] = key.split('-').map(Number);
      return { scheduleId, studentId, status };
    });
    batchMutation.mutate({ entries });
  }, [selectedCells, batchMutation]);

  // 確認點名：被選的標記為 present，同一堂課未被選的自動標記為 absent
  const applyBatchConfirm = useCallback(() => {
    if (selectedCells.size === 0) { toast.warning("請先選擇出席的學生"); return; }

    // 找出所有涉及的 scheduleId
    const selectedKeys = Array.from(selectedCells);
    const scheduleIdsSet = new Set<number>();
    selectedKeys.forEach(key => {
      const scheduleId = Number(key.split('-')[0]);
      scheduleIdsSet.add(scheduleId);
    });

    const entries: Array<{ scheduleId: number; studentId: number; status: string }> = [];

    // 對每個涉及的堂課，找出所有應到學生
    for (const scheduleId of scheduleIdsSet) {
      // 找到對應的 schedule 資料（取訓練日期）
      const schedule = allSchedules.find((s: any) => s.id === scheduleId);
      if (!schedule || schedule.status === 'cancelled') continue;

      // 取得該堂課所有應到學生（A班 + B班，已加入且 active）
      const eligibleStudents = allActiveStudents.filter((s: any) => 
        isStudentJoined(s, schedule.trainingDate)
      );

      for (const student of eligibleStudents) {
        const key = `${scheduleId}-${student.id}`;
        if (selectedCells.has(key)) {
          // 被選中 → 出席
          entries.push({ scheduleId, studentId: student.id, status: 'present' });
        } else {
          // 未被選中 → 缺席
          entries.push({ scheduleId, studentId: student.id, status: 'absent' });
        }
      }
    }

    if (entries.length === 0) { toast.warning("沒有需要更新的記錄"); return; }
    const presentCount = entries.filter(e => e.status === 'present').length;
    const absentCount = entries.filter(e => e.status === 'absent').length;
    toast.info(`點名中：${presentCount} 位出席，${absentCount} 位缺席`);
    batchMutation.mutate({ entries });
  }, [selectedCells, batchMutation, allSchedules, allActiveStudents, isStudentJoined]);

  // balance map
  const balanceMap = useMemo(() => {
    const map: Record<number, any> = {};
    balances.forEach((b: any) => { if (b) map[b.studentId] = b; });
    return map;
  }, [balances]);

  // Optimistic update: local overlay for instant UI feedback
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, string>>(new Map());

  // Track in-flight mutations to avoid premature clearing
  const inflightCount = useRef(0);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      // Only refetch when ALL mutations have completed
      if (inflightCount.current > 0) {
        // Still have in-flight mutations, re-schedule
        scheduleInvalidate();
        return;
      }
      // Refetch server data, then clear ALL optimistic entries
      Promise.all([
        utils.elite.getHistoryByYear.invalidate(),
        utils.elite.getAllCycleInfo.invalidate(),
        utils.elite.getAllBalances.invalidate(),
      ]).then(() => {
        // Server data is now fresh — clear optimistic overlay completely
        setOptimisticUpdates(new Map());
      });
    }, 800);
  }, [utils]);

  // mutations with optimistic update
  const upsertAttendanceMutation = trpc.elite.upsertAttendance.useMutation({
    onMutate: () => {
      inflightCount.current++;
    },
    onSuccess: (_data, _variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      scheduleInvalidate();
    },
    onError: (err: any, variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      // Revert optimistic entry immediately on error
      const key = `${variables.scheduleId}-${variables.studentId}`;
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error(`點名更新失敗：${err.message}`);
      scheduleInvalidate();
    },
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

  // 季度的3個月份
  const quarterMonths = useMemo(() => {
    const startMonth = (selectedQuarter - 1) * 3 + 1;
    return [startMonth, startMonth + 1, startMonth + 2];
  }, [selectedQuarter]);

  // 按季度過濾 schedules（3個月）
  const getQuarterSchedules = () => {
    return allSchedules.filter((s: any) => {
      const d = new Date(s.trainingDate);
      const month = d.getMonth() + 1;
      return quarterMonths.includes(month);
    });
  };

  // A班和B班共用相同訓練日期
  const quarterSchedulesA = useMemo(() => getQuarterSchedules(), [allSchedules, quarterMonths]);
  const quarterSchedulesB = useMemo(() => getQuarterSchedules(), [allSchedules, quarterMonths]);

  // attendance map (server data)
  const serverAttendanceMap = useMemo(() => {
    if (!historyData?.attendance) return new Map<string, string>();
    const map = new Map<string, string>();
    historyData.attendance.forEach((a: any) => {
      map.set(`${a.scheduleId}-${a.studentId}`, a.status);
    });
    return map;
  }, [historyData?.attendance]);

  // Merged attendance map: optimistic updates override server data
  const attendanceMap = useMemo(() => {
    const merged = new Map(serverAttendanceMap);
    optimisticUpdates.forEach((status, key) => {
      merged.set(key, status);
    });
    return merged;
  }, [serverAttendanceMap, optimisticUpdates]);

  // 後端返回的循環堂數映射：key="scheduleId-studentId" → 循環內堂數(1-12)
  const serverCycleNumberMap = useMemo(() => {
    if (!historyData?.cycleNumberMap) return {} as Record<string, number>;
    return historyData.cycleNumberMap as Record<string, number>;
  }, [historyData?.cycleNumberMap]);

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

  // ---- Undo stack for accidental changes ----
  const [undoStack, setUndoStack] = useState<Array<{ scheduleId: number; studentId: number; prevStatus: string | undefined; studentName: string; date: string }>>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear undo stack after 8 seconds of inactivity
  useEffect(() => {
    if (undoStack.length > 0) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoStack([]), 8000);
    }
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoStack]);

  const undoLast = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const key = `${last.scheduleId}-${last.studentId}`;
    const restoreStatus = last.prevStatus || 'absent';
    setOptimisticUpdates(prev => {
      const updated = new Map(prev);
      updated.set(key, restoreStatus);
      return updated;
    });
    upsertAttendanceMutation.mutate({ scheduleId: last.scheduleId, studentId: last.studentId, status: restoreStatus });
    setUndoStack(prev => prev.slice(0, -1));
    toast.success('已撤回');
  }, [undoStack, upsertAttendanceMutation]);

  // ---- Popup menu for choosing attendance status ----
  const [popupCell, setPopupCell] = useState<{ scheduleId: number; studentId: number; studentName: string; dateStr: string; rect: { top: number; left: number; width: number } } | null>(null);

  // ---- Long-press detection for protecting existing records ----
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const setStatus = useCallback((scheduleId: number, studentId: number, studentName: string, dateStr: string, newStatus: string) => {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    // Save undo info
    setUndoStack(prev => [...prev.slice(-9), { scheduleId, studentId, prevStatus: current, studentName, date: dateStr }]);
    // Optimistic update
    setOptimisticUpdates(prev => {
      const updated = new Map(prev);
      updated.set(key, newStatus);
      return updated;
    });
    upsertAttendanceMutation.mutate({ scheduleId, studentId, status: newStatus });
    const statusLabel = newStatus === 'present' ? '出席' : newStatus === 'excused' ? '請假' : '未記錄';
    toast(`${studentName} ${dateStr}: ${statusLabel}`, {
      action: { label: '撤回', onClick: () => {
        const restoreStatus = current || 'absent';
        setOptimisticUpdates(prev2 => {
          const up = new Map(prev2);
          up.set(key, restoreStatus);
          return up;
        });
        upsertAttendanceMutation.mutate({ scheduleId, studentId, status: restoreStatus });
        setUndoStack(prev2 => prev2.filter(u => !(u.scheduleId === scheduleId && u.studentId === studentId)));
      }},
      duration: 5000,
    });
    setPopupCell(null);
  }, [attendanceMap, upsertAttendanceMutation]);

  const handleCellClick = useCallback((e: React.MouseEvent | React.TouchEvent, scheduleId: number, studentId: number, studentName: string, dateStr: string) => {
    // 如果長按已觸發 popup，跳過 click
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    // If no record or absent: show popup to choose present or excused
    if (!current || current === 'absent') {
      const target = (e.target as HTMLElement).closest('td');
      if (target) {
        const rect = target.getBoundingClientRect();
        setPopupCell({ scheduleId, studentId, studentName, dateStr, rect: { top: rect.bottom, left: rect.left, width: rect.width } });
      }
    } else {
      // Already has a record (present/excused): show hint
      toast.warning(`⚠️ ${studentName} 已標記為${current === 'present' ? '出席' : '請假'}，右鍵或長按可修改`, { duration: 2000 });
    }
  }, [attendanceMap]);

  // 右鍵點擊（電腦版）：直接打開修改選單
  const handleContextMenu = useCallback((e: React.MouseEvent, scheduleId: number, studentId: number, studentName: string, dateStr: string) => {
    e.preventDefault();
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    // 無記錄也允許右鍵打開選單
    const target = (e.target as HTMLElement).closest('td');
    if (target) {
      const rect = target.getBoundingClientRect();
      setPopupCell({ scheduleId, studentId, studentName, dateStr, rect: { top: rect.bottom, left: rect.left, width: rect.width } });
    }
  }, [attendanceMap]);

  const handleLongPressStart = useCallback((e: React.TouchEvent | React.MouseEvent, scheduleId: number, studentId: number, studentName: string, dateStr: string) => {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap.get(key);
    // Only need long-press protection for existing records
    if (!current || current === 'absent') return;
    longPressTriggered.current = false;
    if ('touches' in e) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      // Long-press on existing record: show popup to change
      const target = (e.target as HTMLElement).closest('td');
      if (target) {
        const rect = target.getBoundingClientRect();
        setPopupCell({ scheduleId, studentId, studentName, dateStr, rect: { top: rect.bottom, left: rect.left, width: rect.width } });
      }
    }, 500);
  }, [attendanceMap]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current && longPressTimerRef.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    if (!popupCell) return;
    const handleClickOutside = () => setPopupCell(null);
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 10);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClickOutside); };
  }, [popupCell]);

  // 按班別計算統計（季度）
  const getQuarterStats = (students: any[], quarterSchedules: any[]) => {
    const activeSchedules = quarterSchedules.filter((s: any) => s.status !== 'cancelled');
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

  const statsA = useMemo(() => getQuarterStats(studentsA, quarterSchedulesA), [studentsA, quarterSchedulesA, attendanceMap]);
  const statsB = useMemo(() => getQuarterStats(studentsB, quarterSchedulesB), [studentsB, quarterSchedulesB, attendanceMap]);

  // 季度導航
  const goPrevQuarter = () => {
    if (selectedQuarter === 1) { setSelectedYear(y => y - 1); setSelectedQuarter(4); }
    else { setSelectedQuarter(q => q - 1); }
  };
  const goNextQuarter = () => {
    if (selectedQuarter === 4) { setSelectedYear(y => y + 1); setSelectedQuarter(1); }
    else { setSelectedQuarter(q => q + 1); }
  };

  const minYear = availableYears ? Math.min(...availableYears) : 2022;
  const maxYear = availableYears ? Math.max(...availableYears) : 2026;
  const canGoPrev = selectedYear > minYear || selectedQuarter > 1;
  const canGoNext = selectedYear < maxYear || selectedQuarter < 4;

  const quartersWithData = useMemo(() => {
    const quarters = new Set<number>();
    allSchedules.forEach((s: any) => {
      const m = new Date(s.trainingDate).getMonth() + 1;
      quarters.add(Math.ceil(m / 3));
    });
    return Array.from(quarters).sort((a, b) => a - b);
  }, [allSchedules]);

  const QUARTER_LABELS = ['', '1-3月', '4-6月', '7-9月', '10-12月'];
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

  // 計算每月的 schedule 分組，用於在表格中加入月份分隔
  const groupSchedulesByMonth = (schedules: any[]) => {
    const groups: { month: number; schedules: any[] }[] = [];
    let currentMonth = -1;
    for (const s of schedules) {
      const m = new Date(s.trainingDate).getMonth() + 1;
      if (m !== currentMonth) {
        currentMonth = m;
        groups.push({ month: m, schedules: [s] });
      } else {
        groups[groups.length - 1].schedules.push(s);
      }
    }
    return groups;
  };

  // 渲染單班表格
  const renderClassTable = (
    className: string,
    classLabel: string,
    classTime: string,
    headerColor: string,
    quarterSchedules: any[],
    students: any[],
    stats: ReturnType<typeof getQuarterStats>,
  ) => {
    // 按教練分組排序
    const sortedStudents = [...students].sort((a: any, b: any) => {
      const coachA = a.coach || '';
      const coachB = b.coach || '';
      if (coachA !== coachB) return coachA.localeCompare(coachB, 'zh');
      return (a.name || '').localeCompare(b.name || '', 'zh');
    });

    const monthGroups = groupSchedulesByMonth(quarterSchedules);

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

        {quarterSchedules.length === 0 ? (
          <Card className="rounded-t-none">
            <CardContent className="py-8 text-center text-muted-foreground">
              {selectedYear}年 {QUARTER_LABELS[selectedQuarter]} 沒有訓練日
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-t-none">
            <CardContent className="p-0">
              {/* 手機版水平拖拉 */}
              <div className="overflow-auto max-h-[70vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-xs border-collapse" style={{ minWidth: `${112 + quarterSchedules.length * 48 + 200}px` }}>
                  <thead className="sticky top-0 z-30">
                    {/* 月份分組標題列 */}
                    <tr className="bg-slate-700 text-white">
                      <th className="sticky left-0 z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600 w-[32px]" rowSpan={1}></th>
                      <th className="sticky left-[32px] z-40 bg-slate-700 px-2 py-1.5 border-r border-b border-slate-600 w-[80px]" rowSpan={1}></th>
                      {monthGroups.map((group) => (
                        <th
                          key={group.month}
                          colSpan={group.schedules.length}
                          className={`px-2 py-1.5 text-center font-bold text-sm tracking-wider border-b border-slate-600 ${
                            monthGroups.length > 1 ? 'border-r-2 border-r-slate-400' : 'border-r border-r-slate-600'
                          }`}
                        >
                          {selectedYear}年{MONTH_NAMES[group.month]}
                        </th>
                      ))}
                      <th colSpan={4} className="px-2 py-1.5 text-center text-[10px] font-medium border-b border-slate-600 text-slate-300">統計</th>
                    </tr>
                    <tr className="bg-muted border-b">
                      <th className="sticky left-0 z-40 bg-muted px-1 py-2 text-center font-medium w-[32px] min-w-[32px] border-r border-b">#</th>
                      <th className="sticky left-[32px] z-40 bg-muted px-2 py-2 text-left font-medium w-[80px] min-w-[80px] border-r border-b">姓名</th>
                      {monthGroups.map((group) =>
                        group.schedules.map((schedule: any, schedIdx: number) => {
                          const isCancelled = schedule.status === 'cancelled';
                          const isLastInGroup = schedIdx === group.schedules.length - 1;
                          return (
                            <th
                              key={schedule.id}
                              className={`px-1 py-1 text-center font-medium min-w-[48px] w-[48px] border-b ${isCancelled ? 'bg-gray-300 text-gray-500 line-through' : 'bg-muted'} ${
                                isLastInGroup && monthGroups.length > 1 ? 'border-r-2 border-r-slate-300' : 'border-r'
                              }`}
                              title={`${formatFullDate(schedule.trainingDate)}${isCancelled ? ' (已取消)' : ''}`}
                            >
                              <div className="flex flex-col items-center gap-0">
                                <span className="text-[11px] font-bold">{formatDay(schedule.trainingDate)}</span>
                                <span className="text-[9px] text-muted-foreground">({getDayOfWeek(schedule.trainingDate)})</span>
                                {batchMode && !isCancelled ? (
                                  <button
                                    className="text-indigo-500 hover:text-indigo-700 mt-0.5"
                                    title="選取整列"
                                    onClick={() => {
                                      const studentIds = students.filter((s: any) => s.status === 'active' && isStudentJoined(s, schedule.trainingDate))
                                        .map((s: any) => s.id);
                                      selectAllForSchedule(schedule.id, studentIds);
                                    }}
                                  >
                                    <CheckSquare className="h-3 w-3" />
                                  </button>
                                ) : !isCancelled ? (
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
                        })
                      )}
                      <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-purple-100 border-r border-b">循環</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[38px] bg-green-100 border-r border-b" title="WhatsApp 通知">通知</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[60px] bg-indigo-100 border-r border-b">今期開始</th>
                      <th className="px-2 py-2 text-center font-medium min-w-[50px] bg-orange-100 border-b">應繳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((student: any, index: number) => {
                      const cycle = cycleMap[student.id];
                      const cycleNum = cycle?.cycleNumber || 0;
                      const bal = balanceMap[student.id];
                      const amountDue = bal?.amountDue || 0;
                      const coachColor = getCoachColor(student.coach || '');

                      // 使用後端計算的循環堂數（1-12，基於全歷史出席記錄，12堂一循環）
                      const cellNumbers: Record<number, number> = {};
                      for (const s of quarterSchedules) {
                        if (s.status === 'cancelled') continue;
                        const mapKey = `${s.id}-${student.id}`;
                        if (serverCycleNumberMap[mapKey]) {
                          cellNumbers[s.id] = serverCycleNumberMap[mapKey];
                        }
                      }

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
                          {monthGroups.map((group) =>
                            group.schedules.map((schedule: any, schedIdx: number) => {
                              const isCancelled = schedule.status === 'cancelled';
                              const joined = isStudentJoined(student, schedule.trainingDate);
                              const key = `${schedule.id}-${student.id}`;
                              const status = attendanceMap.get(key);
                              const isSelected = batchMode && selectedCells.has(key);
                              const isLastInGroup = schedIdx === group.schedules.length - 1;
                              const monthBorderClass = isLastInGroup && monthGroups.length > 1 ? 'border-r-2 border-r-slate-300' : 'border-r';

                              if (isCancelled) {
                                return (
                                  <td key={schedule.id} className={`px-1 py-1.5 text-center bg-gray-200 ${monthBorderClass} border-b`}>
                                    <span className="text-gray-400">—</span>
                                  </td>
                                );
                              }
                              if (!joined) {
                                return (
                                  <td key={schedule.id} className={`px-1 py-1.5 text-center bg-gray-900 ${monthBorderClass} border-b`} title="未加入">
                                    <span className="text-gray-900">■</span>
                                  </td>
                                );
                              }

                              if (batchMode) {
                                return (
                                  <td
                                    key={schedule.id}
                                    className={`px-1 py-1.5 text-center transition-colors ${monthBorderClass} border-b select-none cursor-pointer ${
                                      isSelected ? 'bg-indigo-200 ring-2 ring-inset ring-indigo-500'
                                      : status === 'present' ? 'bg-green-50 hover:bg-indigo-100'
                                      : status === 'excused' ? 'bg-red-50 hover:bg-indigo-100'
                                      : 'bg-yellow-50/50 hover:bg-indigo-100'
                                    }`}
                                    onClick={() => toggleCellSelection(schedule.id, student.id)}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="h-4 w-4 mx-auto text-indigo-600" />
                                    ) : (
                                      <Square className="h-4 w-4 mx-auto text-gray-300" />
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={schedule.id}
                                  className={`px-1 py-1.5 text-center transition-colors ${monthBorderClass} border-b select-none ${
                                    status === 'present' ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                                    : status === 'excused' ? 'bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer'
                                    : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 cursor-pointer'
                                  }`}
                                  title={`${student.name} - ${formatFullDate(schedule.trainingDate)}: ${
                                    status === 'present' ? `第${cellNumbers[schedule.id] || '?'}堂（右鍵或長按修改）` : status === 'excused' ? '請假（右鍵或長按修改）' : '未記錄（點擊選擇）'
                                  }`}
                                  onClick={(e) => handleCellClick(e, schedule.id, student.id, student.name, formatFullDate(schedule.trainingDate))}
                                  onMouseDown={(e) => handleLongPressStart(e, schedule.id, student.id, student.name, formatFullDate(schedule.trainingDate))}
                                  onMouseUp={handleLongPressEnd}
                                  onMouseLeave={handleLongPressEnd}
                                  onTouchStart={(e) => handleLongPressStart(e, schedule.id, student.id, student.name, formatFullDate(schedule.trainingDate))}
                                  onTouchEnd={(e) => { handleLongPressEnd(); if (longPressTriggered.current) e.preventDefault(); }}
                                  onTouchMove={handleTouchMove}
                                  onContextMenu={(e) => handleContextMenu(e, schedule.id, student.id, student.name, formatFullDate(schedule.trainingDate))}
                                >
                                  {cellNumbers[schedule.id] ? (
                                  <span className={`font-bold text-sm ${
                                    cellNumbers[schedule.id] >= 10 ? 'text-orange-600' : cellNumbers[schedule.id] >= 7 ? 'text-yellow-700' : 'text-green-700'
                                  }`}>{cellNumbers[schedule.id]}</span>
                                ) : status === 'excused' ? (
                                  <span className="text-red-400 text-sm">✗</span>
                                ) : (
                                  <span className="text-gray-300 text-lg">·</span>
                                )}
                                </td>
                              );
                            })
                          )}
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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            精英班點名表
          </h2>
          <Button
            variant={batchMode ? "default" : "outline"}
            size="sm"
            className={`h-8 text-xs ${batchMode ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
            onClick={() => { setBatchMode(!batchMode); setSelectedCells(new Set()); }}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            {batchMode ? '退出批量' : '批量點名'}
          </Button>
        </div>
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

      {/* 季度導航 */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-2 sm:px-4 py-3">
        <Button variant="ghost" size="sm" className="px-2 sm:px-3 shrink-0" onClick={goPrevQuarter} disabled={!canGoPrev}>
          <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">上季</span>
        </Button>
        <div className="text-center min-w-0">
          <span className="text-lg sm:text-xl font-bold">{selectedYear}年 {QUARTER_LABELS[selectedQuarter]}</span>
        </div>
        <Button variant="ghost" size="sm" className="px-2 sm:px-3 shrink-0" onClick={goNextQuarter} disabled={!canGoNext}>
          <span className="hidden sm:inline">下季</span><ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>

      {/* 季度快速跳轉 */}
      <div className="flex gap-1 flex-wrap">
        {quartersWithData.map((q: number) => (
          <Button
            key={q}
            variant={selectedQuarter === q ? "default" : "outline"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setSelectedQuarter(q)}
          >
            {QUARTER_LABELS[q]}
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
            <div className="text-xs text-muted-foreground">本季出席率</div>
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
          {renderClassTable('A', 'A班（12:00-2:00pm）', classTimeA, 'bg-blue-600', quarterSchedulesA, studentsA, statsA)}
          <div className="h-4" />
          {renderClassTable('B', 'B班（4:30-6:30pm）', classTimeB, 'bg-orange-600', quarterSchedulesB, studentsB, statsB)}
        </>
      )}

      {/* 批量操作浮動工具列 */}
      {batchMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-2xl border border-indigo-200">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300 font-bold">
              已選 {selectedCells.size} 格
            </Badge>
            <div className="w-px h-6 bg-gray-200" />
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
              disabled={selectedCells.size === 0 || batchMutation.isPending}
              onClick={() => applyBatchConfirm()}
            >
              ✅ 確認點名
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
              disabled={selectedCells.size === 0 || batchMutation.isPending}
              onClick={() => applyBatchStatus('present')}
            >
              僅標記出席
            </Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
              disabled={selectedCells.size === 0 || batchMutation.isPending}
              onClick={() => applyBatchStatus('excused')}
            >
              全部請假
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={selectedCells.size === 0 || batchMutation.isPending}
              onClick={() => applyBatchStatus('absent')}
            >
              全部清除
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-gray-500"
              onClick={() => { setSelectedCells(new Set()); setBatchMode(false); }}
            >
              取消
            </Button>
            {batchMutation.isPending && <span className="text-xs text-muted-foreground animate-pulse">處理中...</span>}
          </div>
        </div>
      )}

      {/* 撤回按鈕 - 浮動顯示 */}
      {undoStack.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="outline"
            size="sm"
            className="shadow-lg bg-white border-orange-300 text-orange-700 hover:bg-orange-50 gap-1.5"
            onClick={undoLast}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            撤回上一步 ({undoStack.length})
          </Button>
        </div>
      )}

      {/* 點名狀態選單 popup */}
      {popupCell && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setPopupCell(null)}
          onTouchEnd={() => setPopupCell(null)}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-1 flex gap-1"
            style={{
              top: Math.min(popupCell.rect.top + 2, window.innerHeight - 60),
              left: Math.max(4, Math.min(popupCell.rect.left - 20, window.innerWidth - 160)),
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-green-100 text-sm font-medium transition-colors"
              onClick={() => setStatus(popupCell.scheduleId, popupCell.studentId, popupCell.studentName, popupCell.dateStr, 'present')}
            >
              ✅ 出席
            </button>
            <button
              className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-red-100 text-sm font-medium transition-colors"
              onClick={() => setStatus(popupCell.scheduleId, popupCell.studentId, popupCell.studentName, popupCell.dateStr, 'excused')}
            >
              ❌ 請假
            </button>
            {(() => {
              const key = `${popupCell.scheduleId}-${popupCell.studentId}`;
              const current = attendanceMap.get(key);
              return current && current !== 'absent' ? (
                <button
                  className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-100 text-sm font-medium text-gray-500 transition-colors"
                  onClick={() => setStatus(popupCell.scheduleId, popupCell.studentId, popupCell.studentName, popupCell.dateStr, 'absent')}
                >
                  · 清除
                </button>
              ) : null;
            })()}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 text-gray-400 self-center"
              onClick={() => setPopupCell(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-100 border rounded flex items-center justify-center font-bold text-green-700 text-[10px]">1</div>
          <span>累計出席堂數</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-100 border rounded flex items-center justify-center text-red-400 text-[10px]">✗</div>
          <span>請假</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-50 border rounded flex items-center justify-center text-yellow-600">·</div>
          <span>未記錄（點擊選擇出席/請假）</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-900 border rounded"></div>
          <span>未加入</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-200 border rounded flex items-center justify-center text-gray-400">—</div>
          <span>已取消</span>
        </div>
        <div className="flex items-center gap-1 ml-2 text-orange-600 font-medium">
          <span>💡 已記錄需<strong>右鍵</strong>（電腦）或<strong>長按</strong>（手機）修改</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="text-muted-foreground">堂數顏色：</span>
        <span><span className="font-bold text-green-700">1-6</span> 正常</span>
        <span><span className="font-bold text-yellow-700">7-9</span> 接近完成</span>
        <span><span className="font-bold text-orange-600">10-12</span> 請通知家長繳下期費用 $2,400</span>
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
