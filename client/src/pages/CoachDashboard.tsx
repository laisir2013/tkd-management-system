import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BarChart3, KeyRound, ArrowLeft, ClipboardCheck, DollarSign, CalendarDays } from "lucide-react";
import { useLocation } from "wouter";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type TabKey = "students" | "attendance" | "payments" | "stats";

export default function CoachDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("students");

  // @ts-ignore
  const coachName = user?.coachName || '';
  const phone = user?.phone || '';

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!user || user.role !== 'coach') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">您沒有教練權限</p>
            <Button onClick={() => setLocation("/")}>返回登入</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "students", label: "學生名單", icon: <Users className="w-4 h-4" /> },
    { key: "attendance", label: "點名管理", icon: <ClipboardCheck className="w-4 h-4" /> },
    { key: "payments", label: "繳費紀錄", icon: <DollarSign className="w-4 h-4" /> },
    { key: "stats", label: "統計報表", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-4 sm:p-8">
      <div className="container max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">教練管理系統</h1>
            <p className="text-gray-600 mt-1">
              歡迎，<span className="font-semibold text-green-700">{coachName}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowChangePassword(true)} variant="outline" size="sm">
              <KeyRound className="w-4 h-4 mr-1" />
              修改密碼
            </Button>
            <Button onClick={async () => { await logout(); setLocation("/"); }} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              登出
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white/60 rounded-lg p-1 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-green-700'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "students" && <CoachStudentList coachName={coachName} />}
        {activeTab === "attendance" && <CoachAttendance coachName={coachName} />}
        {activeTab === "payments" && <CoachPayments coachName={coachName} />}
        {activeTab === "stats" && <CoachStats coachName={coachName} />}

        <ChangePasswordDialog
          open={showChangePassword}
          onOpenChange={setShowChangePassword}
          phone={phone as string}
          userType="coach"
        />
      </div>
    </div>
  );
}

