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
import { Upload, Loader2, FileSpreadsheet, Users, Receipt, Filter, ChevronDown, ChevronRight, KeyRound, MoreHorizontal, Search, Pencil, UserPlus, UserMinus, UserCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { formatDayMonth, formatDayMonthYear } from "@/lib/dateFormat";
import * as XLSX from "xlsx";
import DojoManagementContent from "@/components/DojoManagementContent";
import { WhatsAppTemplates } from "@/components/WhatsAppTemplates";
import UserManagementContent from "@/components/UserManagementContent";
import CoachStatisticsContent from "@/components/CoachStatisticsContent";

import { StudentWhatsAppButton } from "@/components/StudentWhatsAppButton";
import { AttendanceManagementContent } from "@/components/AttendanceManagementContent";
import { StudentEditDialog } from "@/components/StudentEditDialog";
import { StudentAddDialog } from "@/components/StudentAddDialog";
import { QuarterlyPaymentRecords } from "@/components/QuarterlyPaymentRecords";
import { MonthlyPaymentRecords } from "@/components/MonthlyPaymentRecords";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import CoachStatsWithElite from "@/components/CoachStatsWithElite";
import MonthlyFinanceReport from "@/components/MonthlyFinanceReport";
import AccountingRecords from "@/components/AccountingRecords";
import EventManagement from "@/components/EventManagement";
import ExamManagement from "@/components/ExamManagement";
import JournalEntries from "@/components/JournalEntries";
import AccountingReports from "@/components/AccountingReports";
import BankStatementReconciliation from "@/components/BankStatementReconciliation";
import ReceiptReviewContent from "@/components/ReceiptReviewContent";
import PushQueueReviewContent from "@/components/PushQueueReviewContent";


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
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [trainingDayFilter, setTrainingDayFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [beltLevelFilter, setBeltLevelFilter] = useState<string>("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [showPendingOnly, setShowPendingOnly] = useState<boolean>(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<any>(null);
  const [showAdminChangePassword, setShowAdminChangePassword] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState<any>(null);
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  const { data: students, refetch: refetchStudents } = trpc.students.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: pushQueueCount } = trpc.pushQueue.pendingCount.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 30000,
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
  const updateCoachMutation = trpc.students.updateCoach.useMutation({
    onSuccess: () => {
      refetchStudents();
    },
  });
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

  const deactivateMutation = trpc.students.deactivate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowDeactivateDialog(false);
      setDeactivatingStudent(null);
      refetchStudents();
    },
    onError: (err) => {
      toast.error(`停用失敗: ${err.message}`);
    },
  });

  const reactivateMutation = trpc.students.reactivate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStudents();
    },
    onError: (err) => {
      toast.error(`重新啟用失敗: ${err.message}`);
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
              ? formatDayMonthYear(payment.receiptTransferDate)
              : '未識別';
            const recordDate = formatDayMonthYear(payment.paymentDate);
            
            // 查詢學生的教練
            const coachName = item.student.coach || '-';
            
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
      ? `待審核繳費記錄_${formatDayMonthYear(new Date())}.xlsx`
      : `繳費記錄_${formatDayMonthYear(new Date())}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success(`成功匯出 ${exportData.length} 筆記錄`);
  };

  // 解析 Excel 並建立預覽數據
  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const arrayBuffer = await new Promise<ArrayBuffer>((res, rej) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target?.result as ArrayBuffer);
          reader.onerror = () => rej(new Error("讀取檔案失敗"));
          reader.readAsArrayBuffer(file);
        });

        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          reject(new Error("Excel 檔案中沒有資料"));
          return;
        }

        // 顯示 Excel 欄位名稱，方便偵錯
        const excelColumns = Object.keys(jsonData[0]);
        console.log("Excel 欄位:", excelColumns);
        console.log("第一筆原始資料:", jsonData[0]);

        const studentsToImport = jsonData.map((row) => {
          const keys = Object.keys(row);
          
          // 精確欄位映射表：依優先順序匹配，避免模糊匹配誤判
          const fieldMap: Record<string, string[]> = {
            name: ["姓名"],
            birthDate: ["出生日期", "出生", "生日"],
            phone: ["電話", "手機", "聯絡電話"],
            venue: ["道場", "場地"],
            scheduleDay: ["上課日", "道場日期", "星期"],
            scheduleTime: ["上課時間", "道場時間"],
            feePerQuarter: ["季度學費", "3個月學費", "學費", "費用"],
            beltLevel: ["級數", "帶級", "級別", "學生級數"],
            coach: ["教練姓名", "負責教練", "所屬教練", "教練"],
          };

          // 根據映射表查找欄位值：優先完全匹配，再模糊匹配
          const getField = (fieldName: string) => {
            const patterns = fieldMap[fieldName] || [];
            for (const pattern of patterns) {
              const exactKey = keys.find(k => k.trim() === pattern);
              if (exactKey) return row[exactKey];
            }
            for (const pattern of patterns) {
              const partialKey = keys.find(k => k.trim().includes(pattern));
              if (partialKey) return row[partialKey];
            }
            return undefined;
          };

          // 處理出生日期
          let birthDate: string | null = null;
          const rawBirth = getField("birthDate");
          if (rawBirth != null) {
            if (typeof rawBirth === "number") {
              const d = XLSX.SSF.parse_date_code(rawBirth);
              birthDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            } else {
              birthDate = String(rawBirth);
            }
          }
          
          const coachRaw = getField("coach");
          const coachValue = coachRaw ? String(coachRaw).trim() : "";
          
          return {
            name: (getField("name") || "").toString().trim(),
            birthDate,
            phone: String(getField("phone") || "").trim(),
            venue: (getField("venue") || "").toString().trim(),
            scheduleDay: (getField("scheduleDay") || "").toString().trim(),
            scheduleTime: (getField("scheduleTime") || "").toString().trim(),
            feePerQuarter: String(getField("feePerQuarter") || "0").trim(),
            beltLevel: (getField("beltLevel") || "").toString().trim(),
            coach: coachValue || "賴政堡教練",
          };
        });

        resolve(studentsToImport);
      } catch (err) {
        reject(err);
      }
    });
  };

  // 第一步：預覽
  const handlePreview = async () => {
    if (!excelFile) {
      toast.error("請選擇 Excel 檔案");
      return;
    }
    try {
      const parsed = await parseExcel(excelFile);
      setImportPreview(parsed);
      toast.success(`已解析 ${parsed.length} 筆資料，請確認後匯入`);
    } catch (error: any) {
      toast.error(error?.message || "解析失敗,請檢查檔案格式");
    }
  };

  // 第二步：確認匯入
  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    
    setIsImporting(true);
    try {
      const result = await importMutation.mutateAsync({ students: importPreview });
      const coachCounts: Record<string, number> = {};
      importPreview.forEach(s => {
        coachCounts[s.coach] = (coachCounts[s.coach] || 0) + 1;
      });
      const coachSummary = Object.entries(coachCounts).map(([c, n]) => `${c}: ${n}人`).join('、');
      
      // 組合完整的成功訊息
      let msg = `成功匯入 ${importPreview.length} 位學生（${coachSummary}）`;
      if (result.newDojos && result.newDojos.length > 0) {
        msg += `\n新增道場: ${result.newDojos.join('、')}`;
      }
      if (result.schedulesGenerated && result.schedulesGenerated > 0) {
        msg += `\n已自動生成 ${result.schedulesGenerated} 個訓練日程`;
      }
      toast.success(msg, { duration: 6000 });
      
      refetchStudents();
      setExcelFile(null);
      setImportPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("匯入失敗:", error);
      toast.error(error?.message || "匯入失敗,請檢查檔案格式");
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
  
  // 教練名單（固定 5 位 + 從學生資料中取得的其他教練）
  const COACH_LIST = ['賴政堡教練', '鄺富華教練', '林學曉教練', '何翰錕教練', '許悠教練'];
  const coaches = Array.from(new Set([
    ...COACH_LIST,
    ...(students?.map(s => s.coach).filter(Boolean) || [])
  ]));
  
  // 篩選學生(道場 + 教練 + 上課日期 + 繳費情況)，排除精英班學生
  const filteredStudents = students?.filter(s => {
    // 排除精英班學生
    if (s.venue === '精英班道場') return false;
    
    // 預設隱藏已停用的學生，除非開啟「顯示已退學」
    if (!showInactiveStudents && s.status === 'inactive') return false;
    
    const venueMatch = venueFilter === "all" || s.venue === venueFilter;
    const coachMatch = coachFilter === "all" || s.coach === coachFilter;
    
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
    
    // 學費期數篩選
    let quarterMatch = true;
    if (quarterFilter !== "all") {
      const unpaid = allNextUnpaidQuarters?.[s.id];
      if (quarterFilter === "paid_all") {
        // 已全部繳清（下一期是明年以後）
        const now = new Date();
        quarterMatch = !!unpaid && unpaid.year > now.getFullYear();
      } else {
        // 格式: "2026-Q1" → 該期是下一筆未繳的（即該期未繳）
        const [fYear, fQ] = quarterFilter.split('-Q');
        const filterYear = parseInt(fYear);
        const filterQuarter = parseInt(fQ);
        // 學生的下一未繳期 <= 所選期數 → 表示該期未繳
        if (unpaid) {
          quarterMatch = unpaid.year < filterYear || (unpaid.year === filterYear && unpaid.quarter <= filterQuarter);
        } else {
          quarterMatch = true; // 無資料，顯示
        }
      }
    }

    // 色帶篩選
    const beltMatch = beltLevelFilter === "all" || s.beltLevel === beltLevelFilter;

    return venueMatch && coachMatch && trainingDayMatch && paymentMatch && quarterMatch && beltMatch;
  })?.filter(s => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.trim().toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q);
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
          <TabsList className="flex flex-wrap h-auto gap-1.5 sm:gap-2 p-2 w-full bg-muted/50 rounded-lg">
            <TabsTrigger value="regular" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md data-[state=active]:border-blue-500 data-[state=active]:bg-blue-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📋 恆常班管理</TabsTrigger>
            <TabsTrigger value="elite-link" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-amber-400 bg-amber-50 text-amber-700 rounded-md data-[state=active]:border-amber-500 data-[state=active]:bg-amber-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold" onClick={() => window.location.href = '/elite'}>🥋 精英班管理</TabsTrigger>
            <TabsTrigger value="coach-stats" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-green-300 bg-green-50 text-green-700 rounded-md data-[state=active]:border-green-500 data-[state=active]:bg-green-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📊 教練統計</TabsTrigger>
            <TabsTrigger value="monthly-finance" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-teal-300 bg-teal-50 text-teal-700 rounded-md data-[state=active]:border-teal-500 data-[state=active]:bg-teal-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">💰 財務報表</TabsTrigger>
            <TabsTrigger value="accounting" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-violet-300 bg-violet-50 text-violet-700 rounded-md data-[state=active]:border-violet-500 data-[state=active]:bg-violet-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📋 會計總帳</TabsTrigger>
            <TabsTrigger value="bank-reconciliation" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border-2 border-indigo-400 bg-indigo-50 text-indigo-700 rounded-md data-[state=active]:border-indigo-500 data-[state=active]:bg-indigo-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-bold">🏦 銀行對帳</TabsTrigger>
            <TabsTrigger value="events" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-orange-300 bg-orange-50 text-orange-700 rounded-md data-[state=active]:border-orange-500 data-[state=active]:bg-orange-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">🏆 活動管理</TabsTrigger>
            <TabsTrigger value="exam" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-red-300 bg-red-50 text-red-700 rounded-md data-[state=active]:border-red-500 data-[state=active]:bg-red-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">🥋 考試評分</TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm active:scale-95 transition-transform">用戶管理</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm active:scale-95 transition-transform">WhatsApp範本</TabsTrigger>
            <TabsTrigger value="receipt-review" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-yellow-300 bg-yellow-50 text-yellow-700 rounded-md data-[state=active]:border-yellow-500 data-[state=active]:bg-yellow-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold">📋 收據審查</TabsTrigger>
            <TabsTrigger value="push-queue" className="text-xs sm:text-sm px-2 sm:px-4 py-2.5 sm:py-2 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-md data-[state=active]:border-indigo-500 data-[state=active]:bg-indigo-100 data-[state=active]:shadow-sm active:scale-95 transition-transform font-semibold relative">
              🔔 推播審核
              {pushQueueCount && pushQueueCount.count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pushQueueCount.count > 99 ? '99+' : pushQueueCount.count}</span>
              )}
            </TabsTrigger>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        學生名單
                      </CardTitle>
                      <CardDescription>
                        總共 {filteredStudents?.length || 0} 位學生
                        {showInactiveStudents && (
                          <span className="text-orange-600 ml-1">（含已退學）</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowInactiveStudents(!showInactiveStudents)}
                        className={showInactiveStudents ? "text-orange-600 border-orange-300 bg-orange-50" : ""}
                      >
                        {showInactiveStudents ? (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            隱藏已退學
                          </>
                        ) : (
                          <>
                            <UserMinus className="w-4 h-4 mr-1" />
                            顯示已退學
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowAddStudentDialog(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        新增學生
                      </Button>
                    </div>
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
                    <Select value={beltLevelFilter} onValueChange={setBeltLevelFilter}>
                      <SelectTrigger className="w-full sm:w-36">
                        <SelectValue placeholder="色帶級別" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部色帶</SelectItem>
                        {(() => {
                          // 跆拳道色帶順序
                          const beltOrder = ['白帶','黃帶','黃綠帶','綠帶','綠藍帶','藍帶','藍紅帶','紅帶','紅黑帶','黑帶','黑帶1段','黑帶2段','黑帶3段','黑帶4段'];
                          const existingBelts = Array.from(new Set(students?.map(s => s.beltLevel).filter(Boolean) || []));
                          const sorted = existingBelts.sort((a, b) => {
                            const ia = beltOrder.indexOf(a as string);
                            const ib = beltOrder.indexOf(b as string);
                            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                          });
                          return sorted.map(belt => (
                            <SelectItem key={belt as string} value={belt as string}>{belt}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="學費期數" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部期數</SelectItem>
                        {(() => {
                          const now = new Date();
                          const year = now.getFullYear();
                          const options = [];
                          const qNames = ['1-3月', '4-6月', '7-9月', '10-12月'];
                          // 當年 4 季 + 明年 4 季
                          for (let y = year; y <= year + 1; y++) {
                            for (let q = 1; q <= 4; q++) {
                              options.push(
                                <SelectItem key={`${y}-Q${q}`} value={`${y}-Q${q}`}>
                                  {y}年{qNames[q-1]} 未繳
                                </SelectItem>
                              );
                            }
                          }
                          options.push(
                            <SelectItem key="paid_all" value="paid_all">已全部繳清</SelectItem>
                          );
                          return options;
                        })()}
                      </SelectContent>
                    </Select>
                    <div className="relative w-full sm:w-48">
                      <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="搜尋姓名或電話..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
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
                        const venueColor = VENUE_COLORS[student.venue] || "";
                        const isInactive = student.status === 'inactive';
                        
                         return (
                           <TableRow key={student.id} className={`${venueColor} ${isInactive ? 'opacity-50 bg-gray-100' : ''}`}>
                             <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                             <TableCell className="font-medium">
                               {student.name}
                               {isInactive && (
                                 <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                   已退學
                                 </span>
                               )}
                             </TableCell>
                            <TableCell>{student.phone}</TableCell>
                            <TableCell>{student.venue}</TableCell>
                            <TableCell>
                              {student.scheduleDay} {student.scheduleTime}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={student.coach || ''}
                                onValueChange={(val) => {
                                  updateCoachMutation.mutate({ id: student.id, coach: val });
                                }}
                                disabled={isInactive}
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue placeholder="選擇教練" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COACH_LIST.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{student.beltLevel}</TableCell>
                            <TableCell className="text-right">${student.feePerQuarter}</TableCell>
                            <TableCell className="text-center">
                              {!isInactive && (
                                <StudentWhatsAppButton
                                  studentId={student.id}
                                  studentName={student.name}
                                  studentPhone={student.phone}
                                  feeAmount={student.feePerQuarter}
                                  nextUnpaidQuarter={allNextUnpaidQuarters?.[student.id] ?? undefined}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {!isInactive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setShowEditDialog(true);
                                    }}
                                    title="編輯學生資料"
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-1" />
                                    編輯
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
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
                                    {isInactive ? (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          if (confirm(`確定要重新啟用學生「${student.name}」嗎？`)) {
                                            reactivateMutation.mutate({ id: student.id });
                                          }
                                        }}
                                        className="text-green-600"
                                      >
                                        <UserCheck className="w-4 h-4 mr-1" />
                                        重新啟用
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setDeactivatingStudent(student);
                                          setShowDeactivateDialog(true);
                                        }}
                                        className="text-red-600"
                                      >
                                        <UserMinus className="w-4 h-4 mr-1" />
                                        停用 (退學)
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
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
            <MonthlyPaymentRecords />
          </TabsContent>

              {/* 點名管理 */}
              <TabsContent value="attendance">
            <AttendanceManagementContent />
          </TabsContent>

              {/* 財務管理（原統計報表） */}
              <TabsContent value="finance">
                <CoachStatsWithElite />
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
                  上傳 Excel 檔案以批次匯入學生資料 (需包含: 姓名、電話、道場、學費等欄位)
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
                    onChange={(e) => { handleFileChange(e); setImportPreview(null); }}
                    className="mt-2"
                  />
                  {excelFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      已選擇: {excelFile.name}
                    </p>
                  )}
                </div>

                {/* 步驟一：預覽按鈕 */}
                {!importPreview && (
                  <Button
                    onClick={handlePreview}
                    disabled={!excelFile}
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    解析並預覽
                  </Button>
                )}

                {/* 預覽表格 */}
                {importPreview && importPreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-green-800">
                        已解析 {importPreview.length} 筆資料，請確認以下內容：
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}>
                        取消
                      </Button>
                    </div>
                    <div className="max-h-80 overflow-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left">#</th>
                            <th className="px-2 py-1.5 text-left">姓名</th>
                            <th className="px-2 py-1.5 text-left">電話</th>
                            <th className="px-2 py-1.5 text-left">道場</th>
                            <th className="px-2 py-1.5 text-left">上課日</th>
                            <th className="px-2 py-1.5 text-left">上課時間</th>
                            <th className="px-2 py-1.5 text-left">學費</th>
                            <th className="px-2 py-1.5 text-left">級數</th>
                            <th className="px-2 py-1.5 text-left">教練</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((s, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-2 py-1">{i + 1}</td>
                              <td className="px-2 py-1 font-medium">{s.name || <span className="text-red-500">缺少</span>}</td>
                              <td className="px-2 py-1">{s.phone || <span className="text-red-500">缺少</span>}</td>
                              <td className="px-2 py-1">{s.venue || <span className="text-red-500">缺少</span>}</td>
                              <td className="px-2 py-1">{s.scheduleDay || <span className="text-orange-500">-</span>}</td>
                              <td className="px-2 py-1">{s.scheduleTime || <span className="text-orange-500">-</span>}</td>
                              <td className="px-2 py-1">${s.feePerQuarter}</td>
                              <td className="px-2 py-1">{s.beltLevel || "-"}</td>
                              <td className="px-2 py-1">{s.coach}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* 統計摘要 */}
                    <div className="p-3 bg-green-50 rounded-lg text-sm space-y-1">
                      <p><strong>教練分佈：</strong>{
                        (() => {
                          const counts: Record<string, number> = {};
                          importPreview.forEach(s => { counts[s.coach] = (counts[s.coach] || 0) + 1; });
                          return Object.entries(counts).map(([c, n]) => `${c}: ${n}人`).join('、');
                        })()
                      }</p>
                      <p><strong>缺少時段：</strong>{importPreview.filter(s => !s.scheduleDay && !s.scheduleTime).length} 人</p>
                      {/* 新道場偵測 */}
                      {(() => {
                        const existingNames = new Set((dojos || []).map((d: any) => d.name));
                        const newVenues = [...new Set(importPreview.map(s => s.venue).filter(v => v && !existingNames.has(v)))];
                        if (newVenues.length === 0) return null;
                        return (
                          <div className="mt-1 p-2 bg-blue-100 rounded text-blue-800">
                            <strong>將自動新增道場：</strong>{newVenues.join('、')}
                            <br />
                            <span className="text-xs">匯入後會自動建立道場記錄並生成訓練日程</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 步驟二：確認匯入按鈕 */}
                    <Button
                      onClick={handleConfirmImport}
                      disabled={isImporting}
                      className="w-full bg-green-600 hover:bg-green-700"
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
                          確認匯入 {importPreview.length} 位學生
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Excel 格式說明:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 必要欄位: 姓名、電話、道場、學費（欄位名稱含關鍵字即可）</li>
                    <li>• 選填欄位: 出生日期、上課日/道場日期、上課時間/道場時間、級數/學生級數</li>
                    <li>• <strong>教練欄位</strong>: 欄位名稱含「教練」即可（如「教練姓名」「負責教練」），未填則預設賴政堡教練</li>
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

          {/* ========= 每月財務報表 ========= */}
          <TabsContent value="monthly-finance">
            <MonthlyFinanceReport />
          </TabsContent>

          {/* ========= 會計總帳 (含子分頁) ========= */}
          <TabsContent value="accounting">
            <Tabs defaultValue="records" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1.5 p-1.5 bg-violet-50/80 rounded-lg border border-violet-200">
                <TabsTrigger value="records" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">📒 流水帳</TabsTrigger>
                <TabsTrigger value="journal" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">📓 日記帳</TabsTrigger>
                <TabsTrigger value="reports" className="text-xs sm:text-sm px-3 py-1.5 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">📊 財務報表</TabsTrigger>
                <TabsTrigger value="reconciliation" className="text-xs sm:text-sm px-3 py-2 rounded font-semibold border-2 border-indigo-400 bg-indigo-50 text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:border-indigo-500 data-[state=active]:shadow-sm">🏦 銀行對帳</TabsTrigger>
              </TabsList>

              <TabsContent value="records">
                <AccountingRecords />
              </TabsContent>

              <TabsContent value="journal">
                <JournalEntries />
              </TabsContent>

              <TabsContent value="reports">
                <AccountingReports />
              </TabsContent>

              <TabsContent value="reconciliation">
                <BankStatementReconciliation />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ========= 銀行對帳 (獨立主標籤，方便快速進入) ========= */}
          <TabsContent value="bank-reconciliation">
            <BankStatementReconciliation />
          </TabsContent>

          {/* ========= 活動管理 ========= */}
          <TabsContent value="events">
            <EventManagement />
          </TabsContent>

          {/* ========= 考試評分 ========= */}
          <TabsContent value="exam">
            <ExamManagement />
          </TabsContent>

          {/* ========= 用戶管理 ========= */}
          <TabsContent value="users">
            <UserManagementContent />
          </TabsContent>

          {/* ========= WhatsApp 範本 ========= */}
          <TabsContent value="whatsapp">
            <WhatsAppTemplates />
          </TabsContent>

          {/* ========= 收據審查 ========= */}
          <TabsContent value="receipt-review">
            <ReceiptReviewContent />
          </TabsContent>

          {/* ========= 推播審核 ========= */}
          <TabsContent value="push-queue">
            <PushQueueReviewContent />
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

      {/* 新增學生對話框 */}
      <StudentAddDialog
        open={showAddStudentDialog}
        onOpenChange={setShowAddStudentDialog}
        onSuccess={refetchStudents}
      />

      {/* 停用學生確認對話框 */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">確認停用學生</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將學生 <strong>{deactivatingStudent?.name}</strong> 設為「已退學」嗎？
              <br /><br />
              <span className="text-gray-600">
                停用後該學生將不會出現在日常名單中，但歷史資料（繳費記錄、出席記錄等）會保留。
                <br />
                如需恢復，可點擊「顯示已退學」→「重新啟用」。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeactivatingStudent(null); }}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivatingStudent) {
                  deactivateMutation.mutate({ id: deactivatingStudent.id });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deactivateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <UserMinus className="w-4 h-4 mr-1" />
              )}
              確認停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
