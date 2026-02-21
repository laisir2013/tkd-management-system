import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertTriangle, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ClassDate {
  lesson: number;
  year: number;
  month: number;
  day: number;
  date: string;
}

interface Student {
  name: string;
  startDate: string;
  attendCount: number;
  remainingLessons: number;
  paidPeriods: number;
  requiredPeriods: number;
  unpaidPeriods: number;
  unpaidFee: number;
  absenceLessons?: number[];
}

interface Data {
  classDates: ClassDate[];
  students: Student[];
}

const yearColors: Record<number, string> = {
  2022: "bg-red-500",
  2023: "bg-emerald-500",
  2024: "bg-blue-500",
  2025: "bg-amber-500",
  2026: "bg-purple-500",
};

const yearLightColors: Record<number, string> = {
  2022: "bg-red-50",
  2023: "bg-emerald-50",
  2024: "bg-blue-50",
  2025: "bg-amber-50",
  2026: "bg-purple-50",
};

export default function Attendance() {
  const [data, setData] = useState<Data | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(console.error);
  }, []);

  const years = useMemo(() => {
    if (!data) return [];
    const uniqueYears = Array.from(new Set(data.classDates.map((d) => d.year)));
    return uniqueYears.sort();
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.students.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const filteredDates = useMemo(() => {
    if (!data) return [];
    // Only show lessons that have already passed (today or before)
    const today = new Date();
    const pastLessons = data.classDates.filter((d) => {
      const lessonDate = new Date(d.year, d.month - 1, d.day);
      return lessonDate <= today;
    });
    
    if (selectedYear === null) return pastLessons;
    return pastLessons.filter((d) => d.year === selectedYear);
  }, [data, selectedYear]);

  const getAttendanceValue = (student: Student, lessonNum: number): string => {
    if (!data) return "-";
    
    // Find the lesson number where this student started
    const startDateStr = student.startDate;
    const startLesson = data.classDates.find((d) => {
      const dateStr = `${d.year}年${d.month}月${d.day}日`;
      return dateStr === startDateStr;
    })?.lesson || 1;

    if (lessonNum < startLesson) {
      return "-";
    }

    // Count only actual attended lessons (excluding absences)
    let attendedCount = 0;
    for (let i = startLesson; i <= lessonNum; i++) {
      if (!(student.absenceLessons || []).includes(i)) {
        attendedCount++;
      }
    }
    
    return String(((attendedCount - 1) % 12) + 1);
  };

  // 檢查是否為請假課程
  const isAbsenceLesson = (student: Student, lessonNum: number): boolean => {
    return (student.absenceLessons || []).includes(lessonNum);
  };

  // 檢查是否需要繳費提醒 (第10-12堂)
  const needsPaymentReminder = (cycleNum: number): boolean => {
    return cycleNum >= 10 && cycleNum <= 12;
  };

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">點名表</h1>
          <p className="text-muted-foreground">
            共 {data.students.length} 位學生 · {filteredDates.length} 堂課已開課
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋學生..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
        </div>
      </div>

      {/* Year Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedYear === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedYear(null)}
        >
          全部
        </Button>
        {years.map((year) => (
          <Button
            key={year}
            variant={selectedYear === year ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedYear(year)}
            className={cn(
              selectedYear === year && yearColors[year],
              selectedYear === year && "text-white border-transparent"
            )}
          >
            {year}年
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {years.map((year) => {
          const yearDates = data.classDates.filter((d) => d.year === year);
          return (
            <Card key={year} className={cn("border-l-4", yearColors[year].replace("bg-", "border-l-"))}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {year}年
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{yearDates.length} 堂</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Absence Legend */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">請假說明：</span>
            <span className="text-gray-600">
              灰色背景表示學生在該課程請假
            </span>
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded bg-gray-400 text-xs font-bold text-white">
              假
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminder Legend */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-orange-700">繳費提醒：</span>
            <span className="text-orange-600">
              橙色格子表示學生已上到第 10-12 堂，請提醒家長繳交下一期學費 ($2,400)
            </span>
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded bg-orange-400 text-xs font-bold text-white">
              10
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-orange-400 text-xs font-bold text-white">
              11
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-orange-400 text-xs font-bold text-white">
              12
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            出席記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full custom-scrollbar">
            <div className="min-w-max">
              {/* Table Header */}
              <div className="flex border-b border-border">
                <div className="sticky left-0 z-20 w-12 shrink-0 bg-card px-2 py-3 font-semibold text-center text-xs">
                  No.
                </div>
                <div className="sticky left-12 z-20 w-20 shrink-0 bg-card px-4 py-3 font-semibold">
                  學生姓名
                </div>
                {filteredDates.map((d) => (
                  <div
                    key={d.lesson}
                    className={cn(
                      "w-12 shrink-0 px-1 py-2 text-center text-xs",
                      yearLightColors[d.year]
                    )}
                  >
                    <div className="font-semibold">{d.lesson}</div>
                    <div className="text-muted-foreground">{d.date}</div>
                  </div>
                ))}
              </div>

              {/* Table Body */}
              {filteredStudents.map((student, idx) => (
                <div
                  key={student.name}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-muted/50 transition-colors",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                  )}
                >
                  <div className="sticky left-0 z-10 w-12 shrink-0 bg-inherit px-2 py-2 font-medium text-center text-sm">
                    {idx + 1}
                  </div>
                  <div className="sticky left-12 z-10 w-20 shrink-0 bg-inherit px-4 py-2 font-medium">
                    {student.name}
                  </div>
                  {filteredDates.map((d) => {
                    const value = getAttendanceValue(student, d.lesson);
                    const cycleNum = parseInt(value);
                    const isPaymentReminder = !isNaN(cycleNum) && needsPaymentReminder(cycleNum);
                    const isAbsent = isAbsenceLesson(student, d.lesson);
                    
                    return (
                      <div
                        key={d.lesson}
                        className={cn(
                          "w-12 shrink-0 px-1 py-2 text-center",
                          isAbsent && "bg-gray-200"
                        )}
                      >
                        {value === "-" ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            -
                          </span>
                        ) : isAbsent ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-400 text-xs font-bold text-white shadow-sm">
                            假
                          </span>
                        ) : isPaymentReminder ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-orange-400 text-xs font-bold text-white shadow-sm">
                            {value}
                          </span>
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-100 text-xs font-bold text-emerald-700">
                            {value}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
