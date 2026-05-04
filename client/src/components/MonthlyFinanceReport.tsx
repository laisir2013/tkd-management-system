import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

export default function MonthlyFinanceReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([currentMonth]));

  const { data, isLoading } = trpc.coachStats.getMonthlyFinance.useQuery({ year: selectedYear }, { refetchInterval: 30000 });

  const yearOptions = [];
  for (let y = 2026; y <= currentYear + 1; y++) yearOptions.push(y);

  const toggleMonth = (m: number) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">暫無財務數據</div>;
  }

  // 計算每月全公司匯總
  const monthlyTotals: Record<number, {
    regularIncome: number;
    eliteIncome: number;
    totalIncome: number;
    mpf: number;
    operating: number;
    netSalary: number;
    companyProfit: number;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    let regularIncome = 0, eliteIncome = 0, totalIncome = 0, mpf = 0, operating = 0, netSalary = 0;
    data.forEach(coach => {
      const cm = coach.months[m];
      if (cm) {
        regularIncome += cm.regularIncome;
        eliteIncome += cm.eliteIncome;
        totalIncome += cm.totalIncome;
        mpf += cm.mpf;
        operating += cm.operating;
        netSalary += cm.netSalary;
      }
    });
    monthlyTotals[m] = {
      regularIncome,
      eliteIncome,
      totalIncome,
      mpf,
      operating,
      netSalary,
      companyProfit: operating, // 公司實際收益 = 營運費
    };
  }

  // 年度總計
  const yearTotal = Object.values(monthlyTotals).reduce(
    (acc, m) => ({
      regularIncome: acc.regularIncome + m.regularIncome,
      eliteIncome: acc.eliteIncome + m.eliteIncome,
      totalIncome: acc.totalIncome + m.totalIncome,
      mpf: acc.mpf + m.mpf,
      operating: acc.operating + m.operating,
      netSalary: acc.netSalary + m.netSalary,
      companyProfit: acc.companyProfit + m.companyProfit,
    }),
    { regularIncome: 0, eliteIncome: 0, totalIncome: 0, mpf: 0, operating: 0, netSalary: 0, companyProfit: 0 }
  );

  return (
    <div className="space-y-6">
      {/* 頁頭 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-teal-600" />
            每月財務報表
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            按月份查看各教練的收入、支出及結餘
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">年份：</label>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (expandedMonths.size === 12) setExpandedMonths(new Set());
              else setExpandedMonths(new Set(Array.from({length:12},(_,i)=>i+1)));
            }}
          >
            {expandedMonths.size === 12 ? '全部收起' : '全部展開'}
          </Button>
        </div>
      </div>

      {/* 年度匯總卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-teal-600 font-medium">年度總收入</p>
            <p className="text-xl font-bold text-teal-700">${yearTotal.totalIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-red-600 font-medium">年度 MPF (10%)</p>
            <p className="text-xl font-bold text-red-600">${yearTotal.mpf.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 font-medium">年度營運費 (5%)</p>
            <p className="text-xl font-bold text-orange-600">${yearTotal.operating.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-green-600 font-medium">年度教練薪金</p>
            <p className="text-xl font-bold text-green-700">${yearTotal.netSalary.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 每月詳情 */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
        const total = monthlyTotals[month];
        const isExpanded = expandedMonths.has(month);
        const isFuture = selectedYear === currentYear && month > currentMonth;

        return (
          <Card key={month} className={`overflow-hidden ${isFuture ? 'opacity-50' : ''}`}>
            {/* 月份標頭 — 可點擊展開/收起 */}
            <button
              onClick={() => toggleMonth(month)}
              className="w-full text-left"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-bold">
                      {month}
                    </span>
                    {MONTH_LABELS[month - 1]}
                    {isFuture && <span className="text-xs text-gray-400 font-normal">（未到期）</span>}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      收入 <strong className="text-teal-700">${total.totalIncome.toLocaleString()}</strong>
                    </span>
                    <span className="text-gray-500">
                      結餘 <strong className="text-green-700">${total.netSalary.toLocaleString()}</strong>
                    </span>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </div>
              </CardHeader>
            </button>

            {/* 展開的教練明細 */}
            {isExpanded && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data.map(coach => {
                    const cm = coach.months[month];
                    if (!cm || cm.totalIncome === 0 && isFuture) return null;

                    return (
                      <div key={coach.coachName} className="rounded-lg border p-3 space-y-2">
                        {/* 教練名 */}
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">
                            {coach.coachName.charAt(0)}
                          </div>
                          <span className="font-semibold text-sm">{coach.coachName}</span>
                        </div>

                        {/* 收入 */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-teal-700">
                            <TrendingUp className="h-3 w-3" />
                            收入
                          </div>
                          <div className="flex justify-between text-xs pl-4">
                            <span className="text-gray-600">恆常班學費</span>
                            <span className="font-medium">
                              ${cm.regularIncome.toLocaleString()}
                              <span className="text-gray-400 ml-1">({cm.regularPaidCount}/{cm.regularStudentCount}人)</span>
                            </span>
                          </div>
                          {cm.eliteIncome > 0 && (
                            <div className="flex justify-between text-xs pl-4">
                              <span className="text-gray-600">精英班學費</span>
                              <span className="font-medium">
                                ${cm.eliteIncome.toLocaleString()}
                                {cm.eliteClassCount > 0 && <span className="text-gray-400 ml-1">({cm.eliteClassCount}堂)</span>}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs pl-4 font-semibold border-t border-dashed pt-1">
                            <span>小計</span>
                            <span className="text-teal-700">${cm.totalIncome.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* 支出 */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-red-600">
                            <TrendingDown className="h-3 w-3" />
                            支出
                          </div>
                          <div className="flex justify-between text-xs pl-4">
                            <span className="text-gray-600">MPF 強積金 (10%)</span>
                            <span className="text-red-600">−${cm.mpf.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs pl-4">
                            <span className="text-gray-600">公司營運費 (5%)</span>
                            <span className="text-red-600">−${cm.operating.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* 逾期入帳提示 */}
                        {cm.lateEntries && cm.lateEntries.length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                            <div className="text-[10px] font-semibold text-amber-700">⚠️ 逾期入帳（{cm.lateEntries.length} 筆）</div>
                            {cm.lateEntries.map((le: any, idx: number) => (
                              <div key={idx} className="text-[10px] text-amber-600 pl-2">
                                {le.studentName} ${le.amount.toLocaleString()} — 收據為{le.originalMonth}月，{le.processedDate} 才處理
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 結餘 */}
                        <div className="flex justify-between items-center pt-2 border-t-2 border-teal-200">
                          <span className="text-xs font-bold text-teal-800">💰 教練實收</span>
                          <span className="text-base font-bold text-teal-700">${cm.netSalary.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 該月匯總 */}
                <div className="mt-3 rounded-lg bg-gray-50 border p-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">項目</TableHead>
                        <TableHead className="text-xs text-right">金額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="py-1 text-xs">恆常班總收入</TableCell>
                        <TableCell className="py-1 text-xs text-right">${total.regularIncome.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1 text-xs">精英班總收入</TableCell>
                        <TableCell className="py-1 text-xs text-right">${total.eliteIncome.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow className="border-t">
                        <TableCell className="py-1 text-xs font-semibold">當月總收入</TableCell>
                        <TableCell className="py-1 text-xs text-right font-bold text-teal-700">${total.totalIncome.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1 text-xs text-red-600">− MPF (10%)</TableCell>
                        <TableCell className="py-1 text-xs text-right text-red-600">−${total.mpf.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1 text-xs text-red-600">− 公司營運 (5%)</TableCell>
                        <TableCell className="py-1 text-xs text-right text-red-600">−${total.operating.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow className="border-t-2">
                        <TableCell className="py-1.5 text-sm font-bold text-green-800">當月教練薪金總支出</TableCell>
                        <TableCell className="py-1.5 text-right text-base font-bold text-green-700">${total.netSalary.toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* 說明 */}
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-4 pb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 每月財務報表說明</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• <strong>入帳日期</strong>：以收據轉帳日期為準（非處理日期），確保收入歸入正確月份</li>
            <li>• <strong>恆常班月費</strong>：季度學費 ÷ 3 = 月費，只有已繳月份才計入收入</li>
            <li>• <strong>精英班收入</strong>：按收據轉帳日期歸入對應月份</li>
            <li>• <strong>MPF 強積金</strong>：收入的 10%</li>
            <li>• <strong>公司營運費</strong>：收入的 5%</li>
            <li>• <strong>教練實收</strong>：收入 × 85%（扣除 MPF + 營運費）</li>
            <li>• <strong>⚠️ 逾期入帳</strong>：如收據轉帳日期在4月但5月才處理，收入仍計入4月，但會標示為逾期入帳，教練薪金計入5月出糧</li>
            <li>• 灰色月份為未到期月份（尚未有繳費數據）</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
