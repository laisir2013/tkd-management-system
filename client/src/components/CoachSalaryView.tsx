import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, DollarSign, Banknote, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

interface CoachSalaryViewProps {
  coachName: string;
}

export default function CoachSalaryView({ coachName }: CoachSalaryViewProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 取得本年月度財務報表（教練只能看到自己的資料）
  const { data: financeData, isLoading } = trpc.coachStats.getMonthlyFinance.useQuery({ year: selectedYear });

  // 取得所有出糧記錄（教練只能看到自己的）
  const { data: payrollRecords } = trpc.payroll.getAll.useQuery({});

  // 取得之前年份的財務數據（用於計算跨年前期結餘）
  const prior2024 = trpc.coachStats.getMonthlyFinance.useQuery({ year: 2024 }, { enabled: selectedYear > 2024 });
  const prior2025 = trpc.coachStats.getMonthlyFinance.useQuery({ year: 2025 }, { enabled: selectedYear > 2025 });

  const yearOptions = [];
  for (let y = 2024; y <= currentYear + 1; y++) yearOptions.push(y);

  // 從 financeData 中提取自己的數據
  const myFinance = useMemo(() => {
    if (!financeData || financeData.length === 0) return null;
    return (financeData as any[]).find((c: any) => c.coachName === coachName) || null;
  }, [financeData, coachName]);

  // 計算合併扣除百分比（MPF + 行政費）
  const combinedRate = useMemo(() => {
    if (!myFinance?.feeRates) return 0;
    return ((myFinance.feeRates.mpfRate || 0) + (myFinance.feeRates.operatingRate || 0));
  }, [myFinance]);

  // 計算跨年前期結餘
  const priorBalance = useMemo(() => {
    if (selectedYear <= 2024) return 0;
    let balance = 0;

    const priorYearsData: Array<{ year: number; data: any[] | undefined }> = [];
    if (selectedYear > 2024) priorYearsData.push({ year: 2024, data: prior2024.data as any });
    if (selectedYear > 2025) priorYearsData.push({ year: 2025, data: prior2025.data as any });

    for (const { year, data } of priorYearsData) {
      if (!data) continue;
      const coach = data.find((c: any) => c.coachName === coachName);
      if (!coach) continue;
      for (let m = 1; m <= 12; m++) {
        const md = coach.months[m];
        if (md) balance += md.netSalary || 0;
      }
    }

    // 減去前期年份的已付金額
    const priorPaid = (payrollRecords || [])
      .filter((r: any) => r.coachName === coachName && r.year < selectedYear && r.status === 'paid')
      .reduce((sum: number, r: any) => sum + parseFloat(String(r.netAmount)), 0);

    balance -= priorPaid;
    return Math.round(balance * 100) / 100;
  }, [selectedYear, prior2024.data, prior2025.data, payrollRecords, coachName]);

  // 月度明細表數據（含累積結餘）
  const monthlyBreakdown = useMemo(() => {
    if (!myFinance) return [];

    let runningBalance = priorBalance;
    const rows = [];

    for (let m = 1; m <= 12; m++) {
      const md = myFinance.months[m];
      if (!md || md.totalIncome === 0) {
        // 即使無收入也顯示已付款
        const monthPaid = (payrollRecords || [])
          .filter((r: any) => r.coachName === coachName && r.year === selectedYear && r.month === m && r.status === 'paid')
          .reduce((sum: number, r: any) => sum + parseFloat(String(r.netAmount)), 0);
        if (monthPaid > 0) {
          runningBalance -= monthPaid;
        }
        rows.push({
          month: m,
          totalIncome: 0,
          combinedDeduction: 0,
          netSalary: 0,
          paid: monthPaid,
          balance: Math.round(runningBalance * 100) / 100,
        });
        continue;
      }

      const totalIncome = md.totalIncome;
      const combinedDeduction = (md.mpf || 0) + (md.operating || 0);
      const netSalary = md.netSalary;

      runningBalance += netSalary;

      // 當月已付金額
      const monthPaid = (payrollRecords || [])
        .filter((r: any) => r.coachName === coachName && r.year === selectedYear && r.month === m && r.status === 'paid')
        .reduce((sum: number, r: any) => sum + parseFloat(String(r.netAmount)), 0);

      runningBalance -= monthPaid;

      rows.push({
        month: m,
        totalIncome,
        combinedDeduction,
        netSalary,
        paid: monthPaid,
        balance: Math.round(runningBalance * 100) / 100,
      });
    }

    return rows;
  }, [myFinance, payrollRecords, selectedYear, coachName, priorBalance]);

  // 出糧記錄列表
  const paymentHistory = useMemo(() => {
    if (!payrollRecords) return [];
    return (payrollRecords as any[])
      .filter((r: any) => r.coachName === coachName && r.status === 'paid')
      .sort((a: any, b: any) => {
        // 按年月倒序
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [payrollRecords, coachName]);

  // 匯總
  const totalNetSalary = monthlyBreakdown.reduce((sum, r) => sum + r.netSalary, 0);
  const totalPaid = monthlyBreakdown.reduce((sum, r) => sum + r.paid, 0);
  const currentBalance = monthlyBreakdown.length > 0 ? monthlyBreakdown[monthlyBreakdown.length - 1].balance : priorBalance;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 年份選擇器 + 匯總卡片 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1 border-blue-300 bg-blue-50 text-blue-700">
            <DollarSign className="w-3.5 h-3.5 mr-1" />
            應發合計：${totalNetSalary.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 border-green-300 bg-green-50 text-green-700">
            <Banknote className="w-3.5 h-3.5 mr-1" />
            已付合計：${totalPaid.toLocaleString()}
          </Badge>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${currentBalance > 0 ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 bg-gray-50 text-gray-700'}`}>
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            累積結餘：${currentBalance.toLocaleString()}
          </Badge>
        </div>
      </div>

      {/* 扣除率說明 */}
      {myFinance && (
        <div className="text-sm text-muted-foreground bg-gray-50 px-3 py-2 rounded-md border">
          扣除比率：<span className="font-semibold text-gray-700">{(combinedRate * 100).toFixed(0)}%</span>
          <span className="text-xs ml-1">（含 MPF + 行政費）</span>
        </div>
      )}

      {/* 月度薪金明細表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            {selectedYear} 年月度薪金明細
            {priorBalance !== 0 && (
              <Badge variant="secondary" className="text-xs">
                📌 前期結餘：${priorBalance.toLocaleString()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-16">月份</TableHead>
                <TableHead className="text-right">收入</TableHead>
                <TableHead className="text-right">扣除({(combinedRate * 100).toFixed(0)}%)</TableHead>
                <TableHead className="text-right">應發</TableHead>
                <TableHead className="text-right">已付</TableHead>
                <TableHead className="text-right">累積結餘</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 前期結餘列 */}
              {priorBalance !== 0 && (
                <TableRow className="bg-amber-50/50">
                  <TableCell className="text-center text-xs text-muted-foreground" colSpan={5}>
                    📌 前期結餘（{selectedYear}年之前累積）
                  </TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">
                    ${priorBalance.toLocaleString()}
                  </TableCell>
                </TableRow>
              )}

              {monthlyBreakdown.map((row) => {
                const hasData = row.totalIncome > 0 || row.paid > 0;
                if (!hasData && row.balance === priorBalance) return null; // 跳過無任何活動的月份

                return (
                  <TableRow key={row.month} className={row.totalIncome === 0 && row.paid === 0 ? 'opacity-50' : ''}>
                    <TableCell className="text-center font-medium">{MONTH_LABELS[row.month - 1]}</TableCell>
                    <TableCell className="text-right">
                      {row.totalIncome > 0 ? `$${row.totalIncome.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {row.combinedDeduction > 0 ? `-$${row.combinedDeduction.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">
                      {row.netSalary > 0 ? `$${row.netSalary.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {row.paid > 0 ? `$${row.paid.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${row.balance > 0 ? 'text-amber-700' : row.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      ${row.balance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* 合計列 */}
              <TableRow className="border-t-2 font-bold bg-gray-50">
                <TableCell className="text-center">合計</TableCell>
                <TableCell className="text-right">
                  ${monthlyBreakdown.reduce((s, r) => s + r.totalIncome, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  -${monthlyBreakdown.reduce((s, r) => s + r.combinedDeduction, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-blue-700">${totalNetSalary.toLocaleString()}</TableCell>
                <TableCell className="text-right text-green-700">${totalPaid.toLocaleString()}</TableCell>
                <TableCell className={`text-right ${currentBalance > 0 ? 'text-amber-700' : currentBalance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  ${currentBalance.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 出糧記錄 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            出糧記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">暫無出糧記錄</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">年月</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-center">狀態</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="text-center">日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-center">{record.year}年{record.month}月</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        ${parseFloat(String(record.netAmount)).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          已付
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {record.createdAt ? new Date(record.createdAt).toLocaleDateString('zh-HK') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
