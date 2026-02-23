import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BarChart3, KeyRound, ArrowLeft, ClipboardCheck, DollarSign, CalendarDays, Building2, Award, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type TabKey = "students" | "attendance" | "payments" | "dojos" | "elite" | "stats";

export default function CoachDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("students");

  // @ts-ignore
  const coachName: string = user?.coachName || '';
  const phone: string = (user as any)?.phone || '';

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
    { key: "dojos", label: "我的道場", icon: <Building2 className="w-4 h-4" /> },
    { key: "attendance", label: "點名管理", icon: <ClipboardCheck className="w-4 h-4" /> },
    { key: "payments", label: "繳費紀錄", icon: <DollarSign className="w-4 h-4" /> },
    { key: "elite", label: "精英班", icon: <Award className="w-4 h-4" /> },
    { key: "stats", label: "統計總覽", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-3 sm:p-6">
      <div className="container max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
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
        <div className="flex gap-1 bg-white/60 rounded-lg p-1 mb-5 overflow-x-auto">
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
        {activeTab === "dojos" && <CoachDojos coachName={coachName} />}
        {activeTab === "attendance" && <CoachAttendance coachName={coachName} />}
        {activeTab === "payments" && <CoachPayments coachName={coachName} />}
        {activeTab === "elite" && <CoachElite coachName={coachName} />}
        {activeTab === "stats" && <CoachStats coachName={coachName} />}

        <ChangePasswordDialog
          open={showChangePassword}
          onOpenChange={setShowChangePassword}
          phone={phone}
          userType="coach"
        />
      </div>
    </div>
  );
}

/* ======================================================================
   STUDENT LIST — 恆常班學生名單
   ====================================================================== */
function CoachStudentList({ coachName }: { coachName: string }) {
  const { data: allStudents, isLoading } = trpc.students.getAll.useQuery();
  const [venueFilter, setVenueFilter] = useState("all");

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => s.coach === coachName && s.status === 'active');
  }, [allStudents, coachName]);

  const venues = useMemo(() =>
    [...new Set(myStudents.map(s => s.venue).filter(Boolean))].sort()
  , [myStudents]);

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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">恆常班學生名單</h2>
          <p className="text-sm text-gray-500">共 {myStudents.length} 位活躍學生</p>
        </div>
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="w-44 bg-white">
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
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>電話</TableHead>
                      <TableHead>級數</TableHead>
                      <TableHead className="text-right">學費/季</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{s.phone}</TableCell>
                        <TableCell>
                          {s.beltLevel ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{s.beltLevel}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">${s.feePerQuarter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {grouped.length === 0 && <EmptyState icon={<Users className="w-12 h-12" />} text="暫無學生資料" />}
    </div>
  );
}

/* ======================================================================
   DOJOS — 我的道場
   ====================================================================== */