/* ==================== Student List ==================== */
function CoachStudentList({ coachName }: { coachName: string }) {
  const { data: allStudents, isLoading } = trpc.students.getAll.useQuery();
  const [venueFilter, setVenueFilter] = useState("all");

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => s.coach === coachName && s.status === 'active');
  }, [allStudents, coachName]);

  const venues = useMemo(() => {
    return [...new Set(myStudents.map(s => s.venue).filter(Boolean))].sort();
  }, [myStudents]);

  const filteredStudents = useMemo(() => {
    if (venueFilter === 'all') return myStudents;
    return myStudents.filter(s => s.venue === venueFilter);
  }, [myStudents, venueFilter]);

  // Group by venue + day + time
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredStudents>();
    filteredStudents.forEach(s => {
      const key = `${s.venue}|${s.scheduleDay || ''}|${s.scheduleTime || ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredStudents]);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">我的學生</h2>
          <p className="text-sm text-gray-500">共 {myStudents.length} 位活躍學生</p>
        </div>
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="全部道場" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部道場 ({myStudents.length})</SelectItem>
            {venues.map(v => (
              <SelectItem key={v} value={v!}>{v} ({myStudents.filter(s => s.venue === v).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {grouped.map(([key, students]) => {
        const [venue, day, time] = key.split('|');
        return (
          <Card key={key} className="shadow-sm">
            <CardHeader className="py-3 bg-gradient-to-r from-green-50 to-teal-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {venue}
                  {day && <span className="text-green-600 ml-2">{day}</span>}
                  {time && <span className="text-gray-500 ml-2 text-sm">{time}</span>}
                </CardTitle>
                <span className="text-sm text-green-700 font-medium">{students.length} 人</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>電話</TableHead>
                      <TableHead>級數</TableHead>
                      <TableHead className="text-right">學費</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-gray-400">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-gray-600">{s.phone}</TableCell>
                        <TableCell>
                          {s.beltLevel ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {s.beltLevel}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">${s.feePerQuarter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {grouped.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暫無學生資料</p>
        </div>
      )}
    </div>
  );
}

/* ==================== Attendance ==================== */
function CoachAttendance({ coachName }: { coachName: string }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedClass, setSelectedClass] = useState<{ venue: string; day: string; time: string } | null>(null);

  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: classGroups } = trpc.attendance.getAllClassGroups.useQuery();
  const { data: trainingSchedules } = trpc.attendance.getTrainingSchedules.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });
  const { data: attendanceRecords, refetch: refetchAttendance } = trpc.attendance.getAttendanceRecords.useQuery(
    { year: selectedYear, month: selectedMonth },
    { enabled: !!selectedClass }
  );

  const upsertAttendance = trpc.attendance.upsertAttendance.useMutation({
    onSuccess: () => refetchAttendance(),
  });

  // Filter classes for this coach
  const myClasses = useMemo(() => {
    if (!classGroups || !allStudents) return [];
    return classGroups
      .filter((g: any) => g.venue !== '精英班道場')
      .filter((g: any) => {
        const classStudents = allStudents.filter(
          s => s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        );
        return classStudents.length > 0;
      })
      .map((g: any) => ({
        venue: g.venue,
        day: g.scheduleDay,
        time: g.scheduleTime,
        count: allStudents.filter(
          s => s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        ).length,
      }));
  }, [classGroups, allStudents, coachName]);

  const handleMonthChange = (dir: "prev" | "next") => {
    if (dir === "prev") {
      if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
      else setSelectedMonth(m => m - 1);
    } else {
      if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
      else setSelectedMonth(m => m + 1);
    }
  };

  // Attendance table data
  const classStudents = useMemo(() => {
    if (!selectedClass || !allStudents) return [];
    return allStudents.filter(
      s => s.venue === selectedClass.venue && s.scheduleDay === selectedClass.day && s.scheduleTime === selectedClass.time && s.coach === coachName
    ).map(s => ({ id: s.id, name: s.name }));
  }, [selectedClass, allStudents, coachName]);

  const classDates = useMemo(() => {
    if (!selectedClass || !trainingSchedules) return [];
    const dateMap = new Map<string, { date: Date; scheduleId: number; status: string }>();
    trainingSchedules
      .filter((s: any) => s.venue === selectedClass.venue && s.scheduleDay === selectedClass.day && s.scheduleTime === selectedClass.time)
      .forEach((s: any) => {
        const dk = new Date(s.trainingDate).toISOString().split('T')[0];
        if (!dateMap.has(dk)) dateMap.set(dk, { date: new Date(s.trainingDate), scheduleId: s.id, status: s.status });
      });
    return Array.from(dateMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedClass, trainingSchedules]);

  const recordsMap = useMemo(() => {
    const m = new Map<string, string>();
    (attendanceRecords || []).forEach((r: any) => {
      const dk = new Date(r.attendanceDate).toISOString().split('T')[0];
      m.set(`${r.studentId}-${dk}`, r.status);
    });
    return m;
  }, [attendanceRecords]);

  const handleToggle = (studentId: number, date: Date, scheduleId: number) => {
    const dk = date.toISOString().split('T')[0];
    const key = `${studentId}-${dk}`;
    const current = recordsMap.get(key);
    const next = current === 'present' ? 'absent' : 'present';
    upsertAttendance.mutate({
      studentId,
      courseId: scheduleId,
      attendanceDate: date,
      status: next,
    });
  };

  if (selectedClass) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)} className="mb-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回
            </Button>
            <h2 className="text-lg font-bold">
              {selectedClass.venue} — {selectedClass.day} {selectedClass.time}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleMonthChange("prev")}>◀</Button>
            <span className="font-medium text-sm">{selectedYear}年{selectedMonth}月</span>
            <Button variant="outline" size="sm" onClick={() => handleMonthChange("next")}>▶</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[100px]">學生</TableHead>
                  {classDates.map(d => (
                    <TableHead key={d.scheduleId} className={`text-center min-w-[52px] text-xs ${d.status === 'cancelled' ? 'bg-red-50 line-through text-red-400' : ''}`}>
                      {d.date.getDate()}日
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStudents.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium text-sm">{s.name}</TableCell>
                    {classDates.map(d => {
                      const dk = d.date.toISOString().split('T')[0];
                      const status = recordsMap.get(`${s.id}-${dk}`);
                      const isCancelled = d.status === 'cancelled';
                      return (
                        <TableCell key={d.scheduleId} className="text-center p-1">
                          {isCancelled ? (
                            <span className="text-red-300 text-xs">停</span>
                          ) : (
                            <button
                              onClick={() => handleToggle(s.id, d.date, d.scheduleId)}
                              className={`w-8 h-8 rounded-full text-xs font-bold transition-colors
                                ${status === 'present' ? 'bg-green-500 text-white' : status === 'absent' ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            >
                              {status === 'present' ? '✓' : status === 'absent' ? '✗' : '·'}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-green-500 inline-block" /> 出席</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-red-400 inline-block" /> 缺席</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-gray-100 inline-block" /> 未記錄</span>
        </div>
      </div>
    );
  }

  // Class selection view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">點名管理</h2>
          <p className="text-sm text-gray-500">選擇班別進行點名</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleMonthChange("prev")}>◀</Button>
          <span className="font-medium text-sm">{selectedYear}年{selectedMonth}月</span>
          <Button variant="outline" size="sm" onClick={() => handleMonthChange("next")}>▶</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {myClasses.map(c => (
          <Button
            key={`${c.venue}-${c.day}-${c.time}`}
            variant="outline"
            className="h-auto py-3 px-4 flex flex-col items-start text-left bg-white hover:bg-green-50 border-green-200"
            onClick={() => setSelectedClass({ venue: c.venue, day: c.day, time: c.time })}
          >
            <div className="font-semibold text-sm">{c.venue}</div>
            <div className="text-xs text-gray-500">{c.day} {c.time}</div>
            <div className="text-xs text-green-600 font-medium mt-1">{c.count} 位學生</div>
          </Button>
        ))}
      </div>

      {myClasses.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暫無班別資料</p>
        </div>
      )}
    </div>
  );
}

