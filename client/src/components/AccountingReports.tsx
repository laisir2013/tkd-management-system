import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, FileText, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatMoney(amount: string | number | null) {
  if (amount === null || amount === undefined) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ===== Trial Balance =====
function TrialBalance({ year, month, postedOnly }: { year: number; month?: number; postedOnly: boolean }) {
  const { data, isLoading } = trpc.accounting.trialBalance.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly,
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          試算表 Trial Balance
          {data.balanced ? (
            <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />平衡</Badge>
          ) : (
            <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />不平衡</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>科目代碼</TableHead>
                <TableHead>科目名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead className="text-right">借方 Dr</TableHead>
                <TableHead className="text-right">貸方 Cr</TableHead>
                <TableHead className="text-right">餘額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.map((a: any) => (
                <TableRow key={a.accountCode}>
                  <TableCell className="font-mono text-xs">{a.accountCode}</TableCell>
                  <TableCell>{a.accountNameZh}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {{ asset: '資產', liability: '負債', equity: '權益', revenue: '收入', expense: '支出' }[a.accountType as string] || a.accountType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(a.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(a.credit)}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${parseFloat(a.balance) < 0 ? 'text-red-600' : ''}`}>
                    {formatMoney(a.balance)}
                  </TableCell>
                </TableRow>
              ))}
              {data.accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暫無資料</TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3} className="text-right">合計</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(data.totalDebit)}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(data.totalCredit)}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney((parseFloat(data.totalDebit) - parseFloat(data.totalCredit)).toFixed(2))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Profit & Loss =====
function ProfitAndLoss({ year, month, postedOnly }: { year: number; month?: number; postedOnly: boolean }) {
  const { data, isLoading } = trpc.accounting.profitAndLoss.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly,
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data) return null;

  const netIncome = parseFloat(data.netIncome);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          損益表 Profit & Loss
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>科目</TableHead>
                <TableHead className="text-right">金額 (HKD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenue */}
              <TableRow className="bg-green-50">
                <TableCell colSpan={2} className="font-bold text-green-700">收入 Revenue</TableCell>
              </TableRow>
              {data.revenue.map((r: any) => (
                <TableRow key={r.accountCode}>
                  <TableCell className="pl-8">{r.accountCode} {r.accountNameZh}</TableCell>
                  <TableCell className="text-right font-mono text-green-700">{formatMoney(r.amount)}</TableCell>
                </TableRow>
              ))}
              {data.revenue.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground pl-8">暫無收入</TableCell></TableRow>
              )}
              <TableRow className="bg-green-50 font-bold">
                <TableCell className="text-right">收入小計</TableCell>
                <TableCell className="text-right font-mono text-green-700">{formatMoney(data.totalRevenue)}</TableCell>
              </TableRow>

              {/* Expenses */}
              <TableRow className="bg-red-50">
                <TableCell colSpan={2} className="font-bold text-red-700">支出 Expenses</TableCell>
              </TableRow>
              {data.expenses.map((e: any) => (
                <TableRow key={e.accountCode}>
                  <TableCell className="pl-8">{e.accountCode} {e.accountNameZh}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatMoney(e.amount)}</TableCell>
                </TableRow>
              ))}
              {data.expenses.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground pl-8">暫無支出</TableCell></TableRow>
              )}
              <TableRow className="bg-red-50 font-bold">
                <TableCell className="text-right">支出小計</TableCell>
                <TableCell className="text-right font-mono text-red-600">{formatMoney(data.totalExpense)}</TableCell>
              </TableRow>

              {/* Net Income */}
              <TableRow className="bg-muted font-bold text-lg">
                <TableCell className="text-right">淨利 Net Income</TableCell>
                <TableCell className={`text-right font-mono ${netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatMoney(data.netIncome)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Balance Sheet =====
function BalanceSheet({ year, month, postedOnly }: { year: number; month?: number; postedOnly: boolean }) {
  const { data, isLoading } = trpc.accounting.balanceSheet.useQuery({
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly,
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-5 h-5" />
          資產負債表 Balance Sheet
          {data.balanced ? (
            <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />平衡</Badge>
          ) : (
            <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />不平衡</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>科目</TableHead>
                <TableHead className="text-right">金額 (HKD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Assets */}
              <TableRow className="bg-blue-50">
                <TableCell colSpan={2} className="font-bold text-blue-700">資產 Assets</TableCell>
              </TableRow>
              {data.assets.map((a: any) => (
                <TableRow key={a.accountCode}>
                  <TableCell className="pl-8">{a.accountCode} {a.accountNameZh}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(a.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-blue-50 font-bold">
                <TableCell className="text-right">資產合計</TableCell>
                <TableCell className="text-right font-mono text-blue-700">{formatMoney(data.totalAssets)}</TableCell>
              </TableRow>

              {/* Liabilities */}
              <TableRow className="bg-orange-50">
                <TableCell colSpan={2} className="font-bold text-orange-700">負債 Liabilities</TableCell>
              </TableRow>
              {data.liabilities.map((l: any) => (
                <TableRow key={l.accountCode}>
                  <TableCell className="pl-8">{l.accountCode} {l.accountNameZh}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(l.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-orange-50 font-bold">
                <TableCell className="text-right">負債合計</TableCell>
                <TableCell className="text-right font-mono text-orange-700">{formatMoney(data.totalLiabilities)}</TableCell>
              </TableRow>

              {/* Equity */}
              <TableRow className="bg-purple-50">
                <TableCell colSpan={2} className="font-bold text-purple-700">權益 Equity</TableCell>
              </TableRow>
              {data.equity.map((e: any, i: number) => (
                <TableRow key={e.accountCode + i}>
                  <TableCell className="pl-8">{e.accountCode !== '---' ? `${e.accountCode} ` : ''}{e.accountNameZh}</TableCell>
                  <TableCell className={`text-right font-mono ${parseFloat(e.amount) < 0 ? 'text-red-600' : ''}`}>
                    {formatMoney(e.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-purple-50 font-bold">
                <TableCell className="text-right">權益合計</TableCell>
                <TableCell className="text-right font-mono text-purple-700">{formatMoney(data.totalEquity)}</TableCell>
              </TableRow>

              {/* Balance Check */}
              <TableRow className="bg-muted font-bold">
                <TableCell className="text-right">負債 + 權益 合計</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney((parseFloat(data.totalLiabilities) + parseFloat(data.totalEquity)).toFixed(2))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== General Ledger =====
function GeneralLedger({ year, month, postedOnly }: { year: number; month?: number; postedOnly: boolean }) {
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  const { data: accounts } = trpc.accounting.getChartOfAccounts.useQuery();

  const { data, isLoading } = trpc.accounting.generalLedger.useQuery({
    accountCode: selectedAccount,
    fiscalYear: year,
    fiscalMonth: month,
    postedOnly,
  }, { enabled: !!selectedAccount });

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          總帳明細 General Ledger
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="選擇科目查看明細" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((a: any) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code} {a.nameZh} ({a.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedAccount && (
          <div className="text-center py-8 text-muted-foreground">請選擇科目查看明細</div>
        )}

        {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {data && selectedAccount && (
          <>
            {data.account && (
              <div className="mb-3 text-sm text-muted-foreground">
                {data.account.code} - {data.account.nameZh} ({data.account.name}) | 
                期初餘額: <span className="font-mono font-bold">{formatMoney(data.openingBalance)}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>日期</TableHead>
                    <TableHead>編號</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="text-right">借方 Dr</TableHead>
                    <TableHead className="text-right">貸方 Cr</TableHead>
                    <TableHead className="text-right">累計餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={5} className="font-bold">期初餘額 Opening Balance</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatMoney(data.openingBalance)}</TableCell>
                  </TableRow>

                  {(() => {
                    let runningBalance = parseFloat(data.openingBalance);
                    return data.entries.map((e: any) => {
                      const dr = parseFloat(e.debit || '0');
                      const cr = parseFloat(e.credit || '0');
                      runningBalance += dr - cr;
                      return (
                        <TableRow key={e.lineId}>
                          <TableCell className="text-sm">{e.entryDate}</TableCell>
                          <TableCell className="font-mono text-xs">{e.entryNumber}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{e.lineDescription || e.description}</TableCell>
                          <TableCell className="text-right font-mono">{dr > 0 ? formatMoney(dr) : '-'}</TableCell>
                          <TableCell className="text-right font-mono">{cr > 0 ? formatMoney(cr) : '-'}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${runningBalance < 0 ? 'text-red-600' : ''}`}>
                            {formatMoney(runningBalance.toFixed(2))}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}

                  {data.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">該期間無交易記錄</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Main Reports Component =====
export default function AccountingReports() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [postedOnly, setPostedOnly] = useState(true);

  const yearOptions = Array.from({ length: 3 }, (_, i) => 2025 + i);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedMonth !== undefined ? String(selectedMonth) : "all"} onValueChange={(v) => setSelectedMonth(v === "all" ? undefined : Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全年度</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant={postedOnly ? "default" : "outline"} onClick={() => setPostedOnly(!postedOnly)}>
          {postedOnly ? "僅已過帳" : "含草稿"}
        </Button>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="trial-balance">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trial-balance" className="text-xs sm:text-sm">試算表</TabsTrigger>
          <TabsTrigger value="pnl" className="text-xs sm:text-sm">損益表</TabsTrigger>
          <TabsTrigger value="balance-sheet" className="text-xs sm:text-sm">資產負債表</TabsTrigger>
          <TabsTrigger value="general-ledger" className="text-xs sm:text-sm">總帳明細</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance">
          <TrialBalance year={selectedYear} month={selectedMonth} postedOnly={postedOnly} />
        </TabsContent>

        <TabsContent value="pnl">
          <ProfitAndLoss year={selectedYear} month={selectedMonth} postedOnly={postedOnly} />
        </TabsContent>

        <TabsContent value="balance-sheet">
          <BalanceSheet year={selectedYear} month={selectedMonth} postedOnly={postedOnly} />
        </TabsContent>

        <TabsContent value="general-ledger">
          <GeneralLedger year={selectedYear} month={selectedMonth} postedOnly={postedOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
