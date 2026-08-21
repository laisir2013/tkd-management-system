import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Banknote, CheckCircle2, X } from "lucide-react";
import { useState, useMemo } from "react";

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

export default function PayrollSheet() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showPayDialog, setShowPayDialog] = useState<{ coachName: string; year: number; month: number; owed: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payReceipt, setPayReceipt] = useState<File | null>(null);
  const [payNotes, setPayNotes] = useState('');

  const utils = trpc.useUtils();

  // 取得月度財務報表 (含每月薪金計算)
  const { data: financeData, isLoading } = trpc.coachStats.getMonthlyFinance.useQuery({ year: selectedYear });

  // 取得該年所有出糧記錄
  const { data: payrollRecords } = trpc.payroll.getAll.useQuery({ year: selectedYear });

  // 出糧 mutation
  const payMutation = trpc.payroll.addAdhocPayment.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getArrearsBalance.invalidate();
      setShowPayDialog(null);
      setPayAmount('');
      setPayReceipt(null);
      setPayNotes('');
    },
    onError: (err) => alert(`出糧失敗：${err.message}`),
  });



  const yearOptions = [];
  for (let y = 2024; y <= currentYear + 1; y++) yearOptions.push(y);

  // 組合每月數據 + 已出糧
  const sheetData = useMemo(() => {
    if (!financeData) return [];

    const rows: Array<{
      coachName: string;
      year: number;
      month: number;
      regularIncome: number;
      eliteIncome: number;
      totalIncome: number;
      mpf: number;
      operatingFee: number;
      netSalary: number;
      paidAmount: number;
      balance: number; // 正=欠薪, 負=溢付
    }> = [];

    for (const coach of financeData) {
      let runningBalance = 0; // 累積結餘帶到下個月

      for (let m = 1; m <= 12; m++) {
        const monthData = coach.months[m];
        if (!monthData) continue;

        const regularIncome = monthData.regularIncome || 0;
        const eliteIncome = monthData.eliteIncome || 0;
        const totalIncome = monthData.totalIncome || 0;
        const mpf = monthData.mpf || 0;
        const operating = monthData.operating || 0;
        const netSalary = monthData.netSalary || 0;

        // 該月已出糧金額
        const monthPaid = (payrollRecords || [])
          .filter(r => r.coachName === coach.coachName && r.year === selectedYear && r.month === m && r.status === 'paid')
          .reduce((sum, r) => sum + parseFloat(String(r.netAmount)), 0);

        // 結餘 = 上月結餘 + 本月應發 - 本月已出
        runningBalance = runningBalance + netSalary - monthPaid;

        if (netSalary > 0 || monthPaid > 0) {
          rows.push({
            coachName: coach.coachName,
            year: selectedYear,
            month: m,
            regularIncome,
            eliteIncome,
            totalIncome,
            mpf,
            operatingFee: operating,
            netSalary,
            paidAmount: monthPaid,
            balance: Math.round(runningBalance * 100) / 100,
          });
        }
      }
    }

    return rows;
  }, [financeData, payrollRecords, selectedYear]);

  // 按教練分組
  const coachGroups = useMemo(() => {
    const groups = new Map<string, typeof sheetData>();
    for (const row of sheetData) {
      if (!groups.has(row.coachName)) groups.set(row.coachName, []);
      groups.get(row.coachName)!.push(row);
    }
    return groups;
  }, [sheetData]);

  const handlePay = async () => {
    if (!showPayDialog || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('請輸入有效金額');
      return;
    }

    // 如有收據先上傳
    let receiptUrl: string | undefined;
    if (payReceipt) {
      try {
        const formData = new FormData();
        formData.append('file', payReceipt);
        const resp = await fetch('/api/upload/receipt', { method: 'POST', body: formData });
        const data = await resp.json();
        if (data.url) receiptUrl = data.url;
      } catch (e) {
        // 上傳失敗不阻擋出糧
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    payMutation.mutate({
      coachName: showPayDialog.coachName,
      amount,
      paymentDate: `${showPayDialog.year}-${String(showPayDialog.month).padStart(2, '0')}-${dateStr.split('-')[2]}`,
      notes: payNotes || `${showPayDialog.year}年${showPayDialog.month}月出糧${receiptUrl ? ' (附收據)' : ''}`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 標題 + 年份選擇 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            教練出糧總覽
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            每月薪金計算 + 出糧記錄 + 結餘累積
          </p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 每位教練的出糧表 */}
      {Array.from(coachGroups.entries()).map(([coachName, rows]) => {
        const totalOwed = rows.reduce((s, r) => s + r.netSalary, 0);
        const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
        const finalBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

        return (
          <Card key={coachName} className="overflow-hidden">
            <CardHeader className="pb-2 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">
                    {coachName.charAt(0)}
                  </div>
                  {coachName}
                </CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <span>應發: <strong className="text-blue-700">${totalOwed.toLocaleString()}</strong></span>
                  <span>已付: <strong className="text-green-700">${totalPaid.toLocaleString()}</strong></span>
                  {finalBalance > 0 ? (
                    <Badge variant="destructive" className="text-xs">欠薪 ${finalBalance.toLocaleString()}</Badge>
                  ) : finalBalance < 0 ? (
                    <Badge className="text-xs bg-green-600">溢付 ${Math.abs(finalBalance).toLocaleString()}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">結清</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-xs">
                      <TableHead className="text-xs w-16">月份</TableHead>
                      <TableHead className="text-xs text-right">恆常班</TableHead>
                      <TableHead className="text-xs text-right">精英班</TableHead>
                      <TableHead className="text-xs text-right">總收入</TableHead>
                      <TableHead className="text-xs text-right text-red-600">MPF</TableHead>
                      <TableHead className="text-xs text-right text-red-600">行政費</TableHead>
                      <TableHead className="text-xs text-right font-bold">應發薪金</TableHead>
                      <TableHead className="text-xs text-right text-green-700">已出糧</TableHead>
                      <TableHead className="text-xs text-right">結餘</TableHead>
                      <TableHead className="text-xs text-center w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.month}`} className="text-xs">
                        <TableCell className="font-medium">{MONTH_LABELS[row.month - 1]}</TableCell>
                        <TableCell className="text-right">${row.regularIncome.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${row.eliteIncome.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${row.totalIncome.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">−${row.mpf.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">−${row.operatingFee.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-teal-700">${row.netSalary.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {row.paidAmount > 0 ? (
                            <span className="text-green-700 font-medium">${row.paidAmount.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.balance > 0 ? (
                            <span className="text-red-600 font-medium">${row.balance.toLocaleString()}</span>
                          ) : row.balance < 0 ? (
                            <span className="text-green-600 font-medium">−${Math.abs(row.balance).toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-400">$0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              setShowPayDialog({
                                coachName: row.coachName,
                                year: row.year,
                                month: row.month,
                                owed: row.balance,
                              });
                              setPayAmount(row.balance > 0 ? row.balance.toString() : row.netSalary.toString());
                            }}
                          >
                            <Banknote className="h-3 w-3 mr-0.5" />
                            出糧
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 合計行 */}
                    <TableRow className="bg-gray-50 font-semibold text-xs border-t-2">
                      <TableCell>合計</TableCell>
                      <TableCell className="text-right">${rows.reduce((s, r) => s + r.regularIncome, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${rows.reduce((s, r) => s + r.eliteIncome, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${rows.reduce((s, r) => s + r.totalIncome, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">−${rows.reduce((s, r) => s + r.mpf, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">−${rows.reduce((s, r) => s + r.operatingFee, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-teal-700">${totalOwed.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-700">${totalPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {finalBalance > 0 ? (
                          <span className="text-red-600">${finalBalance.toLocaleString()}</span>
                        ) : finalBalance < 0 ? (
                          <span className="text-green-600">−${Math.abs(finalBalance).toLocaleString()}</span>
                        ) : (
                          <span>$0</span>
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {sheetData.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Banknote className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>該年度暫無薪金數據</p>
        </div>
      )}

      {/* 出糧 Dialog */}
      {showPayDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPayDialog(null)}>
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  出糧 — {showPayDialog.coachName}
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowPayDialog(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {showPayDialog.year}年{showPayDialog.month}月
                {showPayDialog.owed > 0 && ` · 累積欠薪 $${showPayDialog.owed.toLocaleString()}`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">出糧金額 ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="輸入金額"
                  className="text-lg font-bold"
                />
                {payAmount && showPayDialog.owed > 0 && (
                  <p className="text-xs text-gray-500">
                    出糧後結餘: {(() => {
                      const remaining = showPayDialog.owed - parseFloat(payAmount || '0');
                      if (remaining > 0) return <span className="text-red-600">尚欠 ${remaining.toLocaleString()}</span>;
                      if (remaining < 0) return <span className="text-green-600">溢付 ${Math.abs(remaining).toLocaleString()} (帶到下月)</span>;
                      return <span className="text-green-600">結清 ✓</span>;
                    })()}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">上傳收據 (可選)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPayReceipt(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                  {payReceipt && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                      已選檔
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">備註</label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="例：銀行轉帳 / FPS"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowPayDialog(null)}>取消</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  onClick={handlePay}
                  disabled={payMutation.isPending || !payAmount}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {payMutation.isPending ? '處理中...' : '確認出糧'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
