import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Save, ChevronDown, ChevronUp, Search, HandMetal, Link2 } from "lucide-react";
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

type ReconcileResult = {
  matched: any[];
  unmatchedBank: BankTransaction[];
  unmatchedSystem: any[];
  summary: {
    totalBankTransactions: number;
    totalSystemRecords: number;
    matchedCount: number;
    unmatchedBankCount: number;
    unmatchedSystemCount: number;
  };
};

// For each unmatched bank item, admin fills in category
type UnmatchedFillIn = {
  index: number;
  category: string;
  studentName: string;
  coachName: string;
};

export default function BankStatementReconciliation({ onReconciled }: { onReconciled?: () => void }) {
  const now = new Date();

  // Step tracking: upload → parsed → reconciled → imported
  const [step, setStep] = useState<'upload' | 'parsed' | 'reconciled' | 'imported'>('upload');

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [bankName, setBankName] = useState("");
  const [statementYear, setStatementYear] = useState(now.getFullYear());
  const [statementMonth, setStatementMonth] = useState(now.getMonth() + 1);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed result
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(null);

  // Reconcile result
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Unmatched fill-in state
  const [unmatchedFills, setUnmatchedFills] = useState<Record<number, UnmatchedFillIn>>({});
  const [isImporting, setIsImporting] = useState(false);

  // Sections collapsed
  const [showUnmatchedSystem, setShowUnmatchedSystem] = useState(false);

  // Filter for reconcile view
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'matched' | 'unmatched'>('all');

  const parseMutation = trpc.accounting.parseBankStatement.useMutation();
  const reconcileMutation = trpc.accounting.reconcile.useMutation();
  const importMutation = trpc.accounting.importUnmatched.useMutation();

  const yearOptions = Array.from({ length: 3 }, (_, i) => 2026 + i);

  // Compute parsed statement totals
  const parsedTotals = useMemo(() => {
    if (!parsedStatement?.transactions) return { totalCredit: 0, totalDebit: 0, count: 0 };
    let totalCredit = 0, totalDebit = 0;
    for (const txn of parsedStatement.transactions) {
      if (txn.credit) totalCredit += parseFloat(txn.credit) || 0;
      if (txn.debit) totalDebit += parseFloat(txn.debit) || 0;
    }
    return { totalCredit, totalDebit, count: parsedStatement.transactions.length };
  }, [parsedStatement]);

  // Build unified reconcile rows for Step 3
  const reconcileRows = useMemo(() => {
    if (!reconcileResult) return [];
    const rows: Array<{
      type: 'matched' | 'unmatched';
      bankTxn: BankTransaction;
      systemRecord?: any;
      matchScore?: number;
      unmatchedIndex?: number; // index in unmatchedBank array
    }> = [];

    // Add matched rows
    for (const m of reconcileResult.matched) {
      rows.push({
        type: 'matched',
        bankTxn: m.bankTransaction,
        systemRecord: m.systemRecord,
        matchScore: m.matchScore,
      });
    }

    // Add unmatched bank rows
    reconcileResult.unmatchedBank.forEach((txn, i) => {
      rows.push({
        type: 'unmatched',
        bankTxn: txn,
        unmatchedIndex: i,
      });
    });

    // Sort by date
    rows.sort((a, b) => {
      const da = a.bankTxn.date || '';
      const db = b.bankTxn.date || '';
      return da.localeCompare(db);
    });

    return rows;
  }, [reconcileResult]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (reconcileFilter === 'all') return reconcileRows;
    return reconcileRows.filter(r => r.type === (reconcileFilter === 'matched' ? 'matched' : 'unmatched'));
  }, [reconcileRows, reconcileFilter]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    const previews: string[] = [];
    selectedFiles.forEach(file => {
      if (file.type === 'application/pdf') {
        previews.push('PDF');
        if (previews.length === selectedFiles.length) {
          setFilePreviews([...previews]);
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          previews.push(reader.result as string);
          if (previews.length === selectedFiles.length) {
            setFilePreviews([...previews]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
    if (selectedFiles.length === 0) setFilePreviews([]);
  }

  // PDF 轉圖片：使用 CDN pdf.js 將 PDF 每頁渲染為 PNG base64
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
    if (!pdfjsLib) {
      throw new Error('PDF.js 載入失敗');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: { base64: string; mimeType: string }[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      images.push({ base64: dataUrl.split(',')[1], mimeType: 'image/png' });
    }

    return images;
  }

  async function handleParse() {
    if (files.length === 0) {
      toast.error("請選擇月結單檔案");
      return;
    }
    setIsParsing(true);
    try {
      const images: { base64: string; mimeType: string }[] = [];
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pdfImages = await convertPdfToImages(file);
          images.push(...pdfImages);
        } else {
          const result = await new Promise<{ base64: string; mimeType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve({ base64: dataUrl.split(",")[1], mimeType: file.type });
            };
            reader.readAsDataURL(file);
          });
          images.push(result);
        }
      }

      const result = await parseMutation.mutateAsync({
        images,
        bankName: bankName || undefined,
        statementMonth: `${statementYear}-${String(statementMonth).padStart(2, '0')}`,
      });

      setParsedStatement(result as ParsedStatement);
      setStep('parsed');
      toast.success(`成功識別 ${(result as any).transactions?.length || 0} 筆交易記錄`);
    } catch (error: any) {
      toast.error(`識別失敗: ${error.message}`);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleReconcile() {
    if (!parsedStatement?.transactions) return;
    setIsReconciling(true);
    try {
      const result = await reconcileMutation.mutateAsync({
        transactions: parsedStatement.transactions,
        year: statementYear,
        month: statementMonth,
        bankName: parsedStatement.bankName || bankName || undefined,
      });
      setReconcileResult(result as ReconcileResult);
      // Initialize fill-in state for unmatched items
      const fills: Record<number, UnmatchedFillIn> = {};
      (result as ReconcileResult).unmatchedBank.forEach((_, i) => {
        fills[i] = { index: i, category: "", studentName: "", coachName: "" };
      });
      setUnmatchedFills(fills);
      setStep('reconciled');
      setReconcileFilter('all');
    } catch (error: any) {
      toast.error(`對帳失敗: ${error.message}`);
    } finally {
      setIsReconciling(false);
    }
  }

  async function handleImportUnmatched() {
    if (!reconcileResult) return;

    const items: any[] = [];
    reconcileResult.unmatchedBank.forEach((txn, i) => {
      const fill = unmatchedFills[i];
      if (!fill?.category) return;

      const amount = txn.credit || txn.debit || '0';
      const type = txn.credit ? 'income' : 'expense';
      const statementBankName = parsedStatement?.bankName || bankName || undefined;
      items.push({
        date: txn.date || `${statementYear}-${String(statementMonth).padStart(2, '0')}-01`,
        description: txn.description || '',
        amount: parseFloat(amount).toFixed(2),
        type,
        category: fill.category,
        bank: statementBankName,
        receivingBank: statementBankName,
        studentName: fill.studentName || undefined,
        coachName: fill.coachName || undefined,
      });
    });

    if (items.length === 0) {
      toast.error("請至少為一筆未匹配項目選擇類別");
      return;
    }

    setIsImporting(true);
    try {
      const result = await importMutation.mutateAsync({ items });
      toast.success(`成功匯入 ${result.imported} 筆記錄到會計總帳`);
      setStep('imported');
      onReconciled?.();
    } catch (error: any) {
      toast.error(`匯入失敗: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  }

  function updateFill(index: number, field: keyof UnmatchedFillIn, value: string) {
    setUnmatchedFills(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }));
  }

  function resetAll() {
    setStep('upload');
    setFiles([]);
    setFilePreviews([]);
    setBankName("");
    setParsedStatement(null);
    setReconcileResult(null);
    setUnmatchedFills({});
    setReconcileFilter('all');
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Count how many unmatched items have been filled
  const filledUnmatchedCount = Object.values(unmatchedFills).filter(f => f.category).length;
  const totalUnmatchedCount = reconcileResult?.unmatchedBank.length || 0;

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5 text-indigo-600" />
          銀行月結單對帳
        </CardTitle>
        <CardDescription>
          上傳銀行月結單 → 自動識別所有交易 → 與系統記錄對帳 → 將差異項目匯入
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className={`px-2 py-1 rounded ${step === 'upload' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            1. 上傳月結單
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className={`px-2 py-1 rounded ${step === 'parsed' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            2. 識別結果
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className={`px-2 py-1 rounded ${step === 'reconciled' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            3. 對帳結果
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className={`px-2 py-1 rounded ${step === 'imported' ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            4. 完成
          </span>
        </div>

        {/* ===== Step 1: Upload ===== */}
        {step === 'upload' && (
          <div className="space-y-4">
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
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}>
                  <Upload className="w-4 h-4 mr-1" /> 選擇圖片
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "application/pdf,.pdf,*/*";
                    fileInputRef.current.click();
                  }
                }}>
                  <FileText className="w-4 h-4 mr-1" /> 選擇PDF
                </Button>
              </div>
              {files.length > 0 && (
                <p className="text-xs text-green-600 mt-1">已選擇 {files.length} 個檔案</p>
              )}
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
                <li>系統會自動識別所有交易記錄（日期、說明、金額）</li>
                <li>然後與會計總帳對帳，找出銀行有但系統沒有的記錄</li>
                <li>管理員為未匹配項目選擇類別後匯入</li>
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

        {/* ===== Step 2: Parsed results - Full transaction table ===== */}
        {step === 'parsed' && parsedStatement && (
          <div className="space-y-4">
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

            {/* Transaction totals bar */}
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

            {/* Full transaction table */}
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAll}>重新上傳</Button>
              <Button onClick={handleReconcile} disabled={isReconciling} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {isReconciling ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 對帳中...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> 開始對帳（與系統記錄比對）</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ===== Step 3: Reconcile results - Unified table ===== */}
        {step === 'reconciled' && reconcileResult && (
          <div className="space-y-4">
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
                <p className="text-xs text-green-600">已自動匹配</p>
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
                  reconcileFilter === 'all' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                全部 ({reconcileRows.length})
              </button>
              <button
                onClick={() => setReconcileFilter('matched')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  reconcileFilter === 'matched' 
                    ? 'bg-white text-green-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                已匹配 ({reconcileResult.matched.length})
              </button>
              <button
                onClick={() => setReconcileFilter('unmatched')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  reconcileFilter === 'unmatched' 
                    ? 'bg-white text-orange-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
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
                    const isCredit = !!row.bankTxn.credit;
                    const amount = row.bankTxn.credit || row.bankTxn.debit || '0';

                    if (row.type === 'matched') {
                      // ===== Matched row =====
                      return (
                        <TableRow key={`m-${rowIdx}`} className="bg-green-50/40 hover:bg-green-50/70">
                          <TableCell className="text-xs text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              已匹配
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{row.bankTxn.date || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px]" title={row.bankTxn.description || ''}>
                            <span className="line-clamp-1">{row.bankTxn.description || '-'}</span>
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
                            {/* Show linked system record info */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-xs">
                                <Link2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span className="text-green-700 font-medium">
                                  {CATEGORY_MAP[row.systemRecord.category] || row.systemRecord.category}
                                </span>
                                {row.matchScore !== undefined && (
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
                                <p className="text-[11px] text-gray-500">
                                  學生: {row.systemRecord.studentName}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // ===== Unmatched row - needs manual handling =====
                      const fillIdx = row.unmatchedIndex!;
                      return (
                        <TableRow key={`u-${rowIdx}`} className="bg-orange-50/60 hover:bg-orange-50 border-l-4 border-l-orange-400">
                          <TableCell className="text-xs text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold whitespace-nowrap border border-orange-300">
                              <HandMetal className="w-3 h-3" />
                              需手動
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{row.bankTxn.date || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px]" title={row.bankTxn.description || ''}>
                            <span className="line-clamp-1">{row.bankTxn.description || '-'}</span>
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
                            {/* Manual fill-in fields */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                <span className="text-xs text-orange-700 font-medium">未能自動對帳，請手動選擇類別</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Select value={unmatchedFills[fillIdx]?.category || ""} onValueChange={v => updateFill(fillIdx, 'category', v)}>
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
                                  value={unmatchedFills[fillIdx]?.studentName || ""}
                                  onChange={e => updateFill(fillIdx, 'studentName', e.target.value)}
                                />
                              </div>
                              {unmatchedFills[fillIdx]?.category && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                                  已填寫，待匯入
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
                          {reconcileResult.unmatchedSystem.map((rec, i) => (
                            <TableRow key={i} className="bg-red-50/20">
                              <TableCell className="text-sm">{new Date(rec.transactionDate).toLocaleDateString('zh-HK')}</TableCell>
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
              <Button variant="outline" onClick={resetAll}>重新開始</Button>
              {reconcileResult.unmatchedBank.length > 0 && (
                <>
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg px-3">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{filledUnmatchedCount} / {totalUnmatchedCount} 項已填寫類別</span>
                  </div>
                  <Button
                    onClick={handleImportUnmatched}
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
                  所有月結單交易均已匹配，無需匯入！
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Step 4: Done ===== */}
        {step === 'imported' && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-bold text-green-700">對帳完成！</h3>
            <p className="text-muted-foreground">未匹配的月結單項目已成功匯入會計總帳。</p>
            <Button onClick={resetAll} variant="outline">
              繼續上傳其他月份
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
