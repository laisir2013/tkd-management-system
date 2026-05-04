import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Save, ChevronDown, ChevronUp, Search, HandMetal, Link2, ArrowLeft, Trash2, Clock, RefreshCcw, History } from "lucide-react";
import { toast } from "sonner";

// Same categories as AccountingRecords
const INCOME_CATEGORIES = [
  { value: "tuition", label: "學費" },
  { value: "exam_fee", label: "考試費" },
  { value: "competition_fee", label: "比賽費" },
  { value: "equipment_fee", label: "用具費" },
  { value: "other_income", label: "其他收入" },
];
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

function formatMoney(amount: string | number | null) {
  if (amount === null || amount === undefined || amount === '') return "-";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "-";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null) {
  if (!d) return "-";
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('zh-HK');
}

// Status badge helper
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" />已完成</span>;
    case 'partial':
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium"><Clock className="w-3 h-3" />部分完成</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium"><AlertTriangle className="w-3 h-3" />待對帳</span>;
  }
}

type BankTransaction = {
  date: string | null;
  description: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
  reference: string | null;
};

type ParsedStatement = {
  bankName: string | null;
  statementPeriod: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  transactions: BankTransaction[];
};

type SavedStatement = {
  id: number;
  bankName: string | null;
  statementMonth: string;
  statementPeriod: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  status: 'pending' | 'partial' | 'completed';
  createdAt: string;
  updatedAt: string;
};

type SavedTransaction = {
  id: number;
  statementId: number;
  date: string | null;
  description: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
  reference: string | null;
  reconcileStatus: 'pending' | 'matched' | 'manual' | 'skipped';
  matchedRecordId: number | null;
  matchScore: number | null;
  manualCategory: string | null;
  manualStudentName: string | null;
  manualCoachName: string | null;
  reconciledAt: string | null;
};

type ReconcileResult = {
  matched: any[];
  unmatchedBank: any[];
  unmatchedSystem: any[];
  summary: {
    totalBankTransactions: number;
    totalSystemRecords: number;
    matchedCount: number;
    unmatchedBankCount: number;
    unmatchedSystemCount: number;
  };
};

// For each unmatched bank item (keyed by txn.id), admin fills in category
type UnmatchedFillIn = {
  txnId: number;
  category: string;
  studentName: string;
  coachName: string;
};

// ===== Main view modes =====
type ViewMode = 'list' | 'upload' | 'parsed' | 'detail' | 'reconciled';

