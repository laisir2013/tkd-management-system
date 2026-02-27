import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Eye, Check, X, Lock, RefreshCw, Trash2, BookOpen, FileText, BarChart3, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

function formatMoney(amount: string | number | null) {
  if (amount === null || amount === undefined) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (n === 0) return "-";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==================== Trial Balance ====================
function TrialBalance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.accounting.trialBalance.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly: true,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5" /> 試算表 Trial Balance</CardTitle>
        <CardDescription>驗證借貸平衡 — {year}年{month ? `${month}月` : '全年'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month ? String(month) : "all"} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全年</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <>
            {data && data.accounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead className="text-right">借方 Dr</TableHead>
                    <TableHead className="text-right">貸方 Cr</TableHead>
                    <TableHead className="text-right">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{a.accountCode}</TableCell>
                      <TableCell>{a.accountNameZh} <span className="text-xs text-gray-400 ml-1">{a.accountName}</span></TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(a.debit) > 0 ? formatMoney(a.debit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(a.credit) > 0 ? formatMoney(a.credit) : '-'}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${parseFloat(a.balance) < 0 ? 'text-red-600' : ''}`}>
                        {formatMoney(a.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-100 font-bold">
                    <TableCell colSpan={2}>合計</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(data.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(data.totalCredit)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={data.balanced ? "default" : "destructive"}>
                        {data.balanced ? "借貸平衡 ✓" : "不平衡 ✗"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">此期間尚無已過帳的分錄</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Profit & Loss ====================
function ProfitAndLoss() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.accounting.profitAndLoss.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly: true,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" /> 損益表 Profit & Loss</CardTitle>
        <CardDescription>收入與支出 — {year}年{month ? `${month}月` : '全年'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month ? String(month) : "all"} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全年</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : data ? (
          <div className="space-y-6">
            {/* Revenue */}
            <div>
              <h3 className="text-sm font-semibold text-green-700 mb-2 border-b pb-1">收入 Revenue</h3>
              {data.revenue.length > 0 ? (
                <Table>
                  <TableBody>
                    {data.revenue.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm w-20">{r.accountCode}</TableCell>
                        <TableCell>{r.accountNameZh}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{formatMoney(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-green-50 font-bold">
                      <TableCell colSpan={2}>收入合計</TableCell>
                      <TableCell className="text-right font-mono text-green-700">{formatMoney(data.totalRevenue)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">無收入記錄</p>}
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2 border-b pb-1">支出 Expenses</h3>
              {data.expenses.length > 0 ? (
                <Table>
                  <TableBody>
                    {data.expenses.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm w-20">{e.accountCode}</TableCell>
                        <TableCell>{e.accountNameZh}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatMoney(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-red-50 font-bold">
                      <TableCell colSpan={2}>支出合計</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{formatMoney(data.totalExpense)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">無支出記錄</p>}
            </div>

            {/* Net Income */}
            <div className={`p-4 rounded-lg font-bold text-center text-lg ${parseFloat(data.netIncome) >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
              淨利 / 淨損　{formatMoney(data.netIncome)}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ==================== Balance Sheet ====================
function BalanceSheet() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.accounting.balanceSheet.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly: true,
  });

  const renderSection = (title: string, items: any[], total: string, color: string) => (
    <div>
      <h3 className={`text-sm font-semibold mb-2 border-b pb-1 ${color}`}>{title}</h3>
      {items.length > 0 ? (
        <Table>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm w-20">{item.accountCode}</TableCell>
                <TableCell>{item.accountNameZh}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(item.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gray-50 font-bold">
              <TableCell colSpan={2}>小計</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : <p className="text-sm text-muted-foreground">無記錄</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> 資產負債表 Balance Sheet</CardTitle>
        <CardDescription>截至 {year}年{month ? `${month}月底` : '年底'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month ? String(month) : "all"} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">年底</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月底</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : data ? (
          <div className="space-y-6">
            {renderSection("資產 Assets", data.assets, data.totalAssets, "text-blue-700")}
            {renderSection("負債 Liabilities", data.liabilities, data.totalLiabilities, "text-orange-700")}
            {renderSection("權益 Equity", data.equity, data.totalEquity, "text-purple-700")}

            <div className={`p-4 rounded-lg font-bold text-center ${data.balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {data.balanced
                ? `資產 ${formatMoney(data.totalAssets)} = 負債 ${formatMoney(data.totalLiabilities)} + 權益 ${formatMoney(data.totalEquity)} ✓`
                : `不平衡！資產 ${formatMoney(data.totalAssets)} ≠ 負債+權益 ${formatMoney(String(parseFloat(data.totalLiabilities) + parseFloat(data.totalEquity)))}`
              }
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ==================== General Ledger ====================
function GeneralLedger() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  const { data: accounts } = trpc.accounting.getChartOfAccounts.useQuery();

  const { data, isLoading } = trpc.accounting.generalLedger.useQuery(
    { accountCode: selectedAccount, fiscalYear: year, fiscalMonth: month, postedOnly: true },
    { enabled: !!selectedAccount }
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="w-5 h-5" /> 總帳明細 General Ledger</CardTitle>
        <CardDescription>查看每個科目的借貸明細</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Select value={selectedAccount || "none"} onValueChange={(v) => setSelectedAccount(v === "none" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="選擇科目" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- 選擇科目 --</SelectItem>
              {accounts?.map(a => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code} {a.nameZh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month ? String(month) : "all"} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全年</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!selectedAccount ? (
          <p className="text-center text-muted-foreground py-8">請選擇科目以查看明細</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : data ? (
          <>
            {data.account && (
              <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
                <strong>{data.account.code}</strong> — {data.account.nameZh} ({data.account.name})
                <span className="ml-3 text-muted-foreground">期初餘額: {formatMoney(data.openingBalance)}</span>
              </div>
            )}
            {data.entries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-24">日期</TableHead>
                    <TableHead className="w-32">分錄號</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="text-right">借方 Dr</TableHead>
                    <TableHead className="text-right">貸方 Cr</TableHead>
                    <TableHead className="text-right">累計餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let runningBalance = parseFloat(data.openingBalance);
                    return data.entries.map((e: any, i: number) => {
                      const dr = parseFloat(e.debit || '0');
                      const cr = parseFloat(e.credit || '0');
                      runningBalance += dr - cr;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{e.entryDate}</TableCell>
                          <TableCell className="font-mono text-xs">{e.entryNumber}</TableCell>
                          <TableCell className="text-sm">{e.lineDescription || e.description}</TableCell>
                          <TableCell className="text-right font-mono">{dr > 0 ? formatMoney(dr) : '-'}</TableCell>
                          <TableCell className="text-right font-mono">{cr > 0 ? formatMoney(cr) : '-'}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${runningBalance < 0 ? 'text-red-600' : ''}`}>
                            {formatMoney(runningBalance)}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">此期間無分錄</p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ==================== Journal Entries List ====================
function JournalEntriesList() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, refetch, isLoading } = trpc.accounting.getJournalEntries.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    page,
    pageSize: 30,
  });

  const { data: detailData } = trpc.accounting.getJournalEntryDetail.useQuery(
    { id: showDetail! },
    { enabled: showDetail !== null }
  );

  const postMutation = trpc.accounting.postEntry.useMutation({
    onSuccess: () => { toast.success("已過帳"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const unpostMutation = trpc.accounting.unpostEntry.useMutation({
    onSuccess: () => { toast.success("已取消過帳"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.accounting.deleteEntry.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const syncMutation = trpc.accounting.syncPendingToJournal.useMutation({
    onSuccess: (result) => {
      toast.success(`已同步 ${result.success}/${result.total} 筆`);
      if (result.errors.length > 0) {
        toast.warning(`${result.failed} 筆失敗`);
      }
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const lockMutation = trpc.accounting.lockPeriod.useMutation({
    onSuccess: (result) => {
      toast.success(`已鎖定 ${result.lockedCount} 筆分錄`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> 日記帳 Journal Entries</CardTitle>
              <CardDescription>查看、建立和管理會計分錄</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                同步待處理
              </Button>
              {month && (
                <Button size="sm" variant="outline" onClick={() => { if (confirm(`確定鎖定 ${year}年${month}月？鎖定後不可編輯`)) lockMutation.mutate({ fiscalYear: year, fiscalMonth: month }); }}>
                  <Lock className="w-4 h-4 mr-1" /> 鎖定期間
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> 手動分錄
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={month ? String(month) : "all"} onValueChange={(v) => { setMonth(v === "all" ? undefined : Number(v)); setPage(1); }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <>
              <p className="text-xs text-muted-foreground mb-2">共 {data?.total ?? 0} 筆</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-32">分錄號</TableHead>
                    <TableHead className="w-24">日期</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="w-20">來源</TableHead>
                    <TableHead className="w-16 text-center">狀態</TableHead>
                    <TableHead className="w-28 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.entries ?? []).map((entry: any) => (
                    <TableRow key={entry.id} className={entry.isLocked ? 'bg-gray-50' : ''}>
                      <TableCell className="font-mono text-xs">{entry.entryNumber}</TableCell>
                      <TableCell className="text-sm">{entry.entryDate}</TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]">{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.sourceType === 'auto_sync' ? '自動' : entry.sourceType === 'manual' ? '手動' : entry.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.isLocked ? (
                          <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" />鎖定</Badge>
                        ) : entry.isPosted ? (
                          <Badge className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />已過帳</Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300">草稿</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowDetail(entry.id)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {!entry.isLocked && !entry.isPosted && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => postMutation.mutate({ id: entry.id })}>
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => { if (confirm('確定刪除？')) deleteMutation.mutate({ id: entry.id }); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {!entry.isLocked && entry.isPosted && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-yellow-600" onClick={() => unpostMutation.mutate({ id: entry.id })}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.total > 30 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
                  <span className="text-sm self-center">第 {page} / {Math.ceil(data.total / 30)} 頁</span>
                  <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail !== null} onOpenChange={(open) => { if (!open) setShowDetail(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>分錄詳情 — {detailData?.entry?.entryNumber}</DialogTitle>
          </DialogHeader>
          {detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>日期:</strong> {detailData.entry.entryDate}</div>
                <div><strong>狀態:</strong> {detailData.entry.isLocked ? '已鎖定' : detailData.entry.isPosted ? '已過帳' : '草稿'}</div>
                <div className="col-span-2"><strong>說明:</strong> {detailData.entry.description}</div>
                {detailData.entry.notes && <div className="col-span-2"><strong>備註:</strong> {detailData.entry.notes}</div>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="text-right">借方 Dr</TableHead>
                    <TableHead className="text-right">貸方 Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.lines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm">{line.accountCode}</TableCell>
                      <TableCell>{line.accountNameZh || line.accountName || '-'}</TableCell>
                      <TableCell className="text-sm">{line.description || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(line.debit) > 0 ? formatMoney(line.debit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(line.credit) > 0 ? formatMoney(line.credit) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <CreateJournalEntryDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} onSuccess={() => { setShowCreateDialog(false); refetch(); }} />
    </>
  );
}

// ==================== Create Journal Entry Dialog ====================
function CreateJournalEntryDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);

  const { data: accounts } = trpc.accounting.getChartOfAccounts.useQuery();

  const createMutation = trpc.accounting.createJournalEntry.useMutation({
    onSuccess: () => {
      toast.success("分錄已建立");
      onSuccess();
      // Reset form
      setDescription("");
      setNotes("");
      setLines([
        { accountCode: "", debit: "", credit: "", description: "" },
        { accountCode: "", debit: "", credit: "", description: "" },
      ]);
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () => setLines([...lines, { accountCode: "", debit: "", credit: "", description: "" }]);
  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;
    // If typing in debit, clear credit and vice versa
    if (field === 'debit' && value) newLines[index].credit = '';
    if (field === 'credit' && value) newLines[index].debit = '';
    setLines(newLines);
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>手動建立分錄</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>日期</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div>
              <Label>說明</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="分錄說明" />
            </div>
          </div>
          <div>
            <Label>備註（選填）</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="備註" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>分錄明細</Label>
              <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-3 h-3 mr-1" /> 新增行</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">科目</TableHead>
                  <TableHead>說明</TableHead>
                  <TableHead className="w-28">借方 Dr</TableHead>
                  <TableHead className="w-28">貸方 Cr</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={line.accountCode || "none"} onValueChange={(v) => updateLine(i, 'accountCode', v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="科目" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--</SelectItem>
                          {accounts?.map(a => <SelectItem key={a.code} value={a.code}>{a.code} {a.nameZh}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="說明" />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right" type="number" step="0.01" value={line.debit} onChange={(e) => updateLine(i, 'debit', e.target.value)} placeholder="0.00" />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right" type="number" step="0.01" value={line.credit} onChange={(e) => updateLine(i, 'credit', e.target.value)} placeholder="0.00" />
                    </TableCell>
                    <TableCell>
                      {lines.length > 2 && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeLine(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-bold">
                  <TableCell colSpan={2} className="text-right">合計</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(totalCredit)}</TableCell>
                  <TableCell>
                    {isBalanced ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-600" />}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={() => createMutation.mutate({
              entryDate,
              description,
              notes: notes || undefined,
              lines: lines.filter(l => l.accountCode).map(l => ({
                accountCode: l.accountCode,
                debit: l.debit || '0',
                credit: l.credit || '0',
                description: l.description || undefined,
              })),
            })}
            disabled={!isBalanced || !description || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            建立分錄
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Export ====================
export default function JournalEntryManager() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="journal" className="w-full">
        <TabsList className="grid w-full grid-cols-5 gap-1">
          <TabsTrigger value="journal" className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" /> 日記帳
          </TabsTrigger>
          <TabsTrigger value="trial" className="text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> 試算表
          </TabsTrigger>
          <TabsTrigger value="pnl" className="text-xs">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> 損益表
          </TabsTrigger>
          <TabsTrigger value="bs" className="text-xs">
            <Wallet className="w-3.5 h-3.5 mr-1" /> 資產負債表
          </TabsTrigger>
          <TabsTrigger value="gl" className="text-xs">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> 總帳明細
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journal"><JournalEntriesList /></TabsContent>
        <TabsContent value="trial"><TrialBalance /></TabsContent>
        <TabsContent value="pnl"><ProfitAndLoss /></TabsContent>
        <TabsContent value="bs"><BalanceSheet /></TabsContent>
        <TabsContent value="gl"><GeneralLedger /></TabsContent>
      </Tabs>
    </div>
  );
}
