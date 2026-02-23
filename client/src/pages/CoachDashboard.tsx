import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, BarChart3, KeyRound, ArrowLeft, ClipboardCheck, DollarSign, CalendarDays, Building2, Award, MessageCircle, Check, ChevronDown, ChevronUp } from "lucide-react";
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
        {activeTab === "dojos" && <CoachDojos coachName={coachName} onSelectAttendance={(venue, day, time) => {
          setActiveTab("attendance");
        }} />}
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
   STUDENT LIST
   ====================================================================== */
function CoachStudentList({ coachName }: { coachName: string }) {
  const { data: allStudents, isLoading } = trpc.students.getAll.useQuery();
  const [venueFilter, setVenueFilter] = useState("all");

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter((s: any) => s.coach === coachName && s.status === 'active');
  }, [allStudents, coachName]);

  const venues = useMemo(() =>
    [...new Set(myStudents.map((s: any) => s.venue).filter(Boolean))].sort()
  , [myStudents]);

  const filteredStudents = useMemo(() => {
    if (venueFilter === 'all') return myStudents;
    return myStudents.filter((s: any) => s.venue === venueFilter);
  }, [myStudents, venueFilter]);

  // Group by venue + day + time
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredStudents>();
    filteredStudents.forEach((s: any) => {
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
              <SelectItem key={v} value={v!}>{v} ({myStudents.filter((s: any) => s.venue === v).length})</SelectItem>
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
                    {students.map((s: any, i: number) => (
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
   DOJOS — click to view students per dojo
   ====================================================================== */
function CoachDojos({ coachName, onSelectAttendance }: { coachName: string; onSelectAttendance: (venue: string, day: string, time: string) => void }) {
  const { data: dojos, isLoading: dLoading } = trpc.dojos.getAll.useQuery();
  const { data: allStudents, isLoading: sLoading } = trpc.students.getAll.useQuery();
  const { data: classGroups } = trpc.attendance.getAllClassGroups.useQuery();
  const [expandedVenue, setExpandedVenue] = useState<string | null>(null);

  const myDojos = useMemo(() => {
    if (!dojos) return [];
    return (dojos as any[]).filter(d => d.coachName === coachName && d.status === 'active');
  }, [dojos, coachName]);

  const venueStudentMap = useMemo(() => {
    const map = new Map<string, any[]>();
    ((allStudents || []) as any[]).forEach(s => {
      if (s.venue && s.coach === coachName && s.status === 'active') {
        if (!map.has(s.venue)) map.set(s.venue, []);
        map.get(s.venue)!.push(s);
      }
    });
    return map;
  }, [allStudents, coachName]);

  const myClassGroups = useMemo(() => {
    if (!classGroups || !allStudents) return [];
    return (classGroups as any[])
      .filter(g => g.venue !== '精英班道場')
      .filter(g => {
        const cs = (allStudents as any[]).filter(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        );
        return cs.length > 0;
      })
      .map(g => ({
        venue: g.venue,
        day: g.scheduleDay,
        time: g.scheduleTime,
        count: (allStudents as any[]).filter(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        ).length,
      }));
  }, [classGroups, allStudents, coachName]);

  const groupedByVenue = useMemo(() => {
    const map = new Map<string, typeof myClassGroups>();
    myClassGroups.forEach(g => {
      if (!map.has(g.venue)) map.set(g.venue, []);
      map.get(g.venue)!.push(g);
    });
    return Array.from(map.entries());
  }, [myClassGroups]);

  if (dLoading || sLoading) return <LoadingSpinner />;

  const totalStudents = Array.from(venueStudentMap.values()).reduce((a, b) => a + b.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">我的道場</h2>
        <p className="text-sm text-gray-500">
          共 {myDojos.length} 個道場，{myClassGroups.length} 個班別，{totalStudents} 位學生
        </p>
        <p className="text-xs text-green-600 mt-1">點擊道場卡片展開查看學生名單</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {myDojos.map(dojo => {
          const students = venueStudentMap.get(dojo.name) || [];
          const isExpanded = expandedVenue === dojo.name;
          return (
            <Card 
              key={dojo.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'bg-green-100 border-green-400 ring-2 ring-green-300' : 'bg-white border-green-200 hover:border-green-400'}`}
              onClick={() => setExpandedVenue(isExpanded ? null : dojo.name)}
            >
              <CardContent className="pt-3 pb-2 text-center">
                <div className="text-lg font-bold text-green-700">{students.length}</div>
                <div className="text-xs text-gray-600 truncate">{dojo.name}</div>
                <div className="text-[10px] text-green-500 mt-0.5">
                  {isExpanded ? <ChevronUp className="w-3 h-3 mx-auto" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expanded student list for selected venue */}
      {expandedVenue && (
        <Card className="shadow-md border-green-300">
          <CardHeader className="py-3 bg-gradient-to-r from-green-100 to-teal-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-600" />
                {expandedVenue} - 學生名單
              </CardTitle>
              <span className="text-sm text-green-700 font-medium">
                {(venueStudentMap.get(expandedVenue) || []).length} 位學生
              </span>
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
                    <TableHead>星期</TableHead>
                    <TableHead>時段</TableHead>
                    <TableHead>級數</TableHead>
                    <TableHead className="text-right">學費/季</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(venueStudentMap.get(expandedVenue) || []).map((s: any, i: number) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{s.phone}</TableCell>
                      <TableCell className="text-sm">{s.scheduleDay || '-'}</TableCell>
                      <TableCell className="text-sm">{s.scheduleTime || '-'}</TableCell>
                      <TableCell>
                        {s.beltLevel ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{s.beltLevel}</span> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">${s.feePerQuarter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed class view per venue */}
      {groupedByVenue.map(([venue, classes]) => (
        <Card key={venue} className="shadow-sm">
          <CardHeader className="py-3 bg-gradient-to-r from-green-50 to-teal-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-600" />
                {venue}
              </CardTitle>
              <span className="text-sm text-green-700 font-medium">
                {(venueStudentMap.get(venue) || []).length} 位學生
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
   ATTENDANCE
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
    return (classGroups as any[])
      .filter(g => g.venue !== '精英班道場')
      .filter(g => {
        return (allStudents as any[]).some(s =>
          s.venue === g.venue && s.scheduleDay === g.scheduleDay && s.scheduleTime === g.scheduleTime && s.coach === coachName
        );
      })
      .map(g => ({
        venue: g.venue, day: g.scheduleDay, time: g.scheduleTime,
        count: (allStudents as any[]).filter(s =>
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
    return (allStudents as any[]).filter(s =>
      s.venue === selectedClass.venue && s.scheduleDay === selectedClass.day && s.scheduleTime === selectedClass.time && s.coach === coachName
    ).map(s => ({ id: s.id, name: s.name }));
  }, [selectedClass, allStudents, coachName]);

  const classDates = useMemo(() => {
    if (!selectedClass || !trainingSchedules) return [];
    const dateMap = new Map<string, { date: Date; scheduleId: number; status: string }>();
    (trainingSchedules as any[])
      .filter(s => s.venue === selectedClass.venue && s.scheduleDay === selectedClass.day && s.scheduleTime === selectedClass.time)
      .forEach(s => {
        const dk = new Date(s.trainingDate).toISOString().split('T')[0];
        if (!dateMap.has(dk)) dateMap.set(dk, { date: new Date(s.trainingDate), scheduleId: s.id, status: s.status });
      });
    return Array.from(dateMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedClass, trainingSchedules]);

  const recordsMap = useMemo(() => {
    const m = new Map<string, string>();
    ((attendanceRecords || []) as any[]).forEach(r => {
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
            <p className="text-sm text-gray-500">{classStudents.length} 位學生，{classDates.filter(d => d.status !== 'cancelled').length} 堂訓練</p>
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
                  <TableHead className="text-center min-w-[60px] text-xs bg-blue-50">出席率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStudents.map(s => {
                  const activeDates = classDates.filter(d => d.status !== 'cancelled');
                  const presentCount = activeDates.filter(d => {
                    const dk = d.date.toISOString().split('T')[0];
                    return recordsMap.get(`${s.id}-${dk}`) === 'present';
                  }).length;
                  const rate = activeDates.length > 0 ? Math.round(presentCount / activeDates.length * 100) : 0;
                  return (
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
                      <TableCell className="text-center">
                        <span className={`text-xs font-bold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
          <p className="text-sm text-gray-500">選擇班別進行點名（共 {myClasses.length} 個班別）</p>
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
   PAYMENTS — with confirm button
   ====================================================================== */
function CoachPayments({ coachName }: { coachName: string }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: statuses, isLoading, refetch } = trpc.payments.getQuarterlyStatuses.useQuery({ year: selectedYear });
  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ studentId: number; studentName: string; quarter: string; quarterLabel: string } | null>(null);
  
  const confirmPayment = trpc.payments.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success('已確認繳費');
      refetch();
      setConfirmDialog(null);
    },
    onError: (err: any) => {
      toast.error(`確認失敗: ${err.message}`);
    },
  });

  const filteredStatuses = useMemo(() => {
    if (!statuses) return [];
    return (statuses as any[]).filter(s => s.coach === coachName);
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

  const handleConfirmClick = (student: any, quarter: string, quarterLabel: string) => {
    setConfirmDialog({
      studentId: student.studentId,
      studentName: student.studentName,
      quarter,
      quarterLabel,
    });
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
                  <TableCell className="font-medium text-sm">
                    {student.studentName}
                    <div className="text-[10px] text-gray-400">${student.feePerQuarter}/季</div>
                  </TableCell>
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q, qi) => {
                    const st = student[q];
                    return (
                      <TableCell key={q} className="text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                          ${st === 'paid' ? 'bg-green-100 text-green-700' : st === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {st === 'paid' ? '已繳' : st === 'unpaid' ? '未繳' : '未到期'}
                        </span>
                        {student[`${q}PaymentDate`] && <div className="text-[10px] text-gray-400 mt-0.5">{student[`${q}PaymentDate`]}</div>}
                        {st === 'unpaid' && (
                          <button
                            onClick={() => handleConfirmClick(student, q, quarterLabels[qi])}
                            className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            確認已繳
                          </button>
                        )}
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

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認繳費</DialogTitle>
            <DialogDescription>
              確認 <strong>{confirmDialog?.studentName}</strong> 已繳 {selectedYear}年{confirmDialog?.quarterLabel} 學費？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={confirmPayment.isPending}
              onClick={() => {
                if (confirmDialog) {
                  confirmPayment.mutate({
                    studentId: confirmDialog.studentId,
                    year: selectedYear,
                    quarter: confirmDialog.quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4',
                  });
                }
              }}
            >
              {confirmPayment.isPending ? '處理中...' : '確認已繳'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ======================================================================
   ELITE — with attendance table + confirm payment
   ====================================================================== */
function CoachElite({ coachName }: { coachName: string }) {
  const { data: eliteStudents, isLoading } = trpc.elite.getStudents.useQuery();
  const { data: allCycleInfo } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: elitePayments } = trpc.elite.getPayments.useQuery();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [activeEliteTab, setActiveEliteTab] = useState<"overview" | "attendance" | "payments">("overview");

  // Elite attendance data
  const { data: eliteSchedules } = trpc.elite.getSchedules.useQuery({ year: selectedYear, month: selectedMonth });
  const { data: eliteAttendance, refetch: refetchEliteAttendance } = trpc.elite.getAttendance.useQuery();
  const upsertEliteAttendance = trpc.elite.upsertAttendance.useMutation({
    onSuccess: () => refetchEliteAttendance(),
  });
  
  // Confirm elite payment
  const [confirmEliteDialog, setConfirmEliteDialog] = useState<{ studentId: number; studentName: string } | null>(null);
  const createElitePayment = trpc.elite.createPayment.useMutation({
    onSuccess: () => {
      toast.success('精英班繳費已確認');
      setConfirmEliteDialog(null);
    },
    onError: (err: any) => toast.error(`確認失敗: ${err.message}`),
  });

  const myEliteStudents = useMemo(() => {
    if (!eliteStudents) return [];
    return (eliteStudents as any[]).filter(s => s.coach === coachName && s.status === 'active');
  }, [eliteStudents, coachName]);

  const cycleMap = useMemo(() => {
    const map = new Map<number, any>();
    ((allCycleInfo || []) as any[]).forEach(c => { if (c) map.set(c.studentId, c); });
    return map;
  }, [allCycleInfo]);

  // Elite attendance schedules for this month
  const monthSchedules = useMemo(() => {
    if (!eliteSchedules) return [];
    return (eliteSchedules as any[])
      .map(s => ({ ...s, date: new Date(s.trainingDate) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eliteSchedules]);

  // Elite attendance records map
  const eliteRecordsMap = useMemo(() => {
    const m = new Map<string, string>();
    ((eliteAttendance || []) as any[]).forEach(r => {
      m.set(`${r.studentId}-${r.scheduleId}`, r.status);
    });
    return m;
  }, [eliteAttendance]);

  const handleEliteToggle = (studentId: number, scheduleId: number) => {
    const key = `${studentId}-${scheduleId}`;
    const current = eliteRecordsMap.get(key);
    const next = current === 'present' ? 'absent' : 'present';
    upsertEliteAttendance.mutate({ studentId, scheduleId, status: next });
  };

  const handleEliteMonthChange = (dir: "prev" | "next") => {
    if (dir === "prev") {
      if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
      else setSelectedMonth(m => m - 1);
    } else {
      if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
      else setSelectedMonth(m => m + 1);
    }
  };

  const totalPaidClasses = useMemo(() =>
    myEliteStudents.reduce((sum, s) => sum + (cycleMap.get(s.id)?.paidClasses || 0), 0)
  , [myEliteStudents, cycleMap]);

  const totalAttendedClasses = useMemo(() =>
    myEliteStudents.reduce((sum, s) => sum + (cycleMap.get(s.id)?.attendedClasses || 0), 0)
  , [myEliteStudents, cycleMap]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">精英班</h2>
          <p className="text-sm text-gray-500">我負責的精英班學生 ({myEliteStudents.length} 人)</p>
        </div>
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

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/60 rounded-lg p-1">
        {[
          { key: "overview" as const, label: "學生總覽" },
          { key: "attendance" as const, label: "點名表" },
          { key: "payments" as const, label: "繳費確認" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveEliteTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeEliteTab === t.key ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeEliteTab === "overview" && (
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
      )}

      {activeEliteTab === "attendance" && (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEliteMonthChange("prev")}>◀</Button>
            <span className="font-medium text-sm">{selectedYear}年{selectedMonth}月</span>
            <Button variant="outline" size="sm" onClick={() => handleEliteMonthChange("next")}>▶</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 min-w-[90px]">學生</TableHead>
                    {monthSchedules.map((s: any) => (
                      <TableHead key={s.id} className={`text-center min-w-[48px] text-xs ${s.status === 'cancelled' ? 'bg-red-50 line-through text-red-400' : ''}`}>
                        {s.date.getDate()}日
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myEliteStudents.map((student: any) => (
                    <TableRow key={student.id}>
                      <TableCell className="sticky left-0 bg-white z-10 font-medium text-sm">{student.name}</TableCell>
                      {monthSchedules.map((s: any) => {
                        const key = `${student.id}-${s.id}`;
                        const status = eliteRecordsMap.get(key);
                        const isCancelled = s.status === 'cancelled';
                        return (
                          <TableCell key={s.id} className="text-center p-1">
                            {isCancelled ? (
                              <span className="text-red-300 text-xs">停</span>
                            ) : (
                              <button
                                onClick={() => handleEliteToggle(student.id, s.id)}
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
          {monthSchedules.length === 0 && <p className="text-center text-gray-400 text-sm py-4">本月暫無訓練日期</p>}
        </div>
      )}

      {activeEliteTab === "payments" && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead className="text-center">已購堂</TableHead>
                    <TableHead className="text-center">已上堂</TableHead>
                    <TableHead className="text-center">剩餘堂</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myEliteStudents.map((s: any, i: number) => {
                    const cycle = cycleMap.get(s.id);
                    const remaining = (cycle?.paidClasses || 0) - (cycle?.attendedClasses || 0);
                    return (
                      <TableRow key={s.id} className={remaining <= 2 ? 'bg-red-50' : ''}>
                        <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-center font-mono">{cycle?.paidClasses || 0}</TableCell>
                        <TableCell className="text-center font-mono">{cycle?.attendedClasses || 0}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${remaining <= 2 ? 'text-red-600' : 'text-green-600'}`}>{remaining}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
                            onClick={() => setConfirmEliteDialog({ studentId: s.id, studentName: s.name })}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            確認已繳 12堂
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {myEliteStudents.length === 0 && <EmptyState icon={<Award className="w-12 h-12" />} text="暫無精英班學生" />}

      {/* Confirm Elite Payment Dialog */}
      <Dialog open={!!confirmEliteDialog} onOpenChange={() => setConfirmEliteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認精英班繳費</DialogTitle>
            <DialogDescription>
              確認 <strong>{confirmEliteDialog?.studentName}</strong> 已繳 12 堂精英班學費？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEliteDialog(null)}>取消</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              disabled={createElitePayment.isPending}
              onClick={() => {
                if (confirmEliteDialog) {
                  createElitePayment.mutate({
                    studentId: confirmEliteDialog.studentId,
                    classCount: 12,
                    amount: '0',
                    paymentDate: new Date(),
                    confirmedBy: 'admin_approved',
                  });
                }
              }}
            >
              {createElitePayment.isPending ? '處理中...' : '確認已繳 12堂'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ======================================================================
   STATS — monthly breakdown + unpaid list
   ====================================================================== */
function CoachStats({ coachName }: { coachName: string }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: coachStatsData } = trpc.coachStats.getAll.useQuery();
  const { data: dojos } = trpc.dojos.getAll.useQuery();
  const { data: quarterlyStatuses } = trpc.payments.getQuarterlyStatuses.useQuery({ year: currentYear });
  const [expandedQuarter, setExpandedQuarter] = useState<number | null>(currentQuarter);

  const myStat = useMemo(() => {
    if (!coachStatsData) return null;
    return (coachStatsData as any[]).find(s => s.coachName === coachName) || null;
  }, [coachStatsData, coachName]);

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return (allStudents as any[]).filter(s => s.coach === coachName && s.status === 'active' && s.venue !== '精英班道場');
  }, [allStudents, coachName]);

  const myStatuses = useMemo(() => {
    if (!quarterlyStatuses) return [];
    return (quarterlyStatuses as any[]).filter(s => s.coach === coachName);
  }, [quarterlyStatuses, coachName]);

  // Quarterly breakdown
  const quarterlyBreakdown = useMemo(() => {
    const quarters = [1, 2, 3, 4].map(q => {
      const qKey = `Q${q}` as const;
      const paid = myStatuses.filter(s => s[qKey] === 'paid');
      const unpaid = myStatuses.filter(s => s[qKey] === 'unpaid');
      const notDue = myStatuses.filter(s => s[qKey] !== 'paid' && s[qKey] !== 'unpaid');
      const paidAmount = paid.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0);
      const unpaidAmount = unpaid.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0);
      return {
        quarter: q,
        label: `${(q - 1) * 3 + 1}-${q * 3}月`,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        notDueCount: notDue.length,
        paidAmount,
        unpaidAmount,
        unpaidStudents: unpaid.map(s => ({
          id: s.studentId,
          name: s.studentName,
          phone: s.phone,
          venue: s.venue,
          fee: s.feePerQuarter,
        })),
      };
    });
    return quarters;
  }, [myStatuses]);

  // Venue breakdown
  const venueStats = useMemo(() => {
    const map = new Map<string, { count: number; totalFee: number }>();
    myStudents.forEach((s: any) => {
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
    myStudents.forEach((s: any) => { const b = s.beltLevel || '未分級'; map.set(b, (map.get(b) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [myStudents]);

  const myDojoCount = useMemo(() => {
    if (!dojos) return 0;
    return (dojos as any[]).filter(d => d.coachName === coachName && d.status === 'active').length;
  }, [dojos, coachName]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">統計總覽</h2>

      {/* Top summary */}
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
            <div className="text-3xl font-bold text-purple-700">${venueStats.reduce((s, [, d]) => s + d.totalFee, 0).toLocaleString()}</div>
            <div className="text-xs text-purple-600">季度學費總額</div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly breakdown - expandable with unpaid list */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{currentYear}年 季度繳費統計</CardTitle>
          <CardDescription className="text-xs">點擊展開查看未繳費學生名單</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {quarterlyBreakdown.map(q => (
            <div key={q.quarter}>
              <button
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all
                  ${expandedQuarter === q.quarter ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                onClick={() => setExpandedQuarter(expandedQuarter === q.quarter ? null : q.quarter)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">Q{q.quarter} ({q.label})</span>
                  {q.quarter <= currentQuarter && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${q.quarter === currentQuarter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {q.quarter === currentQuarter ? '當前季度' : '已過期'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600 font-medium">{q.paidCount} 已繳</span>
                  <span className="text-red-600 font-medium">{q.unpaidCount} 未繳</span>
                  <span className="text-gray-400">{q.notDueCount} 未到期</span>
                  {expandedQuarter === q.quarter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {expandedQuarter === q.quarter && (
                <div className="mt-2 ml-4 space-y-2">
                  {/* Revenue summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-green-50 text-center">
                      <div className="text-sm font-bold text-green-700">${q.paidAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-green-600">已收學費</div>
                    </div>
                    <div className="p-2 rounded bg-red-50 text-center">
                      <div className="text-sm font-bold text-red-700">${q.unpaidAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-red-600">未收學費</div>
                    </div>
                  </div>

                  {/* Unpaid students list */}
                  {q.unpaidStudents.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1">未繳費學生名單 ({q.unpaidStudents.length}人)：</p>
                      <div className="bg-white rounded border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs py-1">#</TableHead>
                              <TableHead className="text-xs py-1">姓名</TableHead>
                              <TableHead className="text-xs py-1">電話</TableHead>
                              <TableHead className="text-xs py-1">道場</TableHead>
                              <TableHead className="text-xs py-1 text-right">學費</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {q.unpaidStudents.map((s, i) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-xs py-1 text-gray-400">{i + 1}</TableCell>
                                <TableCell className="text-xs py-1 font-medium">{s.name}</TableCell>
                                <TableCell className="text-xs py-1 text-gray-600">{s.phone}</TableCell>
                                <TableCell className="text-xs py-1">{s.venue}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-mono">${s.fee}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-green-600 text-center py-2">本季度全部已繳！</p>
                  )}
                </div>
              )}
            </div>
          ))}
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
