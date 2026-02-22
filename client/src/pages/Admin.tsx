import { useState, useRef, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, FileSpreadsheet, Users, Receipt, Filter, ChevronDown, ChevronRight, KeyRound, MoreHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import * as XLSX from "xlsx";
import DojoManagementContent from "@/components/DojoManagementContent";
import { WhatsAppTemplates } from "@/components/WhatsAppTemplates";
import UserManagementContent from "@/components/UserManagementContent";
import CoachStatisticsContent from "@/components/CoachStatisticsContent";
import { QuarterlyFeeStatistics } from "@/components/QuarterlyFeeStatistics";
import { StudentWhatsAppButton } from "@/components/StudentWhatsAppButton";
import { AttendanceManagementContent } from "@/components/AttendanceManagementContent";
import { StudentEditDialog } from "@/components/StudentEditDialog";
import { QuarterlyPaymentRecords } from "@/components/QuarterlyPaymentRecords";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import CoachStatsWithElite from "@/components/CoachStatsWithElite";


const PERIOD_LABELS: Record<string, string> = {
  Q1: "1-3月",
  Q2: "4-6月",
  Q3: "7-9月",
  Q4: "10-12月",
  CUSTOM: "自選月份",
};

const PERIOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Q1: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Q2: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  Q3: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Q4: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  CUSTOM: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

const VENUE_COLORS: Record<string, string> = {
  "寶林道場": "bg-blue-50",
  "蒲崗村道場": "bg-green-50",
  "至善道場": "bg-amber-50",
  "賢林道場": "bg-purple-50",
};

// 正規化時間格式，移除所有空格並轉換全形冒號
function normalizeTime(time: string | null | undefined): string {
  if (!time) return "";
  return time
    .replace(/\uff1a/g, ":") // 全形冒號轉半形
    .replace(/\s+/g, ""); // 移除所有空格
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [trainingDayFilter, setTrainingDayFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [showPendingOnly, setShowPendingOnly] = useState<boolean>(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<any>(null);
  const [showAdminChangePassword, setShowAdminChangePassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  const { data: students, refetch: refetchStudents } = trpc.students.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: paymentsData } = trpc.payments.getAllWithStudents.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: dojos } = trpc.dojos.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: allNextUnpaidQuarters } = trpc.students.getAllNextUnpaidQuarters.useQuery(undefined, {
    enabled: user?.role === "admin" || user?.role === "coach",
  });

  const importMutation = trpc.students.importFromExcel.useMutation();
  const resetPasswordMutation = trpc.students.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowResetPasswordDialog(false);
      setResetPasswordStudent(null);
    },
    onError: (err) => {
      toast.error(`重置密碼失敗: ${err.message}`);
    },
  });

  // 匹配學生與道場
  const getMatchedDojo = (student: any) => {
    if (!dojos || !student.venue || !student.scheduleDay || !student.scheduleTime) {
      return null;
    }

    const studentVenue = student.venue.trim();
    const studentDay = student.scheduleDay.trim();
    const studentTime = normalizeTime(student.scheduleTime);

    return dojos.find((dojo) => {
      const dojoVenue = dojo.name?.trim() || "";
      const dojoDay = dojo.scheduleDay?.trim() || "";
      const dojoTime = normalizeTime(dojo.scheduleTime);

      return (
        dojoVenue === studentVenue &&
        dojoDay === studentDay &&
        dojoTime === studentTime
      );
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
  };

  // 已移除批量通知功能

  const handleExportExcel = () => {
    if (!paymentsData || paymentsData.length === 0) {
      toast.error("沒有繳費記錄可匯出");
      return;
    }

    // 準備匯出資料
    const exportData: any[] = [];
    paymentsData.forEach((item) => {
      if (!item.payments || item.payments === 'null') return;
      try {
        const payments = typeof item.payments === 'string' ? JSON.parse(item.payments) : item.payments;
        if (!Array.isArray(payments)) return;
        
        payments
          .filter((p: any) => p.id !== null)
          .filter((p: any) => {
            // 如果開啟篩選,只顯示 pending 狀態的記錄
            if (showPendingOnly) {
              return p.status === 'pending' || parseFloat(p.amount) <= 0;
            }
            return true;
          })
          .forEach((payment: any) => {
            const transferDate = payment.receiptTransferDate 
              ? format(new Date(payment.receiptTransferDate), 'yyyy-MM-dd', { locale: zhTW })
              : '未識別';
            const recordDate = format(new Date(payment.paymentDate), 'yyyy-MM-dd', { locale: zhTW });
            
            // 查詢學生的教練
            const matchedDojo = getMatchedDojo(item.student);
            const coachName = matchedDojo?.coachName || '-';
            
            exportData.push({
              '學生姓名': item.student.name,
              '電話': item.student.phone,
              '道場': item.student.venue,
              '教練': coachName,
              '繳費期間': PERIOD_LABELS[payment.paymentPeriod] || payment.paymentPeriod,
              '自選月份': payment.customMonths || '',
              '金額': payment.amount,
              '轉帳日期': transferDate,
              '記錄日期': recordDate,
              '狀態': payment.status === 'pending' ? '待審核' : '已確認',
              '收據URL': payment.receiptUrl || '',
            });
          });
      } catch (e) {
        console.error('Failed to parse payments:', e);
      }
    });

    if (exportData.length === 0) {
      toast.error("沒有符合條件的繳費記錄");
      return;
    }

    // 建立工作簿並匯出
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "繳費記錄");
    
    const fileName = showPendingOnly 
      ? `待審核繳費記錄_${format(new Date(), 'yyyyMMdd')}.xlsx`
      : `繳費記錄_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success(`成功匯出 ${exportData.length} 筆記錄`);
  };

  const handleImport = async () => {
    if (!excelFile) {
      toast.error("請選擇 Excel 檔案");
      return;
    }

    setIsImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const studentsToImport = jsonData.map((row) => ({
          name: row["姓名"] || "",
          birthDate: row["出生日期"] || null,
          phone: String(row["電話"] || ""),
          venue: row["道場"] || "",
          scheduleDay: row["道場日期"] || "",
          scheduleTime: row["道場時間"] || "",
          feePerQuarter: String(row["3個月學費"] || "0"),
          beltLevel: row["學生級數"] || "",
        }));

        await importMutation.mutateAsync({ students: studentsToImport });
        toast.success(`成功匯入 ${studentsToImport.length} 位學生資料`);
        refetchStudents();
        setExcelFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };
      reader.readAsArrayBuffer(excelFile);
    } catch (error) {
      console.error("匯入失敗:", error);
      toast.error("匯入失敗,請檢查檔案格式");
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>需要登入</CardTitle>
            <CardDescription>請先登入以訪問管理後台</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = getLoginUrl()} className="w-full">
              登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>權限不足</CardTitle>
            <CardDescription>您沒有權限訪問管理後台</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const venues = Array.from(new Set(students?.map(s => s.venue) || []));
  
  // 取得所有教練名稱
  const coaches = Array.from(new Set(
    students?.map(s => {
      const matchedDojo = getMatchedDojo(s);
      return matchedDojo?.coachName;
    }).filter(Boolean) || []
  ));
  
  // 篩選學生(道場 + 教練 + 上課日期 + 繳費情況)，排除精英班學生
  const filteredStudents = students?.filter(s => {
    // 排除精英班學生
    if (s.venue === '精英班道場') return false;
    
    const venueMatch = venueFilter === "all" || s.venue === venueFilter;
    const matchedDojo = getMatchedDojo(s);
    const coachMatch = coachFilter === "all" || matchedDojo?.coachName === coachFilter;
    
    // 上課日期篩選
    const dayMap: Record<string, string> = {
      'monday': '星期一',
      'tuesday': '星期二',
      'wednesday': '星期三',
      'thursday': '星期四',
      'friday': '星期五',
      'saturday': '星期六',
      'sunday': '星期日'
    };
    const trainingDayMatch = trainingDayFilter === "all" || s.scheduleDay?.includes(dayMap[trainingDayFilter]);
    
    // 繳費情況篩選
    let paymentMatch = true;
    if (paymentStatusFilter !== "all") {
      const hasPayment = paymentsData?.some(p => {
        if (p.student.id !== s.id) return false;
        if (!p.payments || p.payments === 'null') return false;
        try {
          const payments = typeof p.payments === 'string' ? JSON.parse(p.payments) : p.payments;
          return Array.isArray(payments) && payments.some((payment: any) => payment.id !== null);
        } catch (e) {
          return false;
        }
      });
      
      if (paymentStatusFilter === "paid") {
        paymentMatch = hasPayment || false;
      } else if (paymentStatusFilter === "unpaid") {
        paymentMatch = !hasPayment;
      } else if (paymentStatusFilter === "partial") {
        // 部分繳費：有繳費但不是全部繳清（這裡簡化為有繳費）
        paymentMatch = hasPayment || false;
      }
    }
    
    return venueMatch && coachMatch && trainingDayMatch && paymentMatch;
  });

  const studentsWithoutPayment = filteredStudents?.filter(student => {
    const hasPayment = paymentsData?.some(p => {
      if (!p.payments || p.payments === 'null') return false;
      try {
        const payments = typeof p.payments === 'string' ? JSON.parse(p.payments) : p.payments;
        return Array.isArray(payments) && payments.some((payment: any) => payment.id !== null);
      } catch (e) {
        console.error('Failed to parse payments:', e, p.payments);
        return false;
      }
    });
    return !hasPayment;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 sm:py-12 overflow-x-hidden">
      <div className="container max-w-7xl overflow-x-hidden px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">管理後台</h1>
            <p className="text-gray-600">管理學生資料與繳費記錄</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAdminChangePassword(true)} variant="outline" size="sm">
              <KeyRound className="w-4 h-4 mr-1" />
              修改密碼
            </Button>
          </div>
        </div>

        <Tabs defaultValue="regular" className="space-y-6">
          {/* 主導航標籤 */}
          <TabsList className="grid grid-cols-3 sm:grid-cols-5 h-auto gap-1.5 sm:gap-2 p-2 w-full bg-muted/50 rounded-lg">
            <TabsTrigger value="regular" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md data-[state=active]:border-blue-500 data-[state=active]:bg-blue-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📋 恆常班管理</TabsTrigger>
            <TabsTrigger value="elite-link" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-amber-400 bg-amber-50 text-amber-700 rounded-md data-[state=active]:border-amber-500 data-[state=active]:bg-amber-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold" onClick={() => window.location.href = '/elite'}>🥋 精英班管理</TabsTrigger>
            <TabsTrigger value="coach-stats" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-green-300 bg-green-50 text-green-700 rounded-md data-[state=active]:border-green-500 data-[state=active]:bg-green-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📊 教練統計</TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm active:scale-95 transition-transform">用戶管理</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm active:scale-95 transition-transform">WhatsApp範本</TabsTrigger>
          </TabsList>

          {/* ========= 恆常班管理 (內含子分頁) ========= */}
          <TabsContent value="regular">
            <Tabs defaultValue="students" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-blue-50/80 rounded-lg border border-blue-200">
                <TabsTrigger value="students" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">學生名單</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">繳費紀錄</TabsTrigger>
                <TabsTrigger value="attendance" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">點名紀錄</TabsTrigger>
                <TabsTrigger value="finance" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">財務管理</TabsTrigger>
                <TabsTrigger value="dojos" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">道場管理</TabsTrigger>
                <TabsTrigger value="import" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">匯入資料</TabsTrigger>
              </TabsList>

              {/* 學生名單 */}
              <TabsContent value="students">

          {/* 學生管理 */}
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      學生名單
                    </CardTitle>
                    <CardDescription>
                      總共 {filteredStudents?.length || 0} 位學生
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <Select value={venueFilter} onValueChange={setVenueFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="選擇道場" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部道場</SelectItem>
                        {venues.map(venue => (
                          <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={coachFilter} onValueChange={setCoachFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="選擇教練" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部教練</SelectItem>
                        {coaches.map(coach => (
                          <SelectItem key={coach} value={coach as string}>{coach}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={trainingDayFilter} onValueChange={setTrainingDayFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="上課日期" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部日期</SelectItem>
                        <SelectItem value="monday">星期一</SelectItem>
                        <SelectItem value="tuesday">星期二</SelectItem>
                        <SelectItem value="wednesday">星期三</SelectItem>
                        <SelectItem value="thursday">星期四</SelectItem>
                        <SelectItem value="friday">星期五</SelectItem>
                        <SelectItem value="saturday">星期六</SelectItem>
                        <SelectItem value="sunday">星期日</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="繳費情況" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部狀態</SelectItem>
                        <SelectItem value="paid">已繳費</SelectItem>
                        <SelectItem value="unpaid">未繳費</SelectItem>
                        <SelectItem value="partial">部分繳費</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                     <TableHeader className="sticky top-0 z-10 bg-background">
                       <TableRow>
                         <TableHead className="w-16">編號</TableHead>
                         <TableHead>姓名</TableHead>
                        <TableHead>電話</TableHead>
                        <TableHead>道場</TableHead>
                        <TableHead>時段</TableHead>
                        <TableHead>教練</TableHead>
                        <TableHead>級數</TableHead>
                        <TableHead className="text-right">學費</TableHead>
                        <TableHead className="text-center">通知繳費</TableHead>
                        <TableHead className="text-center">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents?.map((student, index) => {
                        const matchedDojo = getMatchedDojo(student);
                        const coachName = matchedDojo?.coachName || "-";
                        const venueColor = VENUE_COLORS[student.venue] || "";
                        
                         return (
                           <TableRow key={student.id} className={venueColor}>
                             <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                             <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.phone}</TableCell>
                            <TableCell>{student.venue}</TableCell>
                            <TableCell>
                              {student.scheduleDay} {student.scheduleTime}
                            </TableCell>
                            <TableCell>{coachName}</TableCell>
                            <TableCell>{student.beltLevel}</TableCell>
                            <TableCell className="text-right">${student.feePerQuarter}</TableCell>
                            <TableCell className="text-center">
                              <StudentWhatsAppButton
                                studentId={student.id}
                                studentName={student.name}
                                studentPhone={student.phone}
                                feeAmount={student.feePerQuarter}
                                nextUnpaidQuarter={allNextUnpaidQuarters?.[student.id] ?? undefined}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingStudent(student);
                                    setShowEditDialog(true);
                                  }}>
                                    編輯資料
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setResetPasswordStudent(student);
                                      setShowResetPasswordDialog(true);
                                    }}
                                    className="text-orange-600"
                                  >
                                    <KeyRound className="w-4 h-4 mr-1" />
                                    重置密碼
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 未繳費名單 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-red-600">未繳費名單</CardTitle>
                <CardDescription>尚未有任何繳費記錄的學生</CardDescription>
              </CardHeader>
              <CardContent>
                {studentsWithoutPayment.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">所有學生都已繳費</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>姓名</TableHead>
                          <TableHead>電話</TableHead>
                          <TableHead>道場</TableHead>
                          <TableHead className="text-right">學費</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsWithoutPayment.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.phone}</TableCell>
                            <TableCell>{student.venue}</TableCell>
                            <TableCell className="text-right">${student.feePerQuarter}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 繳費記錄 */}
              <TabsContent value="payments">
            <QuarterlyPaymentRecords />
          </TabsContent>

              {/* 點名管理 */}
              <TabsContent value="attendance">
            <AttendanceManagementContent />
          </TabsContent>

              {/* 財務管理（原統計報表） */}
              <TabsContent value="finance">
            <Card>
              <CardHeader>
                <CardTitle>財務管理</CardTitle>
                <CardDescription>恆常班教練收入統計</CardDescription>
              </CardHeader>
              <CardContent>
                <CoachStatisticsContent />
              </CardContent>
            </Card>
          </TabsContent>

              {/* 道場管理 */}
              <TabsContent value="dojos">
            <DojoManagementContent />
          </TabsContent>

              {/* 匯入資料 */}
              <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  匯入學生資料
                </CardTitle>
                <CardDescription>
                  上傳 Excel 檔案以批次匯入學生資料 (需包含: 姓名、電話、道場、3個月學費等欄位)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="excel-file">選擇 Excel 檔案</Label>
                  <Input
                    id="excel-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="mt-2"
                  />
                  {excelFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      已選擇: {excelFile.name}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleImport}
                  disabled={!excelFile || isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      匯入中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      開始匯入
                    </>
                  )}
                </Button>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Excel 格式說明:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 必要欄位: 姓名、電話、道場、3個月學費</li>
                    <li>• 選填欄位: 出生日期、道場日期、道場時間、學生級數</li>
                    <li>• 電話格式: 純數字,例如 90971420</li>
                    <li>• 學費格式: 純數字,例如 1800</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ========= 教練統計 ========= */}
          <TabsContent value="coach-stats">
            <CoachStatsWithElite />
          </TabsContent>

          {/* ========= 用戶管理 ========= */}
          <TabsContent value="users">
            <UserManagementContent />
          </TabsContent>

          {/* ========= WhatsApp 範本 ========= */}
          <TabsContent value="whatsapp">
            <WhatsAppTemplates />
          </TabsContent>
        </Tabs>
      </div>

      {/* 學生編輯對話框 */}
      <StudentEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        student={editingStudent}
        onSuccess={refetchStudents}
      />

      {/* 重置密碼確認對話框 */}
      <AlertDialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認重置密碼</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將 <strong>{resetPasswordStudent?.name}</strong> 的密碼重置為電話號碼 ({resetPasswordStudent?.phone}) 嗎？
              此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetPasswordStudent(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetPasswordStudent) {
                  resetPasswordMutation.mutate({ studentId: resetPasswordStudent.id });
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {resetPasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <KeyRound className="w-4 h-4 mr-1" />
              )}
              確認重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangePasswordDialog
        open={showAdminChangePassword}
        onOpenChange={setShowAdminChangePassword}
        phone={(user as any)?.phone || ""}
        userType="admin"
        userName={user?.name || "管理員"}
      />
    </div>
  );
}
