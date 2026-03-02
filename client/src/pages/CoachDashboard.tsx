import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, KeyRound, ArrowLeft, Building2, Award, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Reuse shared components from admin
import { AttendanceManagementContent } from "@/components/AttendanceManagementContent";
import { MonthlyPaymentRecords } from "@/components/MonthlyPaymentRecords";
import CoachStatsWithElite from "@/components/CoachStatsWithElite";

export default function CoachDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 py-4 sm:py-6 overflow-x-hidden">
      <div className="container max-w-7xl overflow-x-hidden px-2 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">教練管理系統</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              歡迎，<span className="font-semibold text-green-700">{coachName}</span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => setShowChangePassword(true)} variant="outline" size="sm" className="text-xs sm:text-sm">
              <KeyRound className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">修改密碼</span>
            </Button>
            <Button onClick={async () => { await logout(); setLocation("/"); }} variant="outline" size="sm" className="text-xs sm:text-sm">
              <ArrowLeft className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </div>
        </div>

        {/* Main Tabs — mirrors Admin layout */}
        <Tabs defaultValue="regular" className="space-y-4">
          {/* Top-level navigation tabs */}
          <TabsList className="grid grid-cols-3 h-auto gap-1.5 sm:gap-2 p-2 w-full bg-muted/50 rounded-lg">
            <TabsTrigger value="regular" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-green-300 bg-green-50 text-green-700 rounded-md data-[state=active]:border-green-500 data-[state=active]:bg-green-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📋 恆常班管理</TabsTrigger>
            <TabsTrigger value="elite" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-amber-400 bg-amber-50 text-amber-700 rounded-md data-[state=active]:border-amber-500 data-[state=active]:bg-amber-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">🥋 精英班</TabsTrigger>
            <TabsTrigger value="coach-stats" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md data-[state=active]:border-blue-500 data-[state=active]:bg-blue-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📊 統計總覽</TabsTrigger>
          </TabsList>

          {/* ========= 恆常班管理 (sub-tabs mirror Admin) ========= */}
          <TabsContent value="regular">
            <Tabs defaultValue="students" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-green-50/80 rounded-lg border border-green-200">
                <TabsTrigger value="students" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">學生名單</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">繳費紀錄</TabsTrigger>
                <TabsTrigger value="attendance" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">點名管理</TabsTrigger>
                <TabsTrigger value="dojos" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">我的道場</TabsTrigger>
              </TabsList>

              {/* Student List */}
              <TabsContent value="students">
                <CoachStudentList coachName={coachName} />
              </TabsContent>

              {/* Payment Records — reuse shared component */}
              <TabsContent value="payments">
                <MonthlyPaymentRecords coachName={coachName} readOnly={true} />
              </TabsContent>

              {/* Attendance — reuse shared component */}
              <TabsContent value="attendance">
                <AttendanceManagementContent coachName={coachName} />
              </TabsContent>

              {/* Dojos */}
              <TabsContent value="dojos">
                <CoachDojos coachName={coachName} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ========= 精英班 ========= */}
          <TabsContent value="elite">
            <CoachElite coachName={coachName} />
          </TabsContent>

          {/* ========= 統計總覽 — reuse shared component ========= */}
          <TabsContent value="coach-stats">
            <CoachStatsWithElite />
          </TabsContent>
        </Tabs>

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
   STUDENT LIST — coach-only view
   ====================================================================== */
function CoachStudentList({ coachName }: { coachName: string }) {
  const { data: allStudents, isLoading } = trpc.students.getAll.useQuery();
  const [venueFilter, setVenueFilter] = useState("all");

  const myStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter((s: any) => s.coach === coachName && s.status === 'active' && s.venue !== '精英班道場');
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              恆常班學生名單
            </CardTitle>
            <CardDescription>共 {myStudents.length} 位活躍學生</CardDescription>
          </div>
          <Select value={venueFilter} onValueChange={setVenueFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-white">
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
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-6">
        {grouped.map(([key, students]) => {
          const [venue, day, time] = key.split('|');
          return (
            <div key={key} className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gradient-to-r from-green-50 to-teal-50 flex items-center justify-between">
                <div className="font-semibold text-sm">
                  {venue}
                  {day && <span className="text-green-600 ml-2">{day}</span>}
                  {time && <span className="text-gray-500 ml-2 text-xs">{time}</span>}
                </div>
                <span className="text-xs text-green-700 font-medium">{students.length} 人</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead className="hidden sm:table-cell">電話</TableHead>
                      <TableHead>級數</TableHead>
                      <TableHead className="text-right">學費/季</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s: any, i: number) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {s.name}
                          <div className="sm:hidden text-xs text-gray-500">{s.phone}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-gray-600 text-sm">{s.phone}</TableCell>
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
            </div>
          );
        })}
        {grouped.length === 0 && <EmptyState icon={<Users className="w-12 h-12" />} text="暫無學生資料" />}
      </CardContent>
    </Card>
  );
}

/* ======================================================================
   DOJOS — click to view students per dojo
   ====================================================================== */