/* ==================== Payments ==================== */
function CoachPayments({ coachName }: { coachName: string }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: statuses, isLoading } = trpc.payments.getQuarterlyStatuses.useQuery({ year: selectedYear });

  const filteredStatuses = useMemo(() => {
    if (!statuses) return [];
    return statuses.filter((s: any) => s.coach === coachName);
  }, [statuses, coachName]);

  const yearOptions = [];
  for (let y = 2026; y <= currentYear + 1; y++) yearOptions.push(y);

  const quarterLabels = ['1-3月', '4-6月', '7-9月', '10-12月'];

  const summary = useMemo(() => {
    let paid = 0, unpaid = 0, notDue = 0;
    filteredStatuses.forEach((s: any) => {
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        if (s[q] === 'paid') paid++;
        else if (s[q] === 'unpaid') unpaid++;
        else notDue++;
      });
    });
    return { paid, unpaid, notDue };
  }, [filteredStatuses]);

  if (isLoading) return <div className="text-center py-8 text-gray-500">載入中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">繳費紀錄</h2>
          <p className="text-sm text-gray-500">我的學生繳費狀態</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-28 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-green-700">{summary.paid}</div>
            <div className="text-xs text-green-600">已繳</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-red-700">{summary.unpaid}</div>
            <div className="text-xs text-red-600">未繳</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-gray-600">{summary.notDue}</div>
            <div className="text-xs text-gray-500">未到期</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>姓名</TableHead>
                {quarterLabels.map((label, i) => (
                  <TableHead key={i} className="text-center">
                    <div className="text-xs">{selectedYear}</div>
                    <div className="text-xs">{label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatuses.map((student: any, index: number) => (
                <TableRow key={student.studentId}>
                  <TableCell className="text-gray-400">{index + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{student.studentName}</TableCell>
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                    const st = student[q];
                    return (
                      <TableCell key={q} className="text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                          ${st === 'paid' ? 'bg-green-100 text-green-700' : st === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {st === 'paid' ? '已繳' : st === 'unpaid' ? '未繳' : '未到期'}
                        </span>
                        {student[`${q}PaymentDate`] && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{student[`${q}PaymentDate`]}</div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredStatuses.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暫無繳費紀錄</p>
        </div>
      )}
    </div>
  );
}

/* ==================== Statistics ==================== */
function CoachStats({ coachName }: { coachName: string }) {
  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: stats } = trpc.users.getStatistics.useQuery({ coachName });

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => s.coach === coachName && s.status === 'active');
  }, [allStudents, coachName]);

  // Group by venue
  const venueStats = useMemo(() => {
    const map = new Map<string, { count: number; totalFee: number }>();
    myStudents.forEach(s => {
      const v = s.venue || '未分配';
      const existing = map.get(v) || { count: 0, totalFee: 0 };
      existing.count++;
      existing.totalFee += parseFloat(s.feePerQuarter || '0');
      map.set(v, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [myStudents]);

  // Group by belt level
  const beltStats = useMemo(() => {
    const map = new Map<string, number>();
    myStudents.forEach(s => {
      const b = s.beltLevel || '未分級';
      map.set(b, (map.get(b) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [myStudents]);

  const totalFee = myStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">統計報表</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-green-700">{myStudents.length}</div>
            <div className="text-xs text-green-600">活躍學生</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-blue-700">{venueStats.length}</div>
            <div className="text-xs text-blue-600">道場數量</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-amber-700">${totalFee.toLocaleString()}</div>
            <div className="text-xs text-amber-600">季度學費總額</div>
          </CardContent>
        </Card>
      </div>

      {/* Venue breakdown */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">各道場學生分佈</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>道場</TableHead>
                <TableHead className="text-center">學生數</TableHead>
                <TableHead className="text-right">季度學費</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venueStats.map(([venue, data]) => (
                <TableRow key={venue}>
                  <TableCell className="font-medium">{venue}</TableCell>
                  <TableCell className="text-center">{data.count} 人</TableCell>
                  <TableCell className="text-right font-mono">${data.totalFee.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Belt level breakdown */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">級數分佈</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {beltStats.map(([belt, count]) => (
              <span key={belt} className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200">
                {belt}: {count}人
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
