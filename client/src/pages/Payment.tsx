import { useState, useRef, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDayMonthYear, formatDayMonthWeekday } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Upload, Loader2, CheckCircle2, KeyRound, DollarSign,
  CalendarDays, Award, ClipboardList, CreditCard, ChevronLeft, ChevronRight,
  XCircle, Clock, MinusCircle, CalendarOff, ChevronDown, ChevronUp, AlertCircle, History as HistoryIcon,
  User, MapPin, Trophy, FileText, Calendar
} from "lucide-react";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { toast } from "sonner";

type PaymentPeriod = "Q1" | "Q2" | "Q3" | "Q4" | "CUSTOM";

const PERIOD_OPTIONS = [
  { value: "Q1", label: "1-3月（季繳）" },
  { value: "Q2", label: "4-6月（季繳）" },
  { value: "Q3", label: "7-9月（季繳）" },
  { value: "Q4", label: "10-12月（季繳）" },
  { value: "CUSTOM", label: "自選月份" },
] as const;

const ATTENDANCE_STATUS_CONFIG = {
  present: { label: "出席", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  absent: { label: "缺席", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  late: { label: "遲到", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  excused: { label: "請假", icon: MinusCircle, color: "text-blue-600", bg: "bg-blue-50" },
} as const;

type TabType = "overview" | "regular-attendance" | "regular-payment" | "elite" | "events" | "exam-results";

export default function Payment() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") || "";
  const initialTab = (params.get("tab") as TabType) || "overview";
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 恆常班學生
  const { data: students, isLoading: studentsLoading } = trpc.students.getByPhone.useQuery({ phone });
  // 精英班資料
  const { data: eliteInfo, isLoading: eliteLoading } = trpc.students.getParentEliteInfo.useQuery(
    { phone },
    { enabled: !!phone }
  );

  const hasRegular = students && students.length > 0;
  const hasElite = eliteInfo && eliteInfo.length > 0;

  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="mb-4">請先登入家長系統</p>
            <Button onClick={() => setLocation("/parent-login")}>返回登入</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (studentsLoading || eliteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabItems = [
    { key: "overview" as TabType, label: "總覽", icon: ClipboardList, shortLabel: "總覽" },
    ...(hasRegular ? [{ key: "regular-attendance" as TabType, label: "恆常班出席", icon: CalendarDays, shortLabel: "出席" }] : []),
    ...(hasRegular ? [{ key: "regular-payment" as TabType, label: "恆常班繳費", icon: CreditCard, shortLabel: "繳費" }] : []),
    ...(hasElite ? [{ key: "elite" as TabType, label: "精英班", icon: Award, shortLabel: "精英班" }] : []),
    { key: "events" as TabType, label: "報名活動", icon: Trophy, shortLabel: "活動" },
    { key: "exam-results" as TabType, label: "考試成績", icon: Award, shortLabel: "成績" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 頂部導航 */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-14">
            <Button onClick={() => setLocation("/")} variant="ghost" size="sm" className="px-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">返回首頁</span>
            </Button>
            <h1 className="text-base sm:text-lg font-bold text-gray-800">
              家長查詢系統
            </h1>
            <Button onClick={() => setShowChangePassword(true)} variant="ghost" size="sm" className="px-2">
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">密碼</span>
            </Button>
          </div>

          {/* Tab 導航 */}
          <div className="flex border-b overflow-x-auto no-scrollbar">
            {tabItems.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 主要內容 */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            students={students || []}
            eliteInfo={eliteInfo || []}
            hasRegular={!!hasRegular}
            hasElite={!!hasElite}
            onNavigate={setActiveTab}
            phone={phone}
          />
        )}
        {activeTab === "regular-attendance" && hasRegular && (
          <RegularAttendanceTab phone={phone} />
        )}
        {activeTab === "regular-payment" && hasRegular && (
          <RegularPaymentTab phone={phone} students={students!} />
        )}
        {activeTab === "elite" && hasElite && (
          <EliteTab eliteInfo={eliteInfo!} />
        )}
        {activeTab === "events" && (
          <EventsTab phone={phone} students={students || []} eliteInfo={eliteInfo || []} />
        )}
        {activeTab === "exam-results" && (
          <ExamResultsTab phone={phone} />
        )}
      </div>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        phone={phone}
        userType="parent"
        userName={students?.[0]?.name}
      />
    </div>
  );
}


// ================= 總覽 Tab =================
function OverviewTab({ students, eliteInfo, hasRegular, hasElite, onNavigate, phone }: {
  students: any[];
  eliteInfo: any[];
  hasRegular: boolean;
  hasElite: boolean;
  onNavigate: (tab: TabType) => void;
  phone: string;
}) {
  // Belt color mapping
  const getBeltColor = (belt: string) => {
    const b = (belt || '').toLowerCase();
    if (b.includes('白') || b.includes('white')) return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', dot: 'bg-gray-400' };
    if (b.includes('黃') || b.includes('yellow')) return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-400' };
    if (b.includes('綠') || b.includes('green')) return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' };
    if (b.includes('藍') || b.includes('blue')) return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' };
    if (b.includes('紅') || b.includes('red')) return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' };
    if (b.includes('黑') || b.includes('black')) return { bg: 'bg-gray-900', border: 'border-gray-700', text: 'text-white', dot: 'bg-gray-900' };
    return { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-400' };
  };

  return (
    <div className="space-y-4">
      {/* 歡迎區塊 */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="py-5">
          <h2 className="text-xl font-bold mb-1">
            你好，{students[0]?.name || eliteInfo?.[0]?.student?.name || '家長'} 👋
          </h2>
          <p className="text-blue-100 text-sm">
            {hasRegular && hasElite
              ? `恆常班 ${students.length} 位學生 · 精英班 ${eliteInfo.length} 位學生`
              : hasRegular
              ? `恆常班 ${students.length} 位學生`
              : `精英班 ${eliteInfo.length} 位學生`}
          </p>
        </CardContent>
      </Card>

      {/* 學生資料卡 */}
      {hasRegular && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              學生資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map(student => {
              const beltStyle = getBeltColor(student.beltLevel);
              return (
                <div key={student.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-base">{student.name}</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${beltStyle.bg} ${beltStyle.border} ${beltStyle.text}`}>
                      <span className={`w-2 h-2 rounded-full ${beltStyle.dot}`}></span>
                      {student.beltLevel || '未設定'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{student.venue || '未設定'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{student.scheduleDay || ''} {student.scheduleTime || ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>${student.feePerQuarter}/季</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 精英班學生資料 */}
      {hasElite && (
        <Card className="shadow-sm border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              精英班
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eliteInfo.map(item => {
              const { student, totalAttended, paidClasses, remainingClasses, needPayment, cycleNumber } = item;
              const currentInCycle = cycleNumber || 0;
              const beltStyle = getBeltColor(student.beltLevel);
              return (
                <div key={student.id} className="p-4 bg-amber-50/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-base">{student.name}</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${beltStyle.bg} ${beltStyle.border} ${beltStyle.text}`}>
                      <span className={`w-2 h-2 rounded-full ${beltStyle.dot}`}></span>
                      {student.beltLevel || '未設定'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{student.scheduleDay || ''} {student.scheduleTime || ''}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-lg font-bold text-green-600">{totalAttended}</div>
                      <div className="text-xs text-gray-500">累計出席</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-lg font-bold text-purple-600">{paidClasses}</div>
                      <div className="text-xs text-gray-500">已付堂數</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className={`text-lg font-bold ${remainingClasses <= 0 ? 'text-red-600' : remainingClasses <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>
                        {Math.max(0, remainingClasses)}
                      </div>
                      <div className="text-xs text-gray-500">剩餘堂數</div>
                    </div>
                  </div>
                  {/* 進度條 */}
                  <div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${remainingClasses <= 0 ? 'bg-red-500' : remainingClasses <= 3 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min((currentInCycle / 12) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>當期 {currentInCycle}/12 堂</span>
                      {needPayment ? (
                        <span className="text-red-600 font-semibold">需繳費</span>
                      ) : (
                        <span className="text-green-600">已繳費</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" className="w-full text-sm border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => onNavigate("elite")}>
              <Award className="w-4 h-4 mr-2" />
              查看精英班詳情
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 快捷操作 */}
      <div className="grid grid-cols-2 gap-3">
        {hasRegular && (
          <>
            <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("regular-payment")}>
              <CardContent className="py-4 flex flex-col items-center gap-2">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium">繳費</span>
              </CardContent>
            </Card>
            <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("regular-attendance")}>
              <CardContent className="py-4 flex flex-col items-center gap-2">
                <CalendarDays className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium">出席記錄</span>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("events")}>
          <CardContent className="py-4 flex flex-col items-center gap-2">
            <Trophy className="w-6 h-6 text-orange-600" />
            <span className="text-sm font-medium">報名活動</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// ================= 恆常班出席 Tab =================
function RegularAttendanceTab({ phone }: { phone: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: attendanceData, isLoading } = trpc.students.getParentAttendance.useQuery(
    { phone, year, month },
    { enabled: !!phone }
  );

  const handlePrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-4">
      {/* 月份切換 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-bold text-gray-900">
              {year}年{month}月
            </h2>
            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(ATTENDANCE_STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-center gap-1 text-xs">
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              <span className="text-gray-600">{config.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1 text-xs">
          <CalendarOff className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-600">休息</span>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-gray-500">載入中...</CardContent></Card>
      ) : !attendanceData || attendanceData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">本月無訓練資料</CardContent></Card>
      ) : (
        attendanceData.map((studentData: any) => {
          const { student, schedules } = studentData;
          const activeSchedules = schedules.filter((s: any) => s.status === 'active');
          const presentCount = schedules.filter((s: any) => s.attendanceStatus === 'present').length;
          const absentCount = schedules.filter((s: any) => s.attendanceStatus === 'absent').length;
          const lateCount = schedules.filter((s: any) => s.attendanceStatus === 'late').length;
          const excusedCount = schedules.filter((s: any) => s.attendanceStatus === 'excused').length;
          const totalActive = activeSchedules.length;
          const attendanceRate = totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0;

          return (
            <Card key={student.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{student.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{student.venue} · {student.scheduleDay} · {student.scheduleTime}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {attendanceRate}%
                    </div>
                    <p className="text-xs text-gray-500">出席率</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 bg-green-50 rounded"><div className="text-lg font-bold text-green-600">{presentCount}</div><div className="text-xs text-gray-500">出席</div></div>
                  <div className="text-center p-2 bg-red-50 rounded"><div className="text-lg font-bold text-red-600">{absentCount}</div><div className="text-xs text-gray-500">缺席</div></div>
                  <div className="text-center p-2 bg-amber-50 rounded"><div className="text-lg font-bold text-amber-600">{lateCount}</div><div className="text-xs text-gray-500">遲到</div></div>
                  <div className="text-center p-2 bg-blue-50 rounded"><div className="text-lg font-bold text-blue-600">{excusedCount}</div><div className="text-xs text-gray-500">請假</div></div>
                </div>

                {schedules.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">本月無訓練日期</p>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((schedule: any) => {
                      const date = new Date(schedule.date);
                      const dayOfWeek = ['日','一','二','三','四','五','六'][date.getUTCDay()];
                      const dateStr = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
                      const isCancelled = schedule.status === 'cancelled';

                      if (isCancelled) {
                        return (
                          <div key={schedule.scheduleId} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 opacity-60">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-400 w-12 line-through">{dateStr}</span>
                              <span className="text-xs text-gray-400">(星期{dayOfWeek})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CalendarOff className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-400">休息</span>
                            </div>
                          </div>
                        );
                      }

                      const attendanceStatus = schedule.attendanceStatus as keyof typeof ATTENDANCE_STATUS_CONFIG | null;
                      const config = attendanceStatus ? ATTENDANCE_STATUS_CONFIG[attendanceStatus] : null;

                      return (
                        <div key={schedule.scheduleId} className={`flex items-center justify-between p-2.5 rounded-lg ${config ? config.bg : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 w-12">{dateStr}</span>
                            <span className="text-xs text-gray-500">(星期{dayOfWeek})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {config ? (
                              <>
                                {(() => { const Icon = config.icon; return <Icon className={`w-4 h-4 ${config.color}`} />; })()}
                                <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">未記錄</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}


// ================= 恆常班繳費 Tab =================
function RegularPaymentTab({ phone, students }: { phone: string; students: any[] }) {
  const [, setLocation] = useLocation();
  const studentIds = students.map(s => s.id);
  const { data: existingPayments } = trpc.payments.getByStudentIds.useQuery(
    { studentIds },
    { enabled: studentIds.length > 0 }
  );

  // 月份繳費狀態
  const currentYear = new Date().getFullYear();
  const { data: monthlyStatuses } = trpc.payments.getParentMonthlyStatuses.useQuery(
    { phone, year: currentYear },
    { enabled: !!phone }
  );
  const currentMonth = new Date().getMonth() + 1;
  const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // 如果只有一位學生，自動選中
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(
    students.length === 1 ? [students[0].id] : []
  );
  // 自動選擇當前月份
  const currentQ = `Q${Math.ceil(currentMonth / 3)}` as PaymentPeriod;
  const [period, setPeriod] = useState<PaymentPeriod>(currentQ);
  const [customMonths, setCustomMonths] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractedAmount, setExtractedAmount] = useState<string>("");
  const [extractedBank, setExtractedBank] = useState<string>("");
  const [extractedStatus, setExtractedStatus] = useState<string>("");
  const [extractedDateTime, setExtractedDateTime] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPayment = trpc.payments.create.useMutation();
  const createMergedPayment = trpc.payments.createMergedPayment.useMutation();

  // 判斷某位學生的某季度是否已繳費（confirmed 狀態即視為已付）
  const isPeriodPaid = (studentId: number, checkPeriod: PaymentPeriod) => {
    if (!existingPayments) return false;
    return existingPayments.some(
      payment =>
        payment.studentId === studentId &&
        payment.paymentPeriod === checkPeriod &&
        payment.status === 'confirmed'
    );
  };

  // 判斷某季度是否所有學生都已繳費（用於鎖定該季度，不依賴已選學生）
  const isPeriodFullyPaid = (checkPeriod: PaymentPeriod) => {
    if (!existingPayments || students.length === 0) return false;
    return students.every(student => isPeriodPaid(student.id, checkPeriod));
  };

  // 取得某季度的繳費資訊（顯示確認日期和來源）
  const getPeriodPaymentInfo = (p: PaymentPeriod) => {
    if (!existingPayments) return null;
    // 優先從已選學生找，否則從所有學生找
    const searchIds = selectedStudentIds.length > 0 ? selectedStudentIds : students.map(s => s.id);
    for (const studentId of searchIds) {
      const payment = existingPayments.find(
        pay => pay.studentId === studentId && pay.paymentPeriod === p && pay.status === 'confirmed'
      );
      if (payment) {
        const date = payment.receiptTransferDate
          ? new Date(payment.receiptTransferDate)
          : new Date(payment.paymentDate);
        const confirmedBy = (payment as any).confirmedBy;
        return { date, confirmedBy };
      }
    }
    return null;
  };

  // 當前選擇是否已繳費（用於提交按鈕禁用）
  const isCurrentSelectionPaid = () => {
    // 如果該季度所有學生都已繳費，直接鎖定
    if (isPeriodFullyPaid(period)) return true;
    // 如果已選學生中有人已繳該季度，也鎖定
    if (selectedStudentIds.length === 0) return false;
    return selectedStudentIds.some(studentId => isPeriodPaid(studentId, period));
  };

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.length === 0) { toast.error("請選擇至少一位學生"); return; }
    if (isCurrentSelectionPaid()) { toast.error("所選學生已繳交此期間的學費,請勿重複繳費"); return; }
    if (!receiptFile) { toast.error("請上傳收據照片"); return; }
    if (period === "CUSTOM" && !customMonths.trim()) { toast.error("請輸入自選月份"); return; }

    setIsSubmitting(true);
    try {
      // Convert file to base64 using Promise wrapper
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const result = (reader.result as string).split(",")[1];
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("讀取檔案失敗"));
        reader.readAsDataURL(receiptFile);
      });

      let hasPendingRecipient = false;
      let lastPendingReason = '';
      let hasNeedsReview = false;
      let lastReviewReason = '';

      // 使用合併繳費 API（一張收據對應多個學生）
      const result = await createMergedPayment.mutateAsync({
        studentIds: selectedStudentIds,
        paymentPeriod: period,
        customMonths: period === "CUSTOM" ? customMonths.split(",").map(m => m.trim()) : undefined,
        amount: "0",
        receiptBase64: base64,
        receiptMimeType: receiptFile.type,
      });
      if (result.extractedAmount) setExtractedAmount(result.extractedAmount);
      if (result.extractedBank) setExtractedBank(result.extractedBank);
      if (result.extractedStatus) setExtractedStatus(result.extractedStatus);
      if (result.extractedDateTime) setExtractedDateTime(result.extractedDateTime);
      if (result.needsReview) {
        hasNeedsReview = true;
        lastReviewReason = result.reviewReason || '';
      }
      if (result.status === 'pending' && !result.needsReview) {
        hasPendingRecipient = true;
        lastPendingReason = result.pendingReason || '';
      }
      if (hasNeedsReview) {
        // 疑似重複收據 → 需審查
        toast("收據已提交，但偵測到疑似重複交易，管理員將進行審查。", {
          duration: 8000,
          icon: "⚠️",
          description: lastReviewReason || "請耐心等待審查結果通知。",
        });
      } else if (hasPendingRecipient) {
        // 收款人帳號不符或金額不符 → 待人工審核
        const reasonParts: string[] = [];
        if (lastPendingReason.includes('金額不符')) reasonParts.push('金額不符');
        if (lastPendingReason.includes('收款人不匹配')) reasonParts.push('收款帳號不正確');
        const reasonText = reasonParts.length > 0 ? `（${reasonParts.join('、')}）` : '';
        toast.error(`收據已提交，但需要人工審核${reasonText}。請確認轉帳收款人是否正確。`, { duration: 8000 });
      } else {
        toast.success("繳費記錄已成功提交!");
      }
      setTimeout(() => setLocation(`/history?phone=${encodeURIComponent(phone)}`), 2000);
    } catch (err: any) {
      console.error("提交繳費失敗:", err);
      toast.error(err?.message || "提交失敗,請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 繳費記錄按鈕 */}
      <div className="flex justify-end">
        <Button onClick={() => setLocation(`/history?phone=${encodeURIComponent(phone)}`)} variant="outline" size="sm">
          <HistoryIcon className="w-4 h-4 mr-1" />
          繳費記錄
        </Button>
      </div>

      {/* 月份繳費狀態 */}
      {monthlyStatuses && monthlyStatuses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              {currentYear}年 繳費狀態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthlyStatuses.map((studentStatus: any) => {
              const student = students.find(s => s.id === studentStatus.studentId);
              const unpaidCount = Object.values(studentStatus.months).filter((m: any) => m.status === 'unpaid').length;
              return (
                <div key={studentStatus.studentId} className="space-y-2">
                  {students.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{student?.name}</span>
                      {unpaidCount > 0 ? (
                        <span className="text-xs text-red-600 font-medium">{unpaidCount}個月未繳</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">已繳清</span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-1">
                    {MONTH_LABELS.map((label, i) => {
                      const m = i + 1;
                      const mStatus = studentStatus.months[m]?.status;
                      return (
                        <div
                          key={m}
                          className={`h-10 rounded-md flex flex-col items-center justify-center text-xs font-medium ${
                            mStatus === 'paid' ? 'bg-green-100 text-green-700 border border-green-300' :
                            mStatus === 'unpaid' ? 'bg-red-100 text-red-700 border border-red-300' :
                            'bg-gray-100 text-gray-400 border border-gray-200'
                          } ${m === currentMonth ? 'ring-2 ring-blue-500' : ''}`}
                          title={`${label}: ${mStatus === 'paid' ? '已繳' : mStatus === 'unpaid' ? '未繳' : '未到期'}`}
                        >
                          <span className="text-[10px] leading-none">{label}</span>
                          <span className="text-[9px] leading-none mt-0.5">
                            {mStatus === 'paid' ? '✓' : mStatus === 'unpaid' ? '✗' : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* 圖例 */}
            <div className="flex gap-4 text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>已繳</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>未繳</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span>未到期</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-blue-500"></span>本月</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 選擇學生 - 只有一位學生時自動選中，不顯示勾選 */}
      {students.length === 1 ? (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{students[0].name}</div>
                <div className="text-sm text-gray-500">{students[0].venue} · {students[0].scheduleDay} {students[0].scheduleTime} · {students[0].beltLevel}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-blue-600">${students[0].feePerQuarter}</div>
                <div className="text-xs text-gray-500">每季學費</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">選擇學生</CardTitle>
            <CardDescription>請選擇要繳費的恆常班學生 (可多選，支援季繳或月繳)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map(student => (
              <div key={student.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                <Checkbox
                  id={`student-${student.id}`}
                  checked={selectedStudentIds.includes(student.id)}
                  onCheckedChange={() => handleStudentToggle(student.id)}
                />
                <Label htmlFor={`student-${student.id}`} className="flex-1 cursor-pointer">
                  <div className="font-medium">{student.name}</div>
                  <div className="text-sm text-gray-500">{student.venue} · {student.scheduleDay} {student.scheduleTime} · {student.beltLevel}</div>
                </Label>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">${student.feePerQuarter}</div>
                  <div className="text-xs text-gray-500">每季學費</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 繳費期間 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">繳費期間</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={period} onValueChange={(v) => setPeriod(v as PaymentPeriod)}>
            {PERIOD_OPTIONS.map(option => {
              const periodValue = option.value as PaymentPeriod;
              // 所有學生都已繳費 → 完全鎖定
              const allPaid = isPeriodFullyPaid(periodValue);
              // 已選學生中有人已繳費 → 鎖定（選了人之後才檢查）
              const selectedPaid = selectedStudentIds.length > 0 && selectedStudentIds.some(sid => isPeriodPaid(sid, periodValue));
              const isLocked = allPaid || selectedPaid;
              const paymentInfo = getPeriodPaymentInfo(periodValue);

              return (
                <div key={option.value} className={`flex items-center space-x-3 p-3 rounded-lg ${
                  allPaid
                    ? 'bg-green-50 border border-green-200 opacity-60'
                    : selectedPaid
                    ? 'bg-yellow-50 border border-yellow-200 opacity-70'
                    : 'hover:bg-gray-50'
                }`}>
                  <RadioGroupItem value={option.value} id={option.value} disabled={isLocked} />
                  <Label htmlFor={option.value} className={`flex-1 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <div className="flex items-center gap-2">
                      <span>{option.label}</span>
                      {allPaid && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> 已繳交
                        </span>
                      )}
                      {!allPaid && selectedPaid && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                          ⚠️ 部分已繳
                        </span>
                      )}
                    </div>
                    {isLocked && paymentInfo && (
                      <div className="text-xs text-green-700 mt-1">
                        {paymentInfo.confirmedBy === 'parent_upload'
                          ? `家長於 ${formatDayMonthYear(paymentInfo.date)} 上傳收據繳費`
                          : `管理員於 ${formatDayMonthYear(paymentInfo.date)} 確認已繳費`}
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          {period === "CUSTOM" && (
            <div className="mt-4">
              <Label htmlFor="customMonths">自選月份 (用逗號分隔)</Label>
              <Input id="customMonths" value={customMonths} onChange={e => setCustomMonths(e.target.value)} placeholder="例如: 1月, 2月, 3月" className="mt-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 收據上傳 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">上傳收據</CardTitle>
          <CardDescription>上傳收據照片,系統會自動識別金額</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {receiptPreview ? (
            <div className="space-y-4">
              <img src={receiptPreview} alt="收據預覽" className="w-full max-h-96 object-contain rounded-lg border" />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">更換收據</Button>
            </div>
          ) : (
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-32 border-dashed">
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <span>點擊上傳收據照片</span>
              </div>
            </Button>
          )}
          {(extractedAmount || extractedBank || extractedStatus || extractedDateTime) && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>收據識別結果</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {extractedAmount && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-green-100">
                    <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">金額</div>
                      <div className="font-semibold text-green-700">${extractedAmount}</div>
                    </div>
                  </div>
                )}
                {extractedBank && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-green-100">
                    <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div>
                      <div className="text-xs text-gray-500">銀行</div>
                      <div className="font-semibold text-blue-700">{extractedBank}</div>
                    </div>
                  </div>
                )}
                {extractedStatus && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-green-100">
                    {/成功|完成|Successful|Completed|Done|Confirmed/i.test(extractedStatus) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : /失敗|Failed|Rejected|Declined/i.test(extractedStatus) ? (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs text-gray-500">轉帳狀態</div>
                      <div className={`font-semibold ${
                        /成功|完成|Successful|Completed|Done|Confirmed/i.test(extractedStatus) ? 'text-green-700'
                        : /失敗|Failed|Rejected|Declined/i.test(extractedStatus) ? 'text-red-700'
                        : 'text-amber-700'
                      }`}>{extractedStatus}</div>
                    </div>
                  </div>
                )}
                {extractedDateTime && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-green-100">
                    <CalendarDays className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">轉帳日期時間</div>
                      <div className="font-semibold text-purple-700">{extractedDateTime}</div>
                    </div>
                  </div>
                )}
              </div>
              {extractedStatus && /失敗|不成功|Failed|Rejected|Declined/i.test(extractedStatus) && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ⚠️ 識別到轉帳可能未成功，請確認收據是否正確。如有疑問請聯絡管理員。
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已繳費警告 */}
      {isCurrentSelectionPaid() && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-1">⚠️ 此期間已繳費</h4>
          <p className="text-sm text-yellow-700">請勿重複繳費。如有疑問,請聯繫道館管理員。</p>
        </div>
      )}

      {/* 提交 */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedStudentIds.length === 0 || !receiptFile || isCurrentSelectionPaid()}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {isSubmitting ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />處理中...</>
        ) : isCurrentSelectionPaid() ? "此期間已繳費" : "確認提交"}
      </Button>
    </div>
  );
}


// ================= 精英班 Tab =================
function EliteTab({ eliteInfo }: { eliteInfo: any[] }) {
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* 精英班說明 */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-amber-800">精英班</span>
          </div>
          <p className="text-sm text-amber-700">每期 12 堂 · 每堂 $200 · 每期 $2,400</p>
        </CardContent>
      </Card>

      {eliteInfo.map(item => {
        const { student, totalAttended, cycleNumber, paidClasses, remainingClasses, needPayment, attendanceDetails, payments } = item;
        const isExpanded = expandedStudentId === student.id;
        const currentInCycle = cycleNumber || 0;
        const remainingInCycle = 12 - currentInCycle;
        const unpaidClasses = Math.max(0, totalAttended - paidClasses);

        return (
          <Card key={student.id} className="overflow-hidden">
            {/* 學生摘要 */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{student.name}</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {student.scheduleDay || ''} {student.scheduleTime || ''} · {student.beltLevel || ''}
                  </p>
                </div>
                {needPayment ? (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-semibold text-sm">需繳費</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold text-sm">已繳費</span>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* 統計摘要 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-600">{totalAttended}</div>
                  <div className="text-xs text-gray-500">累計出席</div>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded">
                  <div className="text-lg font-bold text-purple-600">{paidClasses}</div>
                  <div className="text-xs text-gray-500">已付堂數</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className={`text-lg font-bold ${remainingClasses <= 0 ? 'text-red-600' : remainingClasses <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>
                    {Math.max(0, remainingClasses)}
                  </div>
                  <div className="text-xs text-gray-500">剩餘堂數</div>
                </div>
              </div>

              {/* 當前期數進度條 */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>當前期數進度</span>
                  <span>第 {currentInCycle}/12 堂</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${remainingInCycle <= 3 ? 'bg-red-500' : remainingInCycle <= 6 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min((currentInCycle / 12) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className={remainingInCycle <= 3 ? "text-red-600 font-semibold" : "text-gray-500"}>剩餘 {remainingInCycle} 堂</span>
                  {remainingClasses > 0 && <span className="text-green-600">餘額 {remainingClasses} 堂</span>}
                </div>
              </div>

              {/* 繳費提醒 */}
              {needPayment && unpaidClasses > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-red-800 font-medium">需繳交下一期費用 $2,400</p>
                      <p className="text-red-600 mt-1">
                        未付 {unpaidClasses} 堂 · 共 {Math.ceil(unpaidClasses / 12)} 期 · 合計 ${unpaidClasses * 200}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 繳費紀錄 */}
              {payments && payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">繳費紀錄</h4>
                  <div className="space-y-1.5">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatDayMonthYear(p.paymentDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${p.amount}</span>
                          <span className="text-xs text-gray-500">({p.classCount}堂)</span>
                          {p.status === 'confirmed' ? (
                            <span className="text-xs text-green-600">✓</span>
                          ) : (
                            <span className="text-xs text-yellow-600">待確認</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            {/* 展開/收起出席詳情 */}
            <div className="border-t">
              <Button
                variant="ghost"
                className="w-full h-10 rounded-none text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
              >
                <CalendarDays className="w-4 h-4 mr-1" />
                {isExpanded ? "收起出席詳情" : "查看出席詳情"}
                {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
            </div>

            {/* 出席詳情 */}
            {isExpanded && attendanceDetails && (
              <div className="border-t bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">出席記錄（共 {attendanceDetails.length} 堂）</div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">堂數</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">日期</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-600">期數</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-600">繳費</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceDetails.map((record: any, index: number) => {
                        const isNewCycle = record.cycleNumber === 1;
                        const isPaid = record.classNumber <= paidClasses;

                        return (
                          <tr key={record.classNumber}>
                            {isNewCycle && index > 0 && (
                              <td colSpan={4} className="p-0">
                                <div className="py-2 px-3 bg-amber-50 border-t border-b border-amber-200">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-xs font-semibold text-amber-700">
                                      第 {record.cycleIndex} 期（$2,400）
                                      {isPaid ? <span className="ml-2 text-green-600">已繳費</span> : <span className="ml-2 text-red-600">未繳費</span>}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            )}
                            <td className={`py-2 px-3 border-t border-gray-100 ${!isPaid ? 'bg-red-50/50' : ''}`}>
                              <span className="text-gray-700">第 {record.classNumber} 堂</span>
                              <span className="text-gray-400 text-xs ml-1">({record.cycleNumber}/12)</span>
                            </td>
                            <td className={`py-2 px-3 border-t border-gray-100 text-gray-700 ${!isPaid ? 'bg-red-50/50' : ''}`}>
                              {formatDayMonthWeekday(record.date)}
                            </td>
                            <td className={`py-2 px-3 border-t border-gray-100 text-center text-xs ${!isPaid ? 'bg-red-50/50' : ''}`}>第 {record.cycleIndex} 期</td>
                            <td className={`py-2 px-3 border-t border-gray-100 text-center ${!isPaid ? 'bg-red-50/50' : ''}`}>
                              {isPaid ? <span className="text-green-600 text-xs font-medium">已付</span> : <span className="text-red-600 text-xs font-medium">未付</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


// ================= 報名活動 Tab =================
function EventsTab({ phone, students, eliteInfo }: { phone: string; students: any[]; eliteInfo: any[] }) {
  const { data: openEvents, isLoading: eventsLoading } = trpc.events.getOpen.useQuery();
  const { data: myRegistrations, isLoading: regsLoading, refetch: refetchRegs } = trpc.events.getMyRegistrations.useQuery({ phone });

  const registerMutation = trpc.events.register.useMutation();
  const cancelMutation = trpc.events.cancelRegistration.useMutation();

  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [notes, setNotes] = useState("");

  const allStudents = [
    ...students.map(s => ({ name: s.name, id: s.id, type: 'regular' as const })),
    ...eliteInfo.map(e => ({ name: e.student.name, id: e.student.id, type: 'elite' as const })),
  ];
  // Deduplicate by name
  const uniqueStudents = allStudents.filter((s, i) => allStudents.findIndex(x => x.name === s.name) === i);

  const EVENT_TYPE_CONFIG = {
    exam: { label: '考試', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    competition: { label: '比賽', icon: Trophy, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    training: { label: '交流訓練', icon: Award, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  } as const;

  const handleRegister = async (eventId: number) => {
    if (!selectedStudent) {
      toast.error("請選擇學生");
      return;
    }
    const studentInfo = uniqueStudents.find(s => s.name === selectedStudent);
    try {
      await registerMutation.mutateAsync({
        eventId,
        studentId: studentInfo?.type === 'regular' ? studentInfo.id : undefined,
        eliteStudentId: studentInfo?.type === 'elite' ? studentInfo.id : undefined,
        studentName: selectedStudent,
        phone,
        notes: notes || undefined,
      });
      toast.success("報名成功！");
      setSelectedEvent(null);
      setSelectedStudent("");
      setNotes("");
      refetchRegs();
    } catch (error: any) {
      toast.error(error.message || "報名失敗");
    }
  };

  const handleCancel = async (regId: number) => {
    try {
      await cancelMutation.mutateAsync({ id: regId });
      toast.success("已取消報名");
      refetchRegs();
    } catch {
      toast.error("取消失敗");
    }
  };

  const isRegistered = (eventId: number, studentName: string) => {
    return myRegistrations?.some(r => r.eventId === eventId && r.studentName === studentName && r.status !== 'cancelled');
  };

  if (eventsLoading || regsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 我的報名 */}
      {myRegistrations && myRegistrations.filter(r => r.status !== 'cancelled').length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              已報名活動
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myRegistrations.filter(r => r.status !== 'cancelled').map(reg => {
              const event = openEvents?.find(e => e.id === reg.eventId);
              const typeConfig = event ? EVENT_TYPE_CONFIG[event.type as keyof typeof EVENT_TYPE_CONFIG] : null;
              return (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{event?.title || '活動'}</div>
                    <div className="text-xs text-gray-500">
                      {reg.studentName} · {typeConfig?.label || ''}
                      {event?.eventDate && ` · ${new Date(event.eventDate).toLocaleDateString('zh-TW')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {reg.status === 'confirmed' ? '已確認' : '待確認'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleCancel(reg.id)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 可報名活動 */}
      {(!openEvents || openEvents.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>目前沒有開放報名的活動</p>
            <p className="text-sm mt-1">活動開放報名時會在此顯示</p>
          </CardContent>
        </Card>
      ) : (
        openEvents.map(event => {
          const typeConfig = EVENT_TYPE_CONFIG[event.type as keyof typeof EVENT_TYPE_CONFIG];
          const TypeIcon = typeConfig.icon;
          const isDeadlinePassed = event.registrationDeadline && new Date(event.registrationDeadline) < new Date();
          const isExpanded = selectedEvent === event.id;

          return (
            <Card key={event.id} className={`${typeConfig.border} border`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeConfig.bg} ${typeConfig.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig.label}
                      </span>
                      <CardTitle className="text-base">{event.title}</CardTitle>
                    </div>
                    {event.description && (
                      <CardDescription className="text-sm">{event.description}</CardDescription>
                    )}
                  </div>
                  {event.fee && parseFloat(event.fee) > 0 && (
                    <span className="text-sm font-bold text-blue-600">${event.fee}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CalendarDays className="w-4 h-4 text-gray-400" />
                    <span>{new Date(event.eventDate).toLocaleDateString('zh-TW')}</span>
                  </div>
                  {event.eventTime && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{event.eventTime}</span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.registrationDeadline && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                      <span>截止: {new Date(event.registrationDeadline).toLocaleDateString('zh-TW')}</span>
                    </div>
                  )}
                </div>

                {isDeadlinePassed ? (
                  <div className="p-3 bg-gray-100 rounded-lg text-center text-sm text-gray-500">
                    報名已截止
                  </div>
                ) : isExpanded ? (
                  <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <Label className="text-sm font-medium">選擇學生</Label>
                      <select
                        value={selectedStudent}
                        onChange={e => setSelectedStudent(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="">-- 請選擇 --</option>
                        {uniqueStudents.map(s => (
                          <option
                            key={`${s.type}-${s.id}`}
                            value={s.name}
                            disabled={!!isRegistered(event.id, s.name)}
                          >
                            {s.name}{isRegistered(event.id, s.name) ? ' (已報名)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">備註（可選）</Label>
                      <Input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="例如：特殊需求"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRegister(event.id)}
                        disabled={!selectedStudent || registerMutation.isPending}
                        className="flex-1"
                        size="sm"
                      >
                        {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                        確認報名
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setSelectedEvent(null); setSelectedStudent(""); setNotes(""); }}
                        size="sm"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedEvent(event.id);
                      // 只有一個學生自動選擇
                      if (uniqueStudents.length === 1) {
                        setSelectedStudent(uniqueStudents[0].name);
                      }
                    }}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    立即報名
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ================= 考試成績 Tab =================
function ExamResultsTab({ phone }: { phone: string }) {
  const { data: examResults, isLoading } = trpc.exam.resultsByPhone.useQuery({ phone });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!examResults || examResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p className="font-medium">暫無考試記錄</p>
        <p className="text-sm mt-1">考試完成後，成績將在此顯示</p>
      </div>
    );
  }

  const CATEGORY_NAMES: Record<string, string> = {
    fitness: "體能", poomsae: "品勢", technique: "手把動作",
    board: "踢木板", split: "一字馬", side_split: "大字馬",
    sparring: "搏擊", competition: "外出比賽",
  };

  const CATEGORY_COLORS: Record<string, string> = {
    fitness: "bg-blue-50 text-blue-700",
    poomsae: "bg-purple-50 text-purple-700",
    technique: "bg-green-50 text-green-700",
    board: "bg-amber-50 text-amber-700",
    sparring: "bg-red-50 text-red-700",
    split: "bg-pink-50 text-pink-700",
    side_split: "bg-pink-50 text-pink-600",
    competition: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="font-bold text-lg flex items-center justify-center gap-2">
          <Award className="w-5 h-5 text-red-600" /> 考試成績
        </h3>
      </div>

      {examResults.map((result: any, idx: number) => {
        const isPassed = result.candidate.status === 'passed';
        const isFailed = result.candidate.status === 'failed';
        const hasLakLak = result.candidate.hasLakLakAward;

        // 按分類分組
        const groupedScores: Record<string, any[]> = {};
        result.scores?.forEach((s: any) => {
          const cat = s.itemCategory || 'other';
          if (!groupedScores[cat]) groupedScores[cat] = [];
          groupedScores[cat].push(s);
        });

        return (
          <div key={idx} className={`border rounded-xl overflow-hidden ${isPassed ? 'border-green-300' : isFailed ? 'border-red-300' : 'border-gray-200'}`}>
            {/* 考試 header */}
            <div className={`p-3 ${isPassed ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{result.exam?.name || '考試'}</div>
                  <div className="text-xs text-gray-500">
                    {result.exam?.examDate ? new Date(result.exam.examDate).toLocaleDateString('zh-TW') : ''}
                    {result.exam?.location && ` · ${result.exam.location}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${isPassed ? 'text-green-700' : isFailed ? 'text-red-700' : 'text-gray-600'}`}>
                    {isPassed ? '合格' : isFailed ? '不合格' : '評分中'}
                  </div>
                  {hasLakLak && (
                    <div className="text-xs text-amber-600 font-medium">叻叻獎</div>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs">
                <span className="text-gray-500">考生：</span>
                <span className="font-medium">{result.candidate.name}</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-500">{result.candidate.currentBelt} → {result.candidate.targetBelt}</span>
              </div>
            </div>

            {/* 評分詳情 */}
            {result.scores && result.scores.length > 0 && (
              <div className="p-3 space-y-2">
                {Object.entries(groupedScores).map(([cat, scores]) => (
                  <div key={cat}>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded mb-1 inline-block ${CATEGORY_COLORS[cat] || 'bg-gray-100'}`}>
                      {CATEGORY_NAMES[cat] || cat}
                    </div>
                    <div className="space-y-1">
                      {scores.map((s: any, i: number) => {
                        const isGood = s.score === 'A' || s.score === '合格' || s.score === '有';
                        const isBad = s.score === '不合格' || s.score === '沒有';
                        return (
                          <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-gray-50/50">
                            <span className="text-xs text-gray-600">{s.itemName}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              isGood ? 'bg-green-100 text-green-700' :
                              isBad ? 'bg-red-100 text-red-700' :
                              s.score === 'B' ? 'bg-blue-100 text-blue-700' :
                              s.score === 'C' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {s.score || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