function CoachDojos({ coachName }: { coachName: string }) {
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
      if (s.venue && s.coach === coachName && s.status === 'active' && s.venue !== '精英班道場') {
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            我的道場
          </CardTitle>
          <CardDescription>
            共 {myDojos.length} 個道場，{myClassGroups.length} 個班別，{totalStudents} 位學生
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {myDojos.map(dojo => {
              const students = venueStudentMap.get(dojo.name) || [];
              const isExpanded = expandedVenue === dojo.name;
              return (
                <button
                  key={dojo.id}
                  className={`rounded-lg border p-3 text-center cursor-pointer transition-all hover:shadow-md
                    ${isExpanded ? 'bg-green-100 border-green-400 ring-2 ring-green-300' : 'bg-white border-green-200 hover:border-green-400'}`}
                  onClick={() => setExpandedVenue(isExpanded ? null : dojo.name)}
                >
                  <div className="text-lg font-bold text-green-700">{students.length}</div>
                  <div className="text-xs text-gray-600 truncate">{dojo.name}</div>
                  <div className="text-[10px] text-green-500 mt-0.5">
                    {isExpanded ? <ChevronUp className="w-3 h-3 mx-auto" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expanded student list for selected venue */}
          {expandedVenue && (
            <div className="border rounded-lg border-green-300 mb-4">
              <div className="px-3 py-2 bg-gradient-to-r from-green-100 to-teal-100 flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-green-600" />
                  {expandedVenue} - 學生名單
                </span>
                <span className="text-xs text-green-700 font-medium">
                  {(venueStudentMap.get(expandedVenue) || []).length} 位學生
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead className="hidden sm:table-cell">電話</TableHead>
                      <TableHead>星期</TableHead>
                      <TableHead className="hidden sm:table-cell">時段</TableHead>
                      <TableHead>級數</TableHead>
                      <TableHead className="text-right">學費/季</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(venueStudentMap.get(expandedVenue) || []).map((s: any, i: number) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {s.name}
                          <div className="sm:hidden text-xs text-gray-500">{s.phone}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-gray-600">{s.phone}</TableCell>
                        <TableCell className="text-sm">{s.scheduleDay || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{s.scheduleTime || '-'}</TableCell>
                        <TableCell>
                          {s.beltLevel ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{s.beltLevel}</span> : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">${s.feePerQuarter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed class view per venue */}
      {groupedByVenue.map(([venue, classes]) => (
        <Card key={venue}>
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
   ELITE — with attendance table + confirm payment
   ====================================================================== */
function CoachElite({ coachName }: { coachName: string }) {
  const { data: eliteStudents, isLoading } = trpc.elite.getStudents.useQuery();
  const { data: allCycleInfo } = trpc.elite.getAllCycleInfo.useQuery();
  const { data: elitePayments, refetch: refetchPayments } = trpc.elite.getPayments.useQuery();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Elite attendance data
  const { data: eliteSchedules } = trpc.elite.getSchedules.useQuery({ year: selectedYear, month: selectedMonth });
  const { data: eliteAttendance, refetch: refetchEliteAttendance } = trpc.elite.getAttendance.useQuery();
  const upsertEliteAttendance = trpc.elite.upsertAttendance.useMutation({
    onSuccess: () => refetchEliteAttendance(),
    onError: (err: any) => toast.error(`點名更新失敗: ${err.message}`),
  });

  // Confirm elite payment
  const [confirmEliteDialog, setConfirmEliteDialog] = useState<{ studentId: number; studentName: string } | null>(null);
  const createElitePayment = trpc.elite.createPayment.useMutation({
    onSuccess: () => {
      toast.success('精英班繳費已確認');
      setConfirmEliteDialog(null);
      refetchPayments();
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

      {/* Sub-tabs using Tabs component for consistency */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-amber-50/80 rounded-lg border border-amber-200">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">學生總覽</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">點名表</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">繳費確認</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead className="hidden sm:table-cell">電話</TableHead>
                    <TableHead>級數</TableHead>
                    <TableHead className="text-center">已購堂</TableHead>
                    <TableHead className="text-center">已上堂</TableHead>
                    <TableHead className="text-center">剩餘堂</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">循環進度</TableHead>
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
                        <TableCell className="font-medium text-sm">
                          {s.name}
                          <div className="sm:hidden text-xs text-gray-500">{s.phone}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-gray-600">{s.phone}</TableCell>
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
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{cycleProgress}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEliteMonthChange("prev")}>◀</Button>
              <span className="font-medium text-sm">{selectedYear}年{selectedMonth}月</span>
              <Button variant="outline" size="sm" onClick={() => handleEliteMonthChange("next")}>▶</Button>
            </div>
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-10 min-w-[80px]">學生</TableHead>
                      {monthSchedules.map((s: any) => (
                        <TableHead key={s.id} className={`text-center min-w-[48px] text-xs ${s.status === 'cancelled' ? 'bg-red-50 line-through text-red-400' : ''}`}>
                          {s.date.getDate()}/{s.date.getMonth() + 1}
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
                          if (isCancelled) {
                            return (
                              <TableCell key={s.id} className="text-center">
                                <span className="text-red-300 text-xs">停</span>
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell
                              key={s.id}
                              className="text-center p-0 cursor-pointer select-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEliteToggle(student.id, s.id);
                              }}
                            >
                              <div
                                className={`w-full min-h-[44px] flex items-center justify-center text-sm font-bold
                                  ${status === 'present' ? 'bg-green-100 text-green-700'
                                    : status === 'absent' ? 'bg-red-100 text-red-600'
                                    : 'bg-gray-50 text-gray-400'}`}
                              >
                                {status === 'present' ? '✅' : status === 'absent' ? '❌' : '·'}
                              </div>
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
            {monthSchedules.length === 0 && <p className="text-center text-gray-400 text-sm py-4">本月暫無訓練日期</p>}
          </div>
        </TabsContent>

        <TabsContent value="payments">
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
                        <TableCell className="font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-center font-mono">{cycle?.paidClasses || 0}</TableCell>
                        <TableCell className="text-center font-mono">{cycle?.attendedClasses || 0}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${remaining <= 2 ? 'text-red-600' : 'text-green-600'}`}>{remaining}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[10px] text-gray-400">僅管理員</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
