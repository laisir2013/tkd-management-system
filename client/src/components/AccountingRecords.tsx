import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Download, Upload, Trash2, Edit2, Eye, RefreshCw, Receipt, TrendingUp, TrendingDown, DollarSign, Filter, FileText, CheckCircle2, AlertCircle, FileSpreadsheet, FileDown, PackageCheck, Shield, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import BankStatementReconciliation from "./BankStatementReconciliation";

// 收入類別
const INCOME_CATEGORIES = [
  { value: "tuition", label: "學費" },
  { value: "exam_fee", label: "考試費" },
  { value: "competition_fee", label: "比賽費" },
  { value: "equipment_fee", label: "用具費" },
  { value: "other_income", label: "其他收入" },
];

// 支出類別
const EXPENSE_CATEGORIES = [
  { value: "competition_entry", label: "給大會的比賽報名費" },
  { value: "photography", label: "攝影" },
  { value: "promotion", label: "宣傳" },
  { value: "dinner", label: "聚餐費" },
  { value: "supplier", label: "供應商費用" },
  { value: "venue_rental", label: "場租" },
  { value: "office_rental", label: "office租金" },
  { value: "mpf", label: "MPF" },
  { value: "coach_fee", label: "教練費" },
  { value: "other_expense", label: "其他支出" },
];

const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const CATEGORY_MAP: Record<string, string> = {};
ALL_CATEGORIES.forEach(c => { CATEGORY_MAP[c.value] = c.label; });

