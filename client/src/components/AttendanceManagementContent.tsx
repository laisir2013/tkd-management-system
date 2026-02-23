import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ClassSelectionPage } from "./ClassSelectionPage";
import { AttendanceTablePage } from "./AttendanceTablePage";

type ViewMode = "classSelection" | "attendanceTable";

interface SelectedClass {
  venue: string;
  day: string;
  time: string;
}

export function AttendanceManagementContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("classSelection");
  const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(null);

  // 使用 year 和 month 數字來避免時區問題
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12

  // 用於顯示的 Date 對象（僅用於 UI 顯示，不傳到後端）
  const displayDate = useMemo(() => new Date(selectedYear, selectedMonth - 1, 1), [selectedYear, selectedMonth]);

  // 月份切換處理
  const handleMonthChange = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      const today = new Date();
      setSelectedYear(today.getFullYear());
      setSelectedMonth(today.getMonth() + 1);
    } else if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedYear(selectedYear - 1);
        setSelectedMonth(12);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedYear(selectedYear + 1);
        setSelectedMonth(1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  // 查詢所有班別分組
  const { data: classGroups } = trpc.attendance.getAllClassGroups.useQuery();

  // 查詢所有學生
  const { data: allStudents } = trpc.students.getAll.useQuery();

  // 查詢道場列表（用於取得教練對應）
  const { data: dojos } = trpc.dojos.getAll.useQuery();

  // 自動生成當月訓練日期的 mutation
  const generateMonthly = trpc.attendance.generateMonthlySchedules.useMutation({
    onSuccess: () => {
      // 生成成功後重新查詢訓練日期
      trainingSchedulesQuery.refetch();
    },
  });

  // 查詢選擇月份的訓練日期 - 不傳 status，查詢所有狀態（包含 cancelled）
  const trainingSchedulesQuery = trpc.attendance.getTrainingSchedules.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
      // 不傳 status，讓後端返回所有狀態的訓練日期
    }
  );
  const trainingSchedules = trainingSchedulesQuery.data;

  // 當月份改變時，自動生成該月的訓練日期
  useEffect(() => {
    generateMonthly.mutate({ year: selectedYear, month: selectedMonth });
  }, [selectedYear, selectedMonth]);

  // 查詢選擇月份的出席記錄 - 直接傳 year 和 month 數字
  const { data: attendanceRecords } = trpc.attendance.getAttendanceRecords.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
    },
    {
      enabled: viewMode === "attendanceTable" && !!selectedClass,
    }
  );

  // 處理班別選擇
  const handleSelectClass = (venue: string, day: string, time: string) => {
    setSelectedClass({ venue, day, time });
    setViewMode("attendanceTable");
  };

  // 返回班別選擇頁
  const handleBack = () => {
    setViewMode("classSelection");
    setSelectedClass(null);
  };

  // 準備班別選擇頁的資料，排除精英班
  const classesForSelection = useMemo(() => {
    if (!classGroups || !allStudents) return [];

    // 建立道場→教練的對應
    const dojoCoachMap = new Map<string, string>();
    (dojos || []).forEach((d: any) => {
      if (d.name && d.coachName) dojoCoachMap.set(d.name, d.coachName);
    });

    return classGroups
      .filter((group: { venue: string; scheduleDay: string; scheduleTime: string }) => 
        group.venue !== '精英班道場' // 排除精英班
      )
      .map((group: { venue: string; scheduleDay: string; scheduleTime: string }) => {
        const classStudents = allStudents.filter(
          (s) =>
            s.venue === group.venue &&
            s.scheduleDay === group.scheduleDay &&
            s.scheduleTime === group.scheduleTime
        );
        // 優先使用學生的 coach，其次使用道場的 coachName
        const coach = classStudents[0]?.coach || dojoCoachMap.get(group.venue) || '';
        return {
          venue: group.venue,
          day: group.scheduleDay,
          time: group.scheduleTime,
          studentCount: classStudents.length,
          coach,
        };
      });
  }, [classGroups, allStudents]);

  // 準備點名表格頁的資料
  const studentsForTable = useMemo(() => {
    if (!selectedClass || !allStudents) return [];

    return allStudents
      .filter(
        (s) =>
          s.venue === selectedClass.venue &&
          s.scheduleDay === selectedClass.day &&
          s.scheduleTime === selectedClass.time
      )
      .map((s) => ({ id: s.id, name: s.name }));
  }, [selectedClass, allStudents]);

  // 準備訓練日期（包含 cancelled 狀態）
  const trainingDatesForTable = useMemo(() => {
    if (!selectedClass || !trainingSchedules) return [];

    // 使用 Map 去重，確保每個日期只出現一次
    const dateMap = new Map<string, { date: Date; scheduleId: number; status: string }>();

    trainingSchedules
      .filter(
        (schedule) =>
          schedule.venue === selectedClass.venue &&
          schedule.scheduleDay === selectedClass.day &&
          schedule.scheduleTime === selectedClass.time
      )
      .forEach((schedule) => {
        const dateKey = new Date(schedule.trainingDate).toISOString().split('T')[0];
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: new Date(schedule.trainingDate),
            scheduleId: schedule.id,
            status: schedule.status, // 包含 active 或 cancelled
          });
        }
      });

    return Array.from(dateMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedClass, trainingSchedules]);

  const attendanceRecordsForTable = useMemo(() => {
    if (!attendanceRecords) return [];

    return attendanceRecords.map((record) => ({
      studentId: record.studentId,
      attendanceDate: new Date(record.attendanceDate),
      status: record.status,
    }));
  }, [attendanceRecords]);

  // 取消/恢復課堂後重新查詢
  const handleScheduleStatusChanged = () => {
    trainingSchedulesQuery.refetch();
  };

  // 渲染當前視圖
  if (viewMode === "classSelection") {
    return <ClassSelectionPage classes={classesForSelection} onSelectClass={handleSelectClass} />;
  }

  if (viewMode === "attendanceTable" && selectedClass) {
    return (
      <AttendanceTablePage
        venue={selectedClass.venue}
        day={selectedClass.day}
        time={selectedClass.time}
        students={studentsForTable}
        trainingDates={trainingDatesForTable}
        attendanceRecords={attendanceRecordsForTable}
        selectedMonth={displayDate}
        onMonthChange={handleMonthChange}
        onBack={handleBack}
        onScheduleStatusChanged={handleScheduleStatusChanged}
      />
    );
  }

  return null;
}