export default function BankStatementReconciliation({ onReconciled }: { onReconciled?: () => void }) {
  const now = new Date();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [bankName, setBankName] = useState("");
  const [statementYear, setStatementYear] = useState(now.getFullYear());
  const [statementMonth, setStatementMonth] = useState(now.getMonth() + 1);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed result (from OCR, before saving)
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Saved statement detail view
  const [activeStatementId, setActiveStatementId] = useState<number | null>(null);
  const [savedDetail, setSavedDetail] = useState<{ statement: SavedStatement; transactions: SavedTransaction[] } | null>(null);

  // Reconcile result (for saved statements)
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Unmatched fill-in state (keyed by txn.id)
  const [unmatchedFills, setUnmatchedFills] = useState<Record<number, UnmatchedFillIn>>({});
  const [isImporting, setIsImporting] = useState(false);

  // Sections collapsed
  const [showUnmatchedSystem, setShowUnmatchedSystem] = useState(false);

  // Filter for reconcile view
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'matched' | 'unmatched'>('all');

  // Deleting
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // --- TRPC mutations ---
  const parseMutation = trpc.accounting.parseBankStatement.useMutation();
  const saveMutation = trpc.accounting.saveBankStatementData.useMutation();
  const reconcileSavedMutation = trpc.accounting.reconcileSaved.useMutation();
  const importSavedMutation = trpc.accounting.importSavedUnmatched.useMutation();
  const deleteMutation = trpc.accounting.deleteSavedStatement.useMutation();

  // --- TRPC queries ---
  const statementsQuery = trpc.accounting.listSavedStatements.useQuery(undefined, {
    enabled: true,
  });
  const detailQuery = trpc.accounting.getSavedStatementDetail.useQuery(
    { statementId: activeStatementId! },
    { enabled: !!activeStatementId && (viewMode === 'detail' || viewMode === 'reconciled') }
  );

  const yearOptions = Array.from({ length: 3 }, (_, i) => 2025 + i);

  // Compute parsed statement totals (for OCR preview)
  const parsedTotals = useMemo(() => {
    if (!parsedStatement?.transactions) return { totalCredit: 0, totalDebit: 0, count: 0 };
    let totalCredit = 0, totalDebit = 0;
    for (const txn of parsedStatement.transactions) {
      if (txn.credit) totalCredit += parseFloat(txn.credit) || 0;
      if (txn.debit) totalDebit += parseFloat(txn.debit) || 0;
    }
    return { totalCredit, totalDebit, count: parsedStatement.transactions.length };
  }, [parsedStatement]);

  // Compute saved detail totals
  const savedTotals = useMemo(() => {
    if (!savedDetail?.transactions) return { totalCredit: 0, totalDebit: 0, count: 0 };
    let totalCredit = 0, totalDebit = 0;
    for (const txn of savedDetail.transactions) {
      if (txn.credit) totalCredit += parseFloat(txn.credit as string) || 0;
      if (txn.debit) totalDebit += parseFloat(txn.debit as string) || 0;
    }
    return { totalCredit, totalDebit, count: savedDetail.transactions.length };
  }, [savedDetail]);

  // Build unified reconcile rows for saved reconciliation
  const reconcileRows = useMemo(() => {
    if (!reconcileResult) return [];
    const rows: Array<{
      type: 'matched' | 'unmatched' | 'manual' | 'skipped';
      txnId: number;
      bankTxn: any;
      systemRecord?: any;
      matchScore?: number;
    }> = [];

    for (const m of reconcileResult.matched) {
      rows.push({
        type: m.status === 'manual' ? 'manual' : 'matched',
        txnId: m.txnId,
        bankTxn: m.bankTransaction,
        systemRecord: m.systemRecord,
        matchScore: m.matchScore,
      });
    }

    for (const txn of reconcileResult.unmatchedBank) {
      rows.push({
        type: 'unmatched',
        txnId: txn.id,
        bankTxn: txn,
      });
    }

    rows.sort((a, b) => {
      const da = a.bankTxn.date || a.bankTxn.txn_date || '';
      const db_val = b.bankTxn.date || b.bankTxn.txn_date || '';
      return da.localeCompare(db_val);
    });

    return rows;
  }, [reconcileResult]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (reconcileFilter === 'all') return reconcileRows;
    if (reconcileFilter === 'matched') return reconcileRows.filter(r => r.type === 'matched' || r.type === 'manual');
    return reconcileRows.filter(r => r.type === 'unmatched');
  }, [reconcileRows, reconcileFilter]);

  // ===== Event handlers =====

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    const previews: string[] = [];
    selectedFiles.forEach(file => {
      if (file.type === 'application/pdf') {
        previews.push('PDF');
        if (previews.length === selectedFiles.length) setFilePreviews([...previews]);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          previews.push(reader.result as string);
          if (previews.length === selectedFiles.length) setFilePreviews([...previews]);
        };
        reader.readAsDataURL(file);
      }
    });
    if (selectedFiles.length === 0) setFilePreviews([]);
  }

  // 壓縮圖片：限制最大寬度，改用 JPEG 格式減少 base64 大小
  function compressImage(canvas: HTMLCanvasElement, maxWidth = 1600): { base64: string; mimeType: string } {
    let outputCanvas = canvas;
    // 若超過最大寬度則縮小
    if (canvas.width > maxWidth) {
      const ratio = maxWidth / canvas.width;
      const resized = document.createElement('canvas');
      resized.width = maxWidth;
      resized.height = Math.round(canvas.height * ratio);
      const rCtx = resized.getContext('2d')!;
      rCtx.drawImage(canvas, 0, 0, resized.width, resized.height);
      outputCanvas = resized;
    }
    // 使用 JPEG 0.82 品質（比 PNG 小 5-10 倍，OCR 仍清晰）
    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.82);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  // 壓縮用戶上傳的圖片檔案
  async function compressFileImage(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(compressImage(canvas, 1600));
      };
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function convertPdfToImages(file: File): Promise<{ base64: string; mimeType: string }[]> {
    const cdnBase = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174`;
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${cdnBase}/pdf.min.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('無法載入 PDF 解析器'));
        document.head.appendChild(script);
      });
    }
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js 載入失敗');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: { base64: string; mimeType: string }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // 使用 scale=1.5（而非 2）以減少圖片大小，OCR 仍足夠清晰
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      // 壓縮為 JPEG，大幅減少 base64 大小
      images.push(compressImage(canvas, 1600));
    }
    return images;
  }

  async function handleParse() {
    if (files.length === 0) { toast.error("請選擇月結單檔案"); return; }
    setIsParsing(true);
    try {
      const images: { base64: string; mimeType: string }[] = [];
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pdfImages = await convertPdfToImages(file);
          images.push(...pdfImages);
        } else {
          // 壓縮用戶上傳的圖片
          const compressed = await compressFileImage(file);
          images.push(compressed);
        }
      }

      // 檢查總 payload 大小（base64 字元數），超過 40MB 提示用戶分批上傳
      const totalSize = images.reduce((sum, img) => sum + img.base64.length, 0);
      if (totalSize > 40_000_000) {
        toast.error(`圖片總大小過大（約 ${Math.round(totalSize / 1_000_000)}MB），請減少頁數或分批上傳`);
        setIsParsing(false);
        return;
      }

      const result = await parseMutation.mutateAsync({
        images,
        bankName: bankName || undefined,
        statementMonth: `${statementYear}-${String(statementMonth).padStart(2, '0')}`,
      });
      setParsedStatement(result as ParsedStatement);
      setViewMode('parsed');
      toast.success(`成功識別 ${(result as any).transactions?.length || 0} 筆交易記錄`);
    } catch (error: any) {
      const msg = error?.message || String(error);
      // 捕捉代理返回 HTML 的情況（payload 過大或超時）
      if (msg.includes('<!DOCTYPE') || msg.includes('Unexpected token') || msg.includes('is not valid JSON')) {
        toast.error('上傳的檔案過大，伺服器無法處理。請減少頁數或分批上傳（建議每次最多 3-4 頁）。');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        toast.error('網路連線中斷，請檢查網路後重試。');
      } else {
        toast.error(`識別失敗: ${msg}`);
      }
    } finally {
      setIsParsing(false);
    }
  }

  // Save parsed OCR results to DB
  async function handleSaveStatement() {
    if (!parsedStatement) return;
    setIsSaving(true);
    try {
      const result = await saveMutation.mutateAsync({
        bankName: parsedStatement.bankName || bankName || null,
        statementMonth: `${statementYear}-${String(statementMonth).padStart(2, '0')}`,
        statementPeriod: parsedStatement.statementPeriod,
        openingBalance: parsedStatement.openingBalance,
        closingBalance: parsedStatement.closingBalance,
        transactions: parsedStatement.transactions,
      });
      toast.success("月結單已保存！可隨時返回繼續對帳。");
      // Refresh list and go to detail
      statementsQuery.refetch();
      setActiveStatementId(result.statementId);
      setViewMode('detail');
      // Clean up upload state
      setParsedStatement(null);
      setFiles([]);
      setFilePreviews([]);
      setBankName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast.error(`保存失敗: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  // Open a saved statement detail
  function openStatementDetail(id: number) {
    setActiveStatementId(id);
    setReconcileResult(null);
    setUnmatchedFills({});
    setReconcileFilter('all');
    setShowUnmatchedSystem(false);
    setViewMode('detail');
  }

  // Reconcile a saved statement
  async function handleReconcileSaved() {
    if (!activeStatementId) return;
    setIsReconciling(true);
    try {
      const result = await reconcileSavedMutation.mutateAsync({ statementId: activeStatementId });
      setReconcileResult(result as ReconcileResult);
      // Init fills for unmatched
      const fills: Record<number, UnmatchedFillIn> = {};
      (result as ReconcileResult).unmatchedBank.forEach((txn: any) => {
        fills[txn.id] = { txnId: txn.id, category: txn.manualCategory || "", studentName: txn.manualStudentName || "", coachName: txn.manualCoachName || "" };
      });
      setUnmatchedFills(fills);
      setViewMode('reconciled');
      setReconcileFilter('all');
      // Refresh detail & list
      detailQuery.refetch();
      statementsQuery.refetch();
      toast.success("對帳完成！已匹配和未匹配交易已標記。");
    } catch (error: any) {
      toast.error(`對帳失敗: ${error.message}`);
    } finally {
      setIsReconciling(false);
    }
  }

  // Import filled unmatched items (saved mode)
  async function handleImportSavedUnmatched() {
    if (!activeStatementId || !reconcileResult) return;
    const items: any[] = [];
    for (const txn of reconcileResult.unmatchedBank) {
      const fill = unmatchedFills[txn.id];
      if (!fill?.category) continue;
      const amount = txn.credit || txn.debit || '0';
      const type = txn.credit ? 'income' : 'expense';
      const stmtBankName = savedDetail?.statement?.bankName || bankName || undefined;
      items.push({
        txnId: txn.id,
        date: txn.date || savedDetail?.statement?.statementMonth + '-01',
        description: txn.description || '',
        amount: parseFloat(amount).toFixed(2),
        type,
        category: fill.category,
        bank: stmtBankName,
        receivingBank: stmtBankName,
        studentName: fill.studentName || undefined,
        coachName: fill.coachName || undefined,
      });
    }
    if (items.length === 0) { toast.error("請至少為一筆未匹配項目選擇類別"); return; }

    setIsImporting(true);
    try {
      const result = await importSavedMutation.mutateAsync({ statementId: activeStatementId, items });
      toast.success(`成功匯入 ${result.imported} 筆記錄到會計總帳`);
      // Refresh
      detailQuery.refetch();
      statementsQuery.refetch();
      onReconciled?.();
      // Re-reconcile to refresh state
      await handleReconcileSaved();
    } catch (error: any) {
      toast.error(`匯入失敗: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  }

  function updateFill(txnId: number, field: keyof UnmatchedFillIn, value: string) {
    setUnmatchedFills(prev => ({
      ...prev,
      [txnId]: { ...prev[txnId], [field]: value },
    }));
  }

  async function handleDelete(id: number) {
    if (!confirm("確定要刪除這份月結單及其所有交易記錄嗎？此操作無法撤銷。")) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ statementId: id });
      toast.success("月結單已刪除");
      statementsQuery.refetch();
      if (activeStatementId === id) {
        setActiveStatementId(null);
        setViewMode('list');
      }
    } catch (error: any) {
      toast.error(`刪除失敗: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function goToList() {
    setViewMode('list');
    setActiveStatementId(null);
    setParsedStatement(null);
    setReconcileResult(null);
    setUnmatchedFills({});
    setFiles([]);
    setFilePreviews([]);
    setBankName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    statementsQuery.refetch();
  }

  function goToUpload() {
    setViewMode('upload');
    setParsedStatement(null);
    setFiles([]);
    setFilePreviews([]);
    setBankName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Count filled unmatched
  const filledUnmatchedCount = Object.values(unmatchedFills).filter(f => f.category).length;
  const totalUnmatchedCount = reconcileResult?.unmatchedBank?.length || 0;

  // ===== Statements list data =====
  const statements = statementsQuery.data as SavedStatement[] | undefined;

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5 text-indigo-600" />
          銀行月結單對帳
        </CardTitle>
        <CardDescription>
          上傳月結單 → 自動識別 → 保存 → 隨時對帳 → 匯入差異
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ===== VIEW: List of saved statements ===== */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {/* Header with upload button */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <History className="w-4 h-4" />
                已上傳的月結單
              </h3>
              <Button onClick={goToUpload} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Upload className="w-4 h-4 mr-1" /> 上傳新月結單
              </Button>
            </div>

            {statementsQuery.isLoading && (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> 載入中...
              </div>
            )}

            {!statementsQuery.isLoading && (!statements || statements.length === 0) && (
              <div className="text-center py-12 space-y-3">
                <FileText className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-500 text-sm">尚無上傳的月結單</p>
                <p className="text-gray-400 text-xs">點擊「上傳新月結單」開始第一次對帳</p>
              </div>
            )}

            {statements && statements.length > 0 && (
              <div className="space-y-2">
                {statements.map((stmt) => (
                  <div
                    key={stmt.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between gap-3"
                    onClick={() => openStatementDetail(stmt.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{stmt.statementMonth}</span>
                        <span className="text-xs text-gray-500">{stmt.bankName || '未知銀行'}</span>
                        <StatusBadge status={stmt.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>共 {stmt.totalTransactions} 筆</span>
                        <span className="text-green-600">已匹配 {stmt.matchedCount}</span>
                        <span className="text-orange-600">未匹配 {stmt.unmatchedCount}</span>
                        <span>上傳: {formatDate(stmt.createdAt)}</span>
                      </div>
                      {/* Progress bar */}
                      {stmt.totalTransactions > 0 && (
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              stmt.status === 'completed' ? 'bg-green-500' :
                              stmt.status === 'partial' ? 'bg-yellow-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${Math.round((stmt.matchedCount / stmt.totalTransactions) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDelete(stmt.id); }}
                        disabled={deletingId === stmt.id}
                      >
                        {deletingId === stmt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== VIEW: Upload new statement ===== */}
        {viewMode === 'upload' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={goToList} className="text-gray-600 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>月結單月份 *</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={String(statementYear)} onValueChange={v => setStatementYear(Number(v))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(statementMonth)} onValueChange={v => setStatementMonth(Number(v))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>銀行名稱（選填）</Label>
                <Input className="mt-1" placeholder="例如：匯豐銀行" value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>月結單檔案 *（可多選多頁，支援圖片及PDF）</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                onChange={handleFileChange}
                className="mt-1 hidden"
              />
              <div className="mt-1 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); }
                }}>
                  <Upload className="w-4 h-4 mr-1" /> 選擇圖片
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  if (fileInputRef.current) { fileInputRef.current.accept = "application/pdf,.pdf,*/*"; fileInputRef.current.click(); }
                }}>
                  <FileText className="w-4 h-4 mr-1" /> 選擇PDF
                </Button>
              </div>
              {files.length > 0 && <p className="text-xs text-green-600 mt-1">已選擇 {files.length} 個檔案</p>}
            </div>

            {filePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filePreviews.map((preview, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden w-32 h-32 flex items-center justify-center bg-gray-50">
                    {files[i]?.type === 'application/pdf' ? (
                      <div className="text-center p-2">
                        <FileText className="w-8 h-8 text-red-500 mx-auto" />
                        <span className="text-xs text-gray-600 mt-1 block truncate w-28">{files[i]?.name}</span>
                      </div>
                    ) : (
                      <img src={preview} alt={`第${i + 1}頁`} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">
              <p className="font-medium mb-1">使用說明</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>上傳銀行月結單截圖或照片（可多頁）</li>
                <li>系統會自動 OCR 識別所有交易記錄</li>
                <li>識別後會自動保存，<b>可隨時離開、事後再回來對帳</b></li>
                <li>對帳時系統自動比對，未匹配項目需手動選類別後匯入</li>
              </ul>
            </div>

            <Button onClick={handleParse} disabled={isParsing || files.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {isParsing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 識別中，請稍候...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> 上傳並識別月結單</>
              )}
            </Button>
          </div>
        )}

        {/* ===== VIEW: OCR parsed results (before saving) ===== */}
        {viewMode === 'parsed' && parsedStatement && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={goToUpload} className="text-gray-600 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 重新上傳
            </Button>

            {/* Statement summary info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">銀行</p>
                <p className="font-semibold text-sm">{parsedStatement.bankName || bankName || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">月份</p>
                <p className="font-semibold text-sm">{parsedStatement.statementPeriod || `${statementYear}-${String(statementMonth).padStart(2, '0')}`}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">期初結餘</p>
                <p className="font-semibold text-sm">{formatMoney(parsedStatement.openingBalance)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">期末結餘</p>
                <p className="font-semibold text-sm">{formatMoney(parsedStatement.closingBalance)}</p>
              </div>
            </div>

            {/* Totals bar */}
            <div className="flex flex-wrap gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600">共識別</span>
                <span className="font-bold text-blue-800">{parsedTotals.count} 筆</span>
              </div>
              <div className="w-px h-5 bg-blue-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600">總收入</span>
                <span className="font-bold text-green-700">{formatMoney(parsedTotals.totalCredit)}</span>
              </div>
              <div className="w-px h-5 bg-blue-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">總支出</span>
                <span className="font-bold text-red-700">{formatMoney(parsedTotals.totalDebit)}</span>
              </div>
              <div className="w-px h-5 bg-blue-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">淨額</span>
                <span className={`font-bold ${parsedTotals.totalCredit - parsedTotals.totalDebit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMoney(parsedTotals.totalCredit - parsedTotals.totalDebit)}
                </span>
              </div>
            </div>

            {/* Transaction table */}
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-28">日期</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="text-right w-28">收入</TableHead>
                    <TableHead className="text-right w-28">支出</TableHead>
                    <TableHead className="text-right w-28">結餘</TableHead>
                    <TableHead className="w-32">參考編號</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStatement.transactions.map((txn, i) => (
                    <TableRow key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <TableCell className="text-xs text-muted-foreground text-center">{i + 1}</TableCell>
                      <TableCell className="text-sm font-mono">{txn.date || '-'}</TableCell>
                      <TableCell className="text-sm max-w-[250px]" title={txn.description || ''}>
                        <span className="line-clamp-2">{txn.description || '-'}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {txn.credit ? formatMoney(txn.credit) : ''}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-red-600">
                        {txn.debit ? formatMoney(txn.debit) : ''}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatMoney(txn.balance)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={txn.reference || ''}>
                        {txn.reference || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Save & reconcile buttons */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 mb-2">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                識別完成！點擊「保存」將結果保存到系統，之後隨時可以回來對帳。
              </p>
              <div className="flex gap-2">
                <Button onClick={handleSaveStatement} disabled={isSaving} className="flex-1 bg-green-600 hover:bg-green-700">
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> 保存月結單（可事後對帳）</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== VIEW: Saved statement detail (transactions table + reconcile button) ===== */}
        {viewMode === 'detail' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={goToList} className="text-gray-600 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
            </Button>

            {detailQuery.isLoading && (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> 載入中...
              </div>
            )}

            {detailQuery.data && (() => {
              const { statement, transactions } = detailQuery.data as { statement: SavedStatement; transactions: SavedTransaction[] };
              // Cache for reconcile use
              if (!savedDetail || savedDetail.statement.id !== statement.id) {
                setTimeout(() => setSavedDetail({ statement, transactions }), 0);
              }

              const totalCredit = transactions.reduce((sum, t) => sum + (parseFloat(t.credit as string) || 0), 0);
              const totalDebit = transactions.reduce((sum, t) => sum + (parseFloat(t.debit as string) || 0), 0);
              const matchedTxns = transactions.filter(t => t.reconcileStatus === 'matched' || t.reconcileStatus === 'manual');
              const pendingTxns = transactions.filter(t => t.reconcileStatus === 'pending');

              return (
                <>
                  {/* Statement header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-lg font-bold">{statement.statementMonth} {statement.bankName || ''}</h3>
                      <p className="text-xs text-gray-500">上傳於 {formatDate(statement.createdAt)}</p>
                    </div>
                    <StatusBadge status={statement.status} />
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-xs text-blue-600">總交易</p>
                      <p className="text-xl font-bold text-blue-700">{transactions.length}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-xs text-green-600">已匹配</p>
                      <p className="text-xl font-bold text-green-700">{matchedTxns.length}</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg text-center border-2 border-orange-300">
                      <p className="text-xs text-orange-600 font-semibold">待處理</p>
                      <p className="text-xl font-bold text-orange-700">{pendingTxns.length}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-green-600">總收入</p>
                      <p className="text-sm font-bold text-green-700">{formatMoney(totalCredit)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-red-600">總支出</p>
                      <p className="text-sm font-bold text-red-700">{formatMoney(totalDebit)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {transactions.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>對帳進度</span>
                        <span>{matchedTxns.length} / {transactions.length} ({Math.round((matchedTxns.length / transactions.length) * 100)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.round((matchedTxns.length / transactions.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Transaction table */}
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead className="w-20">狀態</TableHead>
                          <TableHead className="w-28">日期</TableHead>
                          <TableHead>說明</TableHead>
                          <TableHead className="text-right w-24">收入</TableHead>
                          <TableHead className="text-right w-24">支出</TableHead>
                          <TableHead className="text-right w-24">結餘</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((txn, i) => {
                          const statusClass = txn.reconcileStatus === 'matched' ? 'bg-green-50/40' :
                            txn.reconcileStatus === 'manual' ? 'bg-blue-50/40' :
                            txn.reconcileStatus === 'skipped' ? 'bg-gray-50' :
                            '';
                          return (
                            <TableRow key={txn.id} className={`${statusClass} ${i % 2 === 0 && !statusClass ? 'bg-white' : ''}`}>
                              <TableCell className="text-xs text-muted-foreground text-center">{i + 1}</TableCell>
                              <TableCell>
                                {txn.reconcileStatus === 'matched' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> 已匹配
                                  </span>
                                )}
                                {txn.reconcileStatus === 'manual' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                                    <HandMetal className="w-2.5 h-2.5" /> 手動
                                  </span>
                                )}
                                {txn.reconcileStatus === 'skipped' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium whitespace-nowrap">
                                    略過
                                  </span>
                                )}
                                {txn.reconcileStatus === 'pending' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap border border-orange-300">
                                    <AlertTriangle className="w-2.5 h-2.5" /> 待處理
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm font-mono">{txn.date || '-'}</TableCell>
                              <TableCell className="text-sm max-w-[200px]" title={txn.description || ''}>
                                <span className="line-clamp-1">{txn.description || '-'}</span>
                                {txn.manualCategory && (
                                  <span className="text-[10px] text-blue-600 block">
                                    類別: {CATEGORY_MAP[txn.manualCategory] || txn.manualCategory}
                                    {txn.manualStudentName && ` | ${txn.manualStudentName}`}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-green-600">
                                {txn.credit ? formatMoney(txn.credit) : ''}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-red-600">
                                {txn.debit ? formatMoney(txn.debit) : ''}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">{formatMoney(txn.balance)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {statement.status === 'completed' ? (
                      <div className="flex-1 p-3 bg-green-50 rounded-lg text-center text-green-700 font-medium">
                        <CheckCircle2 className="w-5 h-5 inline mr-2" />
                        此月結單已全部對帳完成！
                      </div>
                    ) : (
                      <Button
                        onClick={handleReconcileSaved}
                        disabled={isReconciling}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isReconciling ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 對帳中...</>
                        ) : (
                          <><Search className="w-4 h-4 mr-2" /> {pendingTxns.length > 0 ? '開始對帳（與系統記錄比對）' : '重新對帳'}</>
                        )}
                      </Button>
                    )}
                    {statement.status === 'completed' && (
                      <Button
                        variant="outline"
                        onClick={handleReconcileSaved}
                        disabled={isReconciling}
                        size="sm"
                      >
                        <RefreshCcw className="w-4 h-4 mr-1" /> 重新對帳
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ===== VIEW: Reconcile results (saved statement) ===== */}
        {viewMode === 'reconciled' && reconcileResult && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => { setViewMode('detail'); setReconcileResult(null); detailQuery.refetch(); }} className="text-gray-600 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回月結單詳情
            </Button>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-blue-600">月結單交易</p>
                <p className="text-xl font-bold text-blue-700">{reconcileResult.summary.totalBankTransactions}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">系統記錄</p>
                <p className="text-xl font-bold text-gray-700">{reconcileResult.summary.totalSystemRecords}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-green-600">已匹配</p>
                <p className="text-xl font-bold text-green-700">{reconcileResult.summary.matchedCount}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg text-center border-2 border-orange-300">
                <p className="text-xs text-orange-600 font-semibold">需手動處理</p>
                <p className="text-xl font-bold text-orange-700">{reconcileResult.summary.unmatchedBankCount}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-red-600">系統有/月結單無</p>
                <p className="text-xl font-bold text-red-700">{reconcileResult.summary.unmatchedSystemCount}</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setReconcileFilter('all')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  reconcileFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                全部 ({reconcileRows.length})
              </button>
              <button
                onClick={() => setReconcileFilter('matched')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  reconcileFilter === 'matched' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                已匹配 ({reconcileResult.matched.length})
              </button>
              <button
                onClick={() => setReconcileFilter('unmatched')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  reconcileFilter === 'unmatched' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                需手動 ({reconcileResult.unmatchedBank.length})
              </button>
            </div>

            {/* Unified reconciliation table */}
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-20">狀態</TableHead>
                    <TableHead className="w-28">日期</TableHead>
                    <TableHead className="min-w-[180px]">月結單說明</TableHead>
                    <TableHead className="text-right w-24">金額</TableHead>
                    <TableHead className="w-16">收/支</TableHead>
                    <TableHead className="min-w-[200px]">對帳結果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, rowIdx) => {
                    const txn = row.bankTxn;
                    const isCredit = !!(txn.credit);
                    const amount = txn.credit || txn.debit || '0';

                    if (row.type === 'matched') {
                      return (
                        <TableRow key={`m-${row.txnId}`} className="bg-green-50/40 hover:bg-green-50/70">
                          <TableCell className="text-xs text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" /> 已匹配
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{txn.date || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px]" title={txn.description || ''}>
                            <span className="line-clamp-1">{txn.description || '-'}</span>
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(amount)}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isCredit ? '收入' : '支出'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.systemRecord ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs">
                                  <Link2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  <span className="text-green-700 font-medium">
                                    {CATEGORY_MAP[row.systemRecord.category] || row.systemRecord.category}
                                  </span>
                                  {row.matchScore !== undefined && row.matchScore > 0 && (
                                    <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${
                                      row.matchScore >= 80 ? 'bg-green-100 text-green-700' :
                                      row.matchScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-orange-100 text-orange-700'
                                    }`}>
                                      {row.matchScore}分
                                    </span>
                                  )}
                                </div>
                                {row.systemRecord.description && (
                                  <p className="text-[11px] text-gray-500 line-clamp-1" title={row.systemRecord.description}>
                                    系統: {row.systemRecord.description}
                                  </p>
                                )}
                                {row.systemRecord.studentName && (
                                  <p className="text-[11px] text-gray-500">學生: {row.systemRecord.studentName}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-blue-600">手動已處理</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    } else if (row.type === 'manual') {
                      return (
                        <TableRow key={`man-${row.txnId}`} className="bg-blue-50/40 hover:bg-blue-50/70">
                          <TableCell className="text-xs text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                              <HandMetal className="w-3 h-3" /> 手動
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{txn.date || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px]" title={txn.description || ''}>
                            <span className="line-clamp-1">{txn.description || '-'}</span>
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(amount)}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isCredit ? '收入' : '支出'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-blue-600">已手動匯入</span>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // ===== Unmatched row - needs manual handling =====
                      const fill = unmatchedFills[row.txnId];
                      return (
                        <TableRow key={`u-${row.txnId}`} className="bg-orange-50/60 hover:bg-orange-50 border-l-4 border-l-orange-400">
                          <TableCell className="text-xs text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold whitespace-nowrap border border-orange-300">
                              <HandMetal className="w-3 h-3" /> 需手動
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{txn.date || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px]" title={txn.description || ''}>
                            <span className="line-clamp-1">{txn.description || '-'}</span>
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(amount)}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isCredit ? '收入' : '支出'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                <span className="text-xs text-orange-700 font-medium">未能自動對帳，請手動選擇類別</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Select value={fill?.category || ""} onValueChange={v => updateFill(row.txnId, 'category', v)}>
                                  <SelectTrigger className="h-7 text-xs w-32">
                                    <SelectValue placeholder="選擇類別" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isCredit && <SelectItem value="_inc" disabled className="text-xs font-semibold text-gray-400">── 收入 ──</SelectItem>}
                                    {isCredit && INCOME_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                    {!isCredit && <SelectItem value="_exp" disabled className="text-xs font-semibold text-gray-400">── 支出 ──</SelectItem>}
                                    {!isCredit && EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Input
                                  className="h-7 text-xs w-24"
                                  placeholder="學生姓名"
                                  value={fill?.studentName || ""}
                                  onChange={e => updateFill(row.txnId, 'studentName', e.target.value)}
                                />
                              </div>
                              {fill?.category && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> 已填寫，待匯入
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Unmatched system items (collapsible) */}
            {reconcileResult.unmatchedSystem.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowUnmatchedSystem(!showUnmatchedSystem)}>
                  <CardTitle className="text-base flex items-center justify-between text-red-700">
                    <span className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      系統有但月結單沒有 ({reconcileResult.unmatchedSystem.length} 筆)
                    </span>
                    {showUnmatchedSystem ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CardTitle>
                  <CardDescription>這些記錄在系統中但在月結單上找不到對應交易，可能需要核實。</CardDescription>
                </CardHeader>
                {showUnmatchedSystem && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-28">日期</TableHead>
                            <TableHead>說明</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                            <TableHead>類別</TableHead>
                            <TableHead>銀行</TableHead>
                            <TableHead>來源</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconcileResult.unmatchedSystem.map((rec: any, i: number) => (
                            <TableRow key={i} className="bg-red-50/20">
                              <TableCell className="text-sm">{formatDate(rec.transactionDate)}</TableCell>
                              <TableCell className="text-sm">{rec.description || '-'}</TableCell>
                              <TableCell className={`text-right text-sm font-medium ${rec.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMoney(rec.amount)}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{CATEGORY_MAP[rec.category] || rec.category}</span>
                              </TableCell>
                              <TableCell className="text-sm">{rec.bank || <span className="text-gray-400">-</span>}</TableCell>
                              <TableCell className="text-xs">{rec.source === 'auto_sync' ? '自動' : '手動'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => { setViewMode('detail'); setReconcileResult(null); detailQuery.refetch(); }}>
                返回詳情
              </Button>
              {reconcileResult.unmatchedBank.length > 0 && (
                <>
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg px-3">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{filledUnmatchedCount} / {totalUnmatchedCount} 項已填寫類別</span>
                  </div>
                  <Button
                    onClick={handleImportSavedUnmatched}
                    disabled={isImporting || filledUnmatchedCount === 0}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isImporting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 匯入中...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> 匯入已填寫項目 ({filledUnmatchedCount}筆)</>
                    )}
                  </Button>
                </>
              )}
              {reconcileResult.unmatchedBank.length === 0 && (
                <div className="flex-1 p-3 bg-green-50 rounded-lg text-center text-green-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 inline mr-2" />
                  所有月結單交易均已匹配或已處理！
                </div>
              )}
            </div>

            {/* Tip: can leave and come back */}
            <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
              <p><b>提示：</b>你可以隨時離開此頁面，下次回來繼續對帳。已匹配和已匯入的交易狀態都已保存。</p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