const MONTH_LABELS = ['全部', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatDate(d: string | Date | null) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatMoney(amount: string | number | null) {
  if (amount === null || amount === undefined) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AccountingRecords() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<'all' | 'elite' | 'regular' | 'other'>('all');

  // Dialog states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string>("");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [showPayeeConfig, setShowPayeeConfig] = useState(false);
  const [payeeAccounts, setPayeeAccounts] = useState<Array<{ name: string; account: string; type: string }>>([]);
  const [newPayeeName, setNewPayeeName] = useState("");
  const [newPayeeAccount, setNewPayeeAccount] = useState("");
  const [newPayeeType, setNewPayeeType] = useState<string>("bank");

  // Form states
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [formBank, setFormBank] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStudentName, setFormStudentName] = useState("");
  const [formCoachName, setFormCoachName] = useState("");
  const [formDojoName, setFormDojoName] = useState("");

  // Receipt upload states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptType, setReceiptType] = useState<'income' | 'expense'>('expense');
  const [receiptCategory, setReceiptCategory] = useState("");
  const [receiptDescription, setReceiptDescription] = useState("");
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dojos for dropdown
  const { data: dojos } = trpc.dojos.getAll.useQuery();

  const yearOptions = Array.from({ length: 3 }, (_, i) => 2026 + i);

  // Queries
  const { data: records, refetch, isLoading } = trpc.accounting.getAll.useQuery({
    year: selectedYear,
    month: selectedMonth,
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });

  const { data: summaryData } = trpc.accounting.getSummary.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Mutations
  const createMutation = trpc.accounting.create.useMutation({
    onSuccess: () => {
      toast.success("記錄已新增");
      refetch();
      resetForm();
    },
    onError: (e) => toast.error(`新增失敗: ${e.message}`),
  });

  const createWithReceiptMutation = trpc.accounting.createWithReceipt.useMutation({
    onSuccess: (result) => {
      toast.success("記錄已新增（收據已上傳）");
      if (result.extractedAmount || result.extractedBank) {
        toast.info(`OCR 識別結果: 金額=${result.extractedAmount || '未識別'}, 銀行=${result.extractedBank || '未識別'}, 日期=${result.extractedDateTime || '未識別'}`);
      }
      refetch();
      resetReceiptForm();
    },
    onError: (e) => toast.error(`新增失敗: ${e.message}`),
  });

  const updateMutation = trpc.accounting.update.useMutation({
    onSuccess: () => {
      toast.success("記錄已更新");
      refetch();
      setEditingRecord(null);
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const deleteMutation = trpc.accounting.delete.useMutation({
    onSuccess: () => {
      toast.success("記錄已刪除");
      refetch();
    },
    onError: (e) => toast.error(`刪除失敗: ${e.message}`),
  });

  // 更新銀行分類
  const updateBankMutation = trpc.accounting.updateRecordBank.useMutation({
    onSuccess: () => {
      toast.success("銀行已更新");
      refetch();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const syncMutation = trpc.accounting.syncExistingPayments.useMutation({
    onSuccess: (result) => {
      toast.success(`成功同步 ${result.synced} 筆繳費記錄到會計總帳`);
      refetch();
    },
    onError: (e) => toast.error(`同步失敗: ${e.message}`),
  });

  // 批量回填會計記錄中缺失的銀行資訊
  const backfillBanksMutation = trpc.accounting.backfillAccountingBanks.useMutation({
    onSuccess: (result) => {
      if (result.fixed > 0) {
        toast.success(`已回填 ${result.fixed} 筆記錄的銀行資訊`);
      } else {
        toast.info("所有記錄的銀行資訊已齊全，無需回填");
      }
      refetch();
    },
    onError: (e) => toast.error(`回填失敗: ${e.message}`),
  });

  // 收款帳號設定
  const { data: payeeConfigData, refetch: refetchPayeeConfig } = trpc.payeeConfig.getAcceptedAccounts.useQuery(undefined, {
    enabled: showPayeeConfig,
  });

  const updatePayeeMutation = trpc.payeeConfig.updateAcceptedAccounts.useMutation({
    onSuccess: () => {
      toast.success("收款帳號已更新");
      refetchPayeeConfig();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const toggleValidationMutation = trpc.payeeConfig.toggleValidation.useMutation({
    onSuccess: () => {
      toast.success("收款驗證設定已更新");
      refetchPayeeConfig();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  // 同步 payeeAccounts 狀態
  const payeeAccountsFromServer = payeeConfigData?.accounts || [];
  if (showPayeeConfig && payeeConfigData && payeeAccounts.length === 0 && payeeAccountsFromServer.length > 0) {
    setPayeeAccounts([...payeeAccountsFromServer]);
  }

  // Calculate totals
  const summary = summaryData?.summary;
  const tuitionBreakdown = summaryData?.tuitionBreakdown;
  const totalIncome = summary?.filter(s => s.type === 'income').reduce((sum, s) => sum + parseFloat(s.total || '0'), 0) || 0;
  const totalExpense = summary?.filter(s => s.type === 'expense').reduce((sum, s) => sum + parseFloat(s.total || '0'), 0) || 0;
  const balance = totalIncome - totalExpense;
  const eliteTuition = tuitionBreakdown?.find(t => t.type === 'elite');
  const regularTuition = tuitionBreakdown?.find(t => t.type === 'regular');
  const eliteTuitionTotal = parseFloat(eliteTuition?.total || '0');
  const regularTuitionTotal = parseFloat(regularTuition?.total || '0');

  function resetForm() {
    setFormDate(now.toISOString().slice(0, 10));
    setFormBank("");
    setFormAmount("");
    setFormCategory("");
    setFormDescription("");
    setFormStudentName("");
    setFormCoachName("");
    setFormDojoName("");
    setShowAddExpense(false);
    setShowAddIncome(false);
  }

  function resetReceiptForm() {
    setReceiptFile(null);
    setReceiptType('expense');
    setReceiptCategory("");
    setReceiptDescription("");
    setOcrResult(null);
    setReceiptPreview(null);
    setShowReceiptUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmitRecord(type: 'income' | 'expense') {
    if (!formAmount || !formCategory) {
      toast.error("請填寫金額和類別");
      return;
    }
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        transactionDate: new Date(formDate),
        bank: formBank || undefined,
        amount: formAmount,
        type,
        category: formCategory,
        description: formDescription || undefined,
        studentName: formStudentName || undefined,
        coachName: formCoachName || undefined,
        dojoName: formDojoName || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReceiptUpload() {
    if (!receiptFile || !receiptCategory) {
      toast.error("請選擇收據圖片和類別");
      return;
    }
    setIsOcrProcessing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(receiptFile);
      });
      const base64 = await base64Promise;

      await createWithReceiptMutation.mutateAsync({
        type: receiptType,
        category: receiptCategory,
        description: receiptDescription || undefined,
        receiptBase64: base64,
        receiptMimeType: receiptFile.type,
      });
    } finally {
      setIsOcrProcessing(false);
    }
  }

  async function handleUpdateRecord() {
    if (!editingRecord) return;
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: editingRecord.id,
        transactionDate: new Date(formDate),
        bank: formBank || undefined,
        amount: formAmount,
        type: editingRecord.type,
        category: formCategory,
        description: formDescription || undefined,
        studentName: formStudentName || undefined,
        coachName: formCoachName || undefined,
        dojoName: formDojoName || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(record: any) {
    setEditingRecord(record);
    setFormDate(new Date(record.transactionDate).toISOString().slice(0, 10));
    setFormBank(record.bank || "");
    setFormAmount(record.amount);
    setFormCategory(record.category);
    setFormDescription(record.description || "");
    setFormStudentName(record.studentName || "");
    setFormCoachName(record.coachName || "");
    setFormDojoName(record.dojoName || "");
  }

  function handleExportExcel() {
    if (!records || records.length === 0) {
      toast.error("沒有記錄可匯出");
      return;
    }

    const exportData = records.map((r: any) => ({
      '日期': formatDate(r.transactionDate),
      '班別': r.elitePaymentRecordId ? '精英班' : r.paymentRecordId ? '恆常班' : r.dojoName || '',
      '銀行': r.bank || '',
      '金額': r.amount,
      '收入': r.type === 'income' ? r.amount : '',
      '支出': r.type === 'expense' ? r.amount : '',
      '類別': CATEGORY_MAP[r.category] || r.category,
      '說明': r.description || '',
      '學生': r.studentName || '',
      '道場': r.dojoName || '',
      '教練': r.coachName || '',
      '來源': r.source === 'auto_sync' ? '自動同步' : '手動輸入',
      '對帳狀態': r.reconciliationStatus === 'matched' ? '已對帳' : r.reconciliationStatus === 'manual' ? '人工確認' : '未對帳',
      '銀行參考編號': r.bankReference || '',
      '收據': r.receiptUrl || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "會計記錄");
    
    const monthStr = selectedMonth ? `${selectedMonth}月` : '全年';
    XLSX.writeFile(wb, `會計記錄_${selectedYear}年${monthStr}.xlsx`);
    toast.success(`成功匯出 ${exportData.length} 筆記錄`);
  }

  // 匯出核數師/報稅格式 Excel
  const { data: auditData } = trpc.accounting.getAuditExport.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  function handleExportAuditExcel() {
    if (!auditData || !auditData.records.length) {
      toast.error("沒有記錄可匯出");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: 帳目明細
    const detailData = auditData.records.map((r: any, i: number) => ({
      '序號': i + 1,
      '日期': formatDate(r.transactionDate),
      '班別': r.elitePaymentRecordId ? '精英班' : r.paymentRecordId ? '恆常班' : r.dojoName || '',
      '銀行': r.bank || '',
      '銀行參考編號': r.bankReference || '',
      '收入 (HKD)': r.type === 'income' ? parseFloat(r.amount).toFixed(2) : '',
      '支出 (HKD)': r.type === 'expense' ? parseFloat(r.amount).toFixed(2) : '',
      '類別': CATEGORY_MAP[r.category] || r.category,
      '說明': r.description || '',
      '學生姓名': r.studentName || '',
      '道場': r.dojoName || '',
      '教練': r.coachName || '',
      '來源': r.source === 'auto_sync' ? '學費自動同步' : '手動輸入',
      '對帳狀態': r.reconciliationStatus === 'matched' ? '已對帳' : '未對帳',
      '有收據': r.receiptUrl ? '是' : '否',
    }));
    const ws1 = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws1, "帳目明細");

    // Sheet 2: 月度摘要
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const monthlySummary = monthNames.map((name, i) => {
      const md = auditData.monthlyData[`${i + 1}`];
      return {
        '月份': name,
        '收入 (HKD)': md?.income.toFixed(2) || '0.00',
        '支出 (HKD)': md?.expense.toFixed(2) || '0.00',
        '結餘 (HKD)': ((md?.income || 0) - (md?.expense || 0)).toFixed(2),
      };
    });
    monthlySummary.push({
      '月份': '年度合計',
      '收入 (HKD)': auditData.totalIncome.toFixed(2),
      '支出 (HKD)': auditData.totalExpense.toFixed(2),
      '結餘 (HKD)': auditData.netBalance.toFixed(2),
    });
    const ws2 = XLSX.utils.json_to_sheet(monthlySummary);
    XLSX.utils.book_append_sheet(wb, ws2, "月度摘要");

    // Sheet 3: 分類統計
    const categoryData = Object.entries(auditData.categoryTotals).map(([cat, data]: [string, any]) => ({
      '類別': CATEGORY_MAP[cat] || cat,
      '收入 (HKD)': data.income.toFixed(2),
      '支出 (HKD)': data.expense.toFixed(2),
      '淨額 (HKD)': (data.income - data.expense).toFixed(2),
    }));
    const ws3 = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, ws3, "分類統計");

    const monthStr = selectedMonth ? `${selectedMonth}月` : '全年';
    XLSX.writeFile(wb, `核數師報表_${selectedYear}年${monthStr}.xlsx`);
    toast.success(`已匯出核數師/報稅格式報表`);
  }

  // 單筆下載收據
  function handleDownloadReceipt(receiptUrl: string, studentName?: string, date?: string) {
    // Extract key from URL: /api/receipts/xxx -> xxx
    const key = receiptUrl.replace('/api/receipts/', '');
    const ext = key.split('.').pop() || 'jpg';
    const safeName = (studentName || '收據').replace(/[^\w\u4e00-\u9fff]/g, '_');
    const safeDate = date ? `_${date.replace(/\//g, '-')}` : '';
    const filename = `${safeName}${safeDate}.${ext}`;
    
    const link = document.createElement('a');
    link.href = `/api/receipt-download/${key}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 批量下載收據 (ZIP)
  async function handleBatchDownload() {
    if (selectedRecordIds.size === 0) {
      toast.error("請先勾選要下載的記錄");
      return;
    }

    const selectedRecords = records?.filter((r: any) => selectedRecordIds.has(r.id) && r.receiptUrl) || [];
    if (selectedRecords.length === 0) {
      toast.error("所選記錄均無收據");
      return;
    }

    setIsBatchDownloading(true);
    try {
      const receipts = selectedRecords.map((r: any) => ({
        key: r.receiptUrl,
        filename: `${r.studentName || r.description || '收據'}_${formatDate(r.transactionDate)}.${(r.receiptUrl || '').split('.').pop() || 'jpg'}`,
      }));

      const response = await fetch('/api/receipts-batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts }),
      });

      if (!response.ok) {
        throw new Error('批量下載失敗');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const monthStr = selectedMonth ? `${selectedYear}年${selectedMonth}月` : `${selectedYear}年`;
      link.download = `收據_${monthStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`已下載 ${selectedRecords.length} 張收據`);
      setSelectedRecordIds(new Set());
    } catch (err: any) {
      toast.error(`批量下載失敗: ${err.message}`);
    } finally {
      setIsBatchDownloading(false);
    }
  }

  // 全選/取消有收據的記錄
  function toggleSelectAll() {
    const recordsWithReceipt = records?.filter((r: any) => r.receiptUrl) || [];
    if (selectedRecordIds.size === recordsWithReceipt.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(recordsWithReceipt.map((r: any) => r.id)));
    }
  }

  function toggleSelectRecord(id: number) {
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="space-y-6">
      {/* 標題和操作按鈕 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            會計總帳
          </h2>
          <p className="text-sm text-muted-foreground mt-1">核數師/報稅版本 — 記錄所有收入和支出</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { resetForm(); setFormCategory(""); setShowAddIncome(true); }} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-1" /> 新增收入
          </Button>
          <Button onClick={() => { resetForm(); setFormCategory(""); setShowAddExpense(true); }} size="sm" className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-1" /> 新增支出
          </Button>
          <Button onClick={() => { resetReceiptForm(); setShowReceiptUpload(true); }} size="sm" variant="outline">
            <Upload className="w-4 h-4 mr-1" /> 上傳收據
          </Button>
          <Button onClick={handleExportExcel} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-1" /> 匯出 Excel
          </Button>
          <Button onClick={handleExportAuditExcel} size="sm" variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> 核數師報表
          </Button>
          <Button onClick={() => syncMutation.mutate()} size="sm" variant="outline" disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            同步繳費記錄
          </Button>
          <Button onClick={() => backfillBanksMutation.mutate()} size="sm" variant="outline" disabled={backfillBanksMutation.isPending} className="border-amber-300 text-amber-700 hover:bg-amber-50">
            {backfillBanksMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
            回填銀行資訊
          </Button>
          {selectedRecordIds.size > 0 && (
            <Button onClick={handleBatchDownload} size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" disabled={isBatchDownloading}>
              {isBatchDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-1" />}
              批量下載收據 ({selectedRecordIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedMonth === undefined ? "all" : String(selectedMonth)} onValueChange={v => setSelectedMonth(v === 'all' ? undefined : Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部月份</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            <SelectItem value="income">收入</SelectItem>
            <SelectItem value="expense">支出</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類別</SelectItem>
            <SelectItem value="_income_header" disabled>── 收入 ──</SelectItem>
            {INCOME_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            <SelectItem value="_expense_header" disabled>── 支出 ──</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={(v: any) => setClassFilter(v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班別</SelectItem>
            <SelectItem value="elite">精英班</SelectItem>
            <SelectItem value="regular">恆常班</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">總收入</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatMoney(totalIncome)}</p>
            {(eliteTuitionTotal > 0 || regularTuitionTotal > 0) && (
              <div className="mt-2 pt-2 border-t border-green-200 space-y-1">
                {regularTuitionTotal > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600">恆常班學費</span>
                    <span className="font-medium text-green-700">{formatMoney(regularTuitionTotal)}</span>
                  </div>
                )}
                {eliteTuitionTotal > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-600">精英班學費</span>
                    <span className="font-medium text-amber-700">{formatMoney(eliteTuitionTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600 font-medium">總支出</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{formatMoney(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className={balance >= 0 ? "border-blue-200 bg-blue-50/50" : "border-orange-200 bg-orange-50/50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-600 font-medium">結餘</span>
            </div>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatMoney(balance)}</p>
          </CardContent>
        </Card>
        {auditData && (
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-indigo-600 font-medium">對帳率</span>
              </div>
              <p className="text-2xl font-bold text-indigo-700">{auditData.reconciliation.percentage}%</p>
              <p className="text-xs text-indigo-500 mt-0.5">{auditData.reconciliation.reconciled}/{auditData.reconciliation.total} 筆已對帳</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 帳目表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">帳目明細</CardTitle>
          <CardDescription>共 {(() => {
            const filtered = records?.filter((r: any) => {
              if (classFilter === 'elite') return !!r.elitePaymentRecordId;
              if (classFilter === 'regular') return !!r.paymentRecordId && !r.elitePaymentRecordId;
              if (classFilter === 'other') return !r.paymentRecordId && !r.elitePaymentRecordId;
              return true;
            });
            return filtered?.length || 0;
          })()} 筆記錄{classFilter !== 'all' ? ` (已篩選)` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : !records || records.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">暫無記錄，請點擊「同步繳費記錄」匯入已有學費收入，或手動新增記錄</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={records?.filter((r: any) => r.receiptUrl).length > 0 && selectedRecordIds.size === records?.filter((r: any) => r.receiptUrl).length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-28">日期</TableHead>
                    <TableHead>班別</TableHead>
                    <TableHead>銀行</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-right">收入</TableHead>
                    <TableHead className="text-right">支出</TableHead>
                    <TableHead>類別</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead>來源</TableHead>
                    <TableHead className="text-center">對帳</TableHead>
                    <TableHead className="text-center">收據</TableHead>
                    <TableHead className="text-center w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.filter((r: any) => {
                    if (classFilter === 'elite') return !!r.elitePaymentRecordId;
                    if (classFilter === 'regular') return !!r.paymentRecordId && !r.elitePaymentRecordId;
                    if (classFilter === 'other') return !r.paymentRecordId && !r.elitePaymentRecordId;
                    return true;
                  }).map((record: any) => (
                    <TableRow key={record.id} className={record.type === 'income' ? 'bg-green-50/30' : 'bg-red-50/30'}>
                      <TableCell className="text-center">
                        {record.receiptUrl ? (
                          <Checkbox
                            checked={selectedRecordIds.has(record.id)}
                            onCheckedChange={() => toggleSelectRecord(record.id)}
                          />
                        ) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(record.transactionDate)}</TableCell>
                      <TableCell className="text-sm">
                        {record.elitePaymentRecordId ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">精英班</span>
                        ) : record.dojoName ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{record.dojoName}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.bank ? (
                          <span className="text-xs">{record.bank}</span>
                        ) : (
                          <Select
                            value=""
                            onValueChange={(v) => {
                              updateBankMutation.mutate({
                                recordId: record.id,
                                bank: v,
                                receivingBank: v,
                              });
                            }}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs border-orange-300 bg-orange-50 text-orange-700">
                              <SelectValue placeholder="分配銀行" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="中銀香港 (BOC)">中銀 (BOC)</SelectItem>
                              <SelectItem value="滙豐銀行 (HSBC)">滙豐 (HSBC)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatMoney(record.amount)}</TableCell>
                      <TableCell className="text-right text-sm text-green-600 font-medium">
                        {record.type === 'income' ? formatMoney(record.amount) : ''}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600 font-medium">
                        {record.type === 'expense' ? formatMoney(record.amount) : ''}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          record.type === 'income' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {CATEGORY_MAP[record.category] || record.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={record.description || ''}>
                        {record.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          record.source === 'auto_sync' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record.source === 'auto_sync' ? '自動' : '手動'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {record.reconciliationStatus === 'matched' ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-green-600" title="已對帳">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : record.reconciliationStatus === 'manual' ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-blue-600" title="人工確認">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-xs text-gray-400" title="未對帳">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.receiptUrl ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800"
                              title="查看收據"
                              onClick={() => { setViewingReceiptUrl(record.receiptUrl); setShowReceiptViewer(true); }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-800"
                              title="下載收據"
                              onClick={() => handleDownloadReceipt(record.receiptUrl, record.studentName, formatDate(record.transactionDate))}
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">無</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditDialog(record)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("確定要刪除這筆記錄嗎？")) {
                                deleteMutation.mutate({ id: record.id });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增收入 Dialog */}
      <Dialog open={showAddIncome} onOpenChange={setShowAddIncome}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-700">新增收入</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>日期 *</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label>類別 *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>金額 (HKD) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div>
              <Label>銀行</Label>
              <Select value={formBank || "_none"} onValueChange={v => setFormBank(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇銀行" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                  <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>學生姓名</Label>
              <Input placeholder="選填" value={formStudentName} onChange={e => setFormStudentName(e.target.value)} />
            </div>
            <div>
              <Label>道場</Label>
              <Select value={formDojoName || "_none"} onValueChange={v => setFormDojoName(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇道場" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  {dojos?.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  <SelectItem value="精英班">精英班</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>教練</Label>
              <Input placeholder="選填" value={formCoachName} onChange={e => setFormCoachName(e.target.value)} />
            </div>
            <div>
              <Label>說明</Label>
              <Input placeholder="備註" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIncome(false)}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSubmitRecord('income')} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增支出 Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700">新增支出</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>日期 *</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label>類別 *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>金額 (HKD) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div>
              <Label>銀行</Label>
              <Select value={formBank || "_none"} onValueChange={v => setFormBank(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇銀行" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                  <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>道場</Label>
              <Select value={formDojoName || "_none"} onValueChange={v => setFormDojoName(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇道場" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  {dojos?.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  <SelectItem value="精英班">精英班</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>說明</Label>
              <Input placeholder="備註" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpense(false)}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleSubmitRecord('expense')} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 上傳收據 Dialog（含 OCR 自動識別）*/}
      <Dialog open={showReceiptUpload} onOpenChange={setShowReceiptUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上傳收據（自動識別）</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>收支類型 *</Label>
              <Select value={receiptType} onValueChange={(v: any) => { setReceiptType(v); setReceiptCategory(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>類別 *</Label>
              <Select value={receiptCategory} onValueChange={setReceiptCategory}>
                <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
                <SelectContent>
                  {(receiptType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>收據圖片 *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleReceiptFileChange}
                className="mt-1"
              />
            </div>
            {receiptPreview && (
              <div className="border rounded-lg overflow-hidden max-h-48">
                <img src={receiptPreview} alt="收據預覽" className="w-full object-contain max-h-48" />
              </div>
            )}
            <div>
              <Label>說明（選填）</Label>
              <Input placeholder="備註" value={receiptDescription} onChange={e => setReceiptDescription(e.target.value)} />
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">自動識別功能</p>
              <p>上傳後系統會自動識別收據上的日期、金額、銀行等資訊。如識別不準確，記錄建立後可手動修改。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetReceiptForm}>取消</Button>
            <Button onClick={handleReceiptUpload} disabled={isOcrProcessing || !receiptFile || !receiptCategory}>
              {isOcrProcessing ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 識別中...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> 上傳並識別</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯記錄 Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯記錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>日期</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label>類別</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(editingRecord?.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>金額 (HKD)</Label>
              <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div>
              <Label>銀行</Label>
              <Select value={formBank || "_none"} onValueChange={v => setFormBank(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇銀行" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                  <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>學生姓名</Label>
              <Input value={formStudentName} onChange={e => setFormStudentName(e.target.value)} />
            </div>
            <div>
              <Label>道場</Label>
              <Select value={formDojoName || "_none"} onValueChange={v => setFormDojoName(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="選擇道場" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不指定</SelectItem>
                  {dojos?.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  <SelectItem value="精英班">精英班</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>教練</Label>
              <Input value={formCoachName} onChange={e => setFormCoachName(e.target.value)} />
            </div>
            <div>
              <Label>說明</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>取消</Button>
            <Button onClick={handleUpdateRecord} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 收據查看 Dialog */}
      <Dialog open={showReceiptViewer} onOpenChange={setShowReceiptViewer}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>收據圖片</DialogTitle>
          </DialogHeader>
          {viewingReceiptUrl && (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden max-h-[70vh]">
                <img src={viewingReceiptUrl} alt="收據" className="w-full object-contain" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowReceiptViewer(false)}>關閉</Button>
                <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(viewingReceiptUrl)}>
                  <FileDown className="w-4 h-4 mr-1" /> 下載
                </Button>
                <Button size="sm" onClick={() => window.open(viewingReceiptUrl, '_blank')}>
                  <Eye className="w-4 h-4 mr-1" /> 新視窗打開
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 銀行月結單對帳 */}
      <BankStatementReconciliation onReconciled={refetch} />

      {/* 收款帳號驗證設定 */}
      <Card className="border-amber-200">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => {
          setShowPayeeConfig(!showPayeeConfig);
          if (!showPayeeConfig) setPayeeAccounts([]);
        }}>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            收款帳號驗證設定
            <Settings className="w-4 h-4 text-muted-foreground ml-auto" />
          </CardTitle>
          <CardDescription>
            設定接受的收款帳號/FPS號，系統自動驗證家長上傳的收據是否轉帳到正確的帳號，防止家長轉帳給自己後上傳截圖
          </CardDescription>
        </CardHeader>
        {showPayeeConfig && (
          <CardContent className="space-y-4">
            {/* 啟用/禁用驗證 */}
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">啟用收款人驗證</p>
                <p className="text-xs text-muted-foreground">開啟後，上傳收據時會自動比對收款人帳號是否正確</p>
              </div>
              <Switch
                checked={payeeConfigData?.validationEnabled ?? false}
                onCheckedChange={(checked) => toggleValidationMutation.mutate({ enabled: checked })}
              />
            </div>

            {/* 接受的帳號列表 */}
            <div className="space-y-2">
              <Label className="font-medium">接受的收款帳號</Label>
              {payeeAccounts.map((acc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Select value={acc.type} onValueChange={v => {
                    const updated = [...payeeAccounts];
                    updated[idx] = { ...updated[idx], type: v };
                    setPayeeAccounts(updated);
                  }}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">銀行帳號</SelectItem>
                      <SelectItem value="fps">FPS</SelectItem>
                      <SelectItem value="payme">PayMe</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="公司/收款人名稱"
                    value={acc.name}
                    onChange={e => {
                      const updated = [...payeeAccounts];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setPayeeAccounts(updated);
                    }}
                  />
                  <Input
                    className="h-8 text-sm w-40"
                    placeholder="帳號/FPS號"
                    value={acc.account}
                    onChange={e => {
                      const updated = [...payeeAccounts];
                      updated[idx] = { ...updated[idx], account: e.target.value };
                      setPayeeAccounts(updated);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    onClick={() => setPayeeAccounts(payeeAccounts.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              {/* 新增帳號 */}
              <div className="flex items-center gap-2 p-2 border border-dashed rounded">
                <Select value={newPayeeType} onValueChange={setNewPayeeType}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">銀行帳號</SelectItem>
                    <SelectItem value="fps">FPS</SelectItem>
                    <SelectItem value="payme">PayMe</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="公司/收款人名稱"
                  value={newPayeeName}
                  onChange={e => setNewPayeeName(e.target.value)}
                />
                <Input
                  className="h-8 text-sm w-40"
                  placeholder="帳號/FPS號"
                  value={newPayeeAccount}
                  onChange={e => setNewPayeeAccount(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    if (!newPayeeName || !newPayeeAccount) {
                      toast.error("請填寫名稱和帳號");
                      return;
                    }
                    setPayeeAccounts([...payeeAccounts, { name: newPayeeName, account: newPayeeAccount, type: newPayeeType }]);
                    setNewPayeeName("");
                    setNewPayeeAccount("");
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPayeeAccounts([...(payeeConfigData?.accounts || [])]);
                }}
              >
                重設
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => updatePayeeMutation.mutate({ accounts: payeeAccounts as any })}
                disabled={updatePayeeMutation.isPending}
              >
                {updatePayeeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
                儲存收款帳號
              </Button>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 space-y-1">
              <p className="font-medium">驗證邏輯說明：</p>
              <p>• 家長上傳收據後，OCR 會自動識別收據上的<strong>收款人名稱</strong>和<strong>收款帳號</strong></p>
              <p>• 系統比對收款人是否為上方設定的帳號之一（名稱或帳號任一匹配即通過）</p>
              <p>• 匹配成功 + 金額正確 → 自動確認繳費</p>
              <p>• 收款人不匹配 → 標記為「待審核」，需管理員人工確認</p>
              <p>• 這樣可防止家長截圖自己轉帳給自己的收據來冒充繳費</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 說明 */}
      <Card className="bg-gray-50/50">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">說明：</p>
          <p>• <strong>收入類別</strong>：學費 / 考試費 / 比賽費 / 用具費 / 其他</p>
          <p>• <strong>支出類別</strong>：大會比賽報名費 / 攝影 / 宣傳 / 聚餐費 / 供應商費用 / 場租 / office租金 / MPF / 教練費 / 其他</p>
          <p>• 家長上傳收據並確認繳費後，學費收入會<strong>自動同步</strong>到此帳目</p>
          <p>• 點擊「同步繳費記錄」可將所有已確認的繳費一次性匯入</p>
          <p>• <strong>上傳收據</strong>：上傳收據圖片後，系統自動 OCR 識別日期、金額、銀行等資訊</p>
          <p>• <strong>銀行月結單對帳</strong>：上傳月結單截圖，自動識別交易並與系統記錄比對</p>
          <p>• <strong>核數師報表</strong>：匯出含帳目明細、月度摘要、分類統計的多工作表 Excel，符合報稅/核數需求</p>
          <p>• 對帳狀態欄中 <CheckCircle2 className="w-3.5 h-3.5 inline text-green-600" /> 表示已與銀行記錄匹配，<AlertCircle className="w-3.5 h-3.5 inline text-gray-400" /> 表示尚未對帳</p>
        </CardContent>
      </Card>
    </div>
  );
}