function CoachDojos({ coachName }: { coachName: string }) {
  const { data: dojos, isLoading: dLoading } = trpc.dojos.getAll.useQuery();
  const { data: allStudents, isLoading: sLoading } = trpc.students.getAll.useQuery();
  const { data: classGroups } = trpc.attendance.getAllClassGroups.useQuery();

  const myDojos = useMemo(() => {
    if (!dojos) return [];
    return dojos.filter(d => d.coachName === coachName && d.status === 'active');
  }, [dojos, coachName]);

  // Student count per venue
  const venueStudentMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStudents || []).forEach(s => {
      if (s.venue && s.coach === coachName && s.status === 'active') {
        map.set(s.venue, (map.get(s.venue) || 0) + 1);
      }
    });
    return map;
  }, [allStudents, coachName]);

  // Class groups for this coach
  const myClassGroups = useMemo(() => {
    if (!classGroups || !allStudents) return [];
    return classGroups
      .filter((g: any) => g.venue !== '精英班道場')
      .filter((g: any) => {
        const cs = allStudents.filter(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        );
        return cs.length > 0;
      })
      .map((g: any) => ({
        venue: g.venue,
        day: g.scheduleDay,
        time: g.scheduleTime,
        count: allStudents.filter(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        ).length,
      }));
  }, [classGroups, allStudents, coachName]);

  // Group class groups by venue
  const groupedByVenue = useMemo(() => {
    const map = new Map<string, typeof myClassGroups>();
    myClassGroups.forEach(g => {
      if (!map.has(g.venue)) map.set(g.venue, []);
      map.get(g.venue)!.push(g);
    });
    return Array.from(map.entries());
  }, [myClassGroups]);

  if (dLoading || sLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">我的道場</h2>
        <p className="text-sm text-gray-500">
          共 {myDojos.length} 個道場，{myClassGroups.length} 個班別，
          {Array.from(venueStudentMap.values()).reduce((a, b) => a + b, 0)} 位學生
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {myDojos.map(dojo => (
          <Card key={dojo.id} className="bg-white border-green-200">
            <CardContent className="pt-3 pb-2 text-center">
              <div className="text-lg font-bold text-green-700">{venueStudentMap.get(dojo.name) || 0}</div>
              <div className="text-xs text-gray-600 truncate">{dojo.name}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed view per venue */}
      {groupedByVenue.map(([venue, classes]) => (
        <Card key={venue} className="shadow-sm">
          <CardHeader className="py-3 bg-gradient-to-r from-green-50 to-teal-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-600" />
                {venue}
              </CardTitle>
              <span className="text-sm text-green-700 font-medium">
                {venueStudentMap.get(venue) || 0} 位學生
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {classes.map(c => (
                <div key={`${c.day}-${c.time}`} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border">
                  <div>
                    <div className="text-sm font-medium">{c.day}</div>
                    <div className="text-xs text-gray-500">{c.time}</div>
                  </div>
                  <span className="text-sm font-semibold text-green-700">{c.count} 人</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {myDojos.length === 0 && <EmptyState icon={<Building2 className="w-12 h-12" />} text="暫無分配道場" />}
    </div>
  );
}

/* ======================================================================
   ATTENDANCE — 點名管理
   ====================================================================== */
function CoachAttendance({ coachName }: { coachName: string }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedClass, setSelectedClass] = useState<{ venue: string; day: string; time: string } | null>(null);

  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: classGroups } = trpc.attendance.getAllClassGroups.useQuery();
  const { data: trainingSchedules } = trpc.attendance.getTrainingSchedules.useQuery({
    year: selectedYear, month: selectedMonth,
  });
  const { data: attendanceRecords, refetch: refetchAttendance } = trpc.attendance.getAttendanceRecords.useQuery(
    { year: selectedYear, month: selectedMonth },
    { enabled: !!selectedClass }
  );
  const generateMonthly = trpc.attendance.generateMonthlySchedules.useMutation();

  useEffect(() => {
    generateMonthly.mutate({ year: selectedYear, month: selectedMonth });
  }, [selectedYear, selectedMonth]);

  const upsertAttendance = trpc.attendance.upsertAttendance.useMutation({
    onSuccess: () => refetchAttendance(),
  });

  const myClasses = useMemo(() => {
    if (!classGroups || !allStudents) return [];
    return classGroups
      .filter((g: any) => g.venue !== '精英班道場')
      .filter((g: any) => {
        return allStudents.some(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        );
      })
      .map((g: any) => ({
        venue: g.venue, day: g.scheduleDay, time: g.scheduleTime,
        count: allStudents.filter(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
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

  const classStudents = useMemo(() => {
    if (!selectedClass || !allStudents) return [];
    return allStudents.filter(s =>
      s.venue === selectedClass.venue && s.scheduleDay === selectedClass.day && s.scheduleTime === selectedClass.time && s.coach === coachName
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
    upsertAttendance.mutate({ studentId, courseId: scheduleId, attendanceDate: date, status: next });
  };

  // Attendance table view
  if (selectedClass) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)} className="mb-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回班別列表
            </Button>
            <h2 className="text-lg font-bold">{selectedClass.venue} — {selectedClass.day} {selectedClass.time}</h2>
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
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[90px]">學生</TableHead>
                  {classDates.map(d => (
                    <TableHead key={d.scheduleId} className={`text-center min-w-[48px] text-xs ${d.status === 'cancelled' ? 'bg-red-50 line-through text-red-400' : ''}`}>
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
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-gray-100 inline-block border" /> 未記錄</span>
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
      {myClasses.length === 0 && <EmptyState icon={<CalendarDays className="w-12 h-12" />} text="暫無班別資料" />}
    </div>
  );
}

/* ======================================================================
   PAYMENTS — 繳費紀錄 + WhatsApp 提醒
   ====================================================================== */
function CoachPayments({ coachName }: { coachName: string }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: statuses, isLoading } = trpc.payments.getQuarterlyStatuses.useQuery({ year: selectedYear });
  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);

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

  const handleWhatsApp = (student: any) => {
    if (!student.phone) { toast.error(`${student.studentName} 沒有電話號碼`); return; }
    setSendingWhatsApp(student.studentId);
    const unpaidQs: string[] = [];
    if (student.Q1 === 'unpaid') unpaidQs.push('1-3月');
    if (student.Q2 === 'unpaid') unpaidQs.push('4-6月');
    if (student.Q3 === 'unpaid') unpaidQs.push('7-9月');
    if (student.Q4 === 'unpaid') unpaidQs.push('10-12月');
    const defaultQ = unpaidQs[0] || '1-3月';
    const sysUrl = window.location.origin;
    const msg = `🥋 ${student.studentName} 家長您好！\n\n📌 *${selectedYear}年${defaultQ}學費通知*\n\n💳 繳費方式：\n銀行轉帳：中國銀行 012-692-2-0114816\n轉數快 FPS：164577132\n\n📱 上傳收據：\n登入 ${sysUrl}\n帳號/密碼：${student.phone}\n\n如有疑問請聯絡 ${coachName} ✅`;
    window.open(`https://api.whatsapp.com/send?phone=852${student.phone}&text=${encodeURIComponent(msg)}`, "_blank");
    setTimeout(() => setSendingWhatsApp(null), 1000);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">繳費紀錄</h2>
          <p className="text-sm text-gray-500">我的學生 ({filteredStatuses.length} 人) 季度繳費狀態</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-2xl font-bold text-green-700">{summary.paid}</div>
            <div className="text-xs text-green-600">已繳</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-2xl font-bold text-red-700">{summary.unpaid}</div>
            <div className="text-xs text-red-600">未繳</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-3 pb-2 text-center">
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
                <TableHead className="w-10">#</TableHead>
                <TableHead>姓名</TableHead>
                {quarterLabels.map((l, i) => (
                  <TableHead key={i} className="text-center"><div className="text-xs">{selectedYear}</div><div className="text-xs">{l}</div></TableHead>
                ))}
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatuses.map((student: any, idx: number) => (
                <TableRow key={student.studentId}>
                  <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{student.studentName}</TableCell>
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                    const st = student[q];
                    return (
                      <TableCell key={q} className="text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                          ${st === 'paid' ? 'bg-green-100 text-green-700' : st === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {st === 'paid' ? '已繳' : st === 'unpaid' ? '未繳' : '未到期'}
                        </span>
                        {student[`${q}PaymentDate`] && <div className="text-[10px] text-gray-400 mt-0.5">{student[`${q}PaymentDate`]}</div>}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" onClick={() => handleWhatsApp(student)}
                      disabled={sendingWhatsApp === student.studentId} className="text-xs px-2">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      {sendingWhatsApp === student.studentId ? '...' : '提醒'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {filteredStatuses.length === 0 && <EmptyState icon={<DollarSign className="w-12 h-12" />} text="暫無繳費紀錄" />}
    </div>
  );
}

/* ======================================================================
   ELITE — 精英班管理
   ====================================================================== */
function CoachElite({ coachName }: { coachName: string }) {
  const { data: eliteStudents, isLoading } = trpc.elite.getStudents.useQuery();
  const { data: allCycleInfo } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: elitePayments } = trpc.elite.getPayments.useQuery();

  const myEliteStudents = useMemo(() => {
    if (!eliteStudents) return [];
    return eliteStudents.filter((s: any) => s.coach === coachName && s.status === 'active');
  }, [eliteStudents, coachName]);

  // Map cycle info by student id
  const cycleMap = useMemo(() => {
    const map = new Map<number, any>();
    (allCycleInfo || []).forEach((c: any) => { if (c) map.set(c.studentId, c); });
    return map;
  }, [allCycleInfo]);

  // Map payments by student id
  const paymentMap = useMemo(() => {
    const map = new Map<number, any[]>();
    (elitePayments || []).forEach((p: any) => {
      if (!map.has(p.studentId)) map.set(p.studentId, []);
      map.get(p.studentId)!.push(p);
    });
    return map;
  }, [elitePayments]);

  // Summary
  const totalPaidClasses = useMemo(() =>
    myEliteStudents.reduce((sum, s) => sum + (cycleMap.get(s.id)?.paidClasses || 0), 0)
  , [myEliteStudents, cycleMap]);

  const totalAttendedClasses = useMemo(() =>
    myEliteStudents.reduce((sum, s) => sum + (cycleMap.get(s.id)?.attendedClasses || 0), 0)
  , [myEliteStudents, cycleMap]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">精英班學生</h2>
        <p className="text-sm text-gray-500">我負責的精英班學生 ({myEliteStudents.length} 人)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-2xl font-bold text-amber-700">{myEliteStudents.length}</div>
            <div className="text-xs text-amber-600">精英班學生</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalPaidClasses}</div>
            <div className="text-xs text-blue-600">已購堂數</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-2xl font-bold text-green-700">{totalAttendedClasses}</div>
            <div className="text-xs text-green-600">已上堂數</div>
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>電話</TableHead>
                <TableHead>級數</TableHead>
                <TableHead className="text-center">已購堂</TableHead>
                <TableHead className="text-center">已上堂</TableHead>
                <TableHead className="text-center">剩餘堂</TableHead>
                <TableHead className="text-center">循環進度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myEliteStudents.map((s: any, i: number) => {
                const cycle = cycleMap.get(s.id);
                const remaining = (cycle?.paidClasses || 0) - (cycle?.attendedClasses || 0);
                const cycleProgress = cycle ? `${cycle.currentCycleAttended || 0}/12` : '-';
                return (
                  <TableRow key={s.id} className={remaining <= 2 && remaining >= 0 ? 'bg-red-50' : ''}>
                    <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{s.phone}</TableCell>
                    <TableCell>
                      {s.beltLevel ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{s.beltLevel}</span> : '-'}
                    </TableCell>
                    <TableCell className="text-center font-mono">{cycle?.paidClasses || 0}</TableCell>
                    <TableCell className="text-center font-mono">{cycle?.attendedClasses || 0}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${remaining <= 2 ? 'text-red-600' : remaining <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                        {remaining}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{cycleProgress}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {myEliteStudents.length === 0 && <EmptyState icon={<Award className="w-12 h-12" />} text="暫無精英班學生" />}
    </div>
  );
}

/* ======================================================================
   STATS — 統計總覽 (恆常班 + 精英班)
   ====================================================================== */
function CoachStats({ coachName }: { coachName: string }) {
  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: coachStatsData } = trpc.coachStats.getAll.useQuery();
  const { data: dojos } = trpc.dojos.getAll.useQuery();

  const myStat = useMemo(() => {
    if (!coachStatsData) return null;
    return coachStatsData.find((s: any) => s.coachName === coachName) || null;
  }, [coachStatsData, coachName]);

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => s.coach === coachName && s.status === 'active' && s.venue !== '精英班道場');
  }, [allStudents, coachName]);

  // Venue breakdown
  const venueStats = useMemo(() => {
    const map = new Map<string, { count: number; totalFee: number }>();
    myStudents.forEach(s => {
      const v = s.venue || '未分配';
      const ex = map.get(v) || { count: 0, totalFee: 0 };
      ex.count++;
      ex.totalFee += parseFloat(s.feePerQuarter || '0');
      map.set(v, ex);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [myStudents]);

  // Belt breakdown
  const beltStats = useMemo(() => {
    const map = new Map<string, number>();
    myStudents.forEach(s => { const b = s.beltLevel || '未分級'; map.set(b, (map.get(b) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [myStudents]);

  const myDojoCount = useMemo(() => {
    if (!dojos) return 0;
    return dojos.filter(d => d.coachName === coachName && d.status === 'active').length;
  }, [dojos, coachName]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">統計總覽</h2>

      {/* Top summary - combined regular + elite */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-3xl font-bold text-green-700">{myStat?.regularStudentCount || myStudents.length}</div>
            <div className="text-xs text-green-600">恆常班學生</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-3xl font-bold text-amber-700">{myStat?.eliteStudentCount || 0}</div>
            <div className="text-xs text-amber-600">精英班學生</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-3xl font-bold text-blue-700">{myDojoCount}</div>
            <div className="text-xs text-blue-600">道場數量</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-3 pb-2 text-center">
            <div className="text-3xl font-bold text-purple-700">{myStat?.totalStudentCount || myStudents.length}</div>
            <div className="text-xs text-purple-600">學生總數</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">收入總覽</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-green-50">
              <div className="text-sm text-gray-500">恆常班季度學費</div>
              <div className="text-2xl font-bold text-green-700">${(myStat?.regularTotalFee || venueStats.reduce((s, [, d]) => s + d.totalFee, 0)).toLocaleString()}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50">
              <div className="text-sm text-gray-500">精英班已收學費</div>
              <div className="text-2xl font-bold text-amber-700">${(myStat?.eliteTotalPaid || 0).toLocaleString()}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-indigo-50">
              <div className="text-sm text-gray-500">總收入</div>
              <div className="text-2xl font-bold text-indigo-700">${(myStat?.totalRevenue || 0).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Belt distribution */}
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

/* ======================================================================
   SHARED COMPONENTS
   ====================================================================== */
function LoadingSpinner() {
  return <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="mx-auto mb-3 opacity-40">{icon}</div>
      <p>{text}</p>
    </div>
  );
}
