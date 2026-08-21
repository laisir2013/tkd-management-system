import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, Award, ChevronDown, ChevronUp, Loader2, Calculator, Banknote, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { QuarterlyFeeStatistics } from "@/components/QuarterlyFeeStatistics";

const QUARTER_LABELS = ['1-3月(第一季)', '4-6月(第二季)', '7-9月(第三季)', '10-12月(第四季)'];

export default function CoachStatsWithElite() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);
  const [showPayDialog, setShowPayDialog] = useState<{ coachName: string; amount: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payReceipt, setPayReceipt] = useState<File | null>(null);

  // 傳入 year/quarter 讓後端按季度計算實收
  const { data: coachStats, isLoading } = trpc.coachStats.getAll.useQuery({
    year: selectedYear,
    quarter: selectedQuarter,
  });

  // 讀取行政費率設定
  const { data: feeRates } = trpc.adminFees.getAllRates.useQuery({});

  // 讀取月度財務報表（每月薪金明細）
  const { data: monthlyFinance } = trpc.coachStats.getMonthlyFinance.useQuery({ year: selectedYear });

  // 讀取出糧記錄（不限年份，用於跨年累積）
  const { data: payrollRecords } = trpc.payroll.getAll.useQuery({});

  // 取得之前年份的財務數據（用於計算跨年前期結餘）
  const prior2024 = trpc.coachStats.getMonthlyFinance.useQuery({ year: 2024 }, { enabled: selectedYear > 2024 });
  const prior2025 = trpc.coachStats.getMonthlyFinance.useQuery({ year: 2025 }, { enabled: selectedYear > 2025 });

  const utils = trpc.useUtils();
  // 出糧 mutation
  const payMutation = trpc.payroll.addAdhocPayment.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      setShowPayDialog(null);
      setPayAmount('');
      setPayNotes('');
      setPayReceipt(null);
      alert('✅ 出糧成功！');
    },
    onError: (err) => alert(`出糧失敗：${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!coachStats || coachStats.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">暫無教練統計資料</div>;
  }

  const toggleCoach = (name: string) => {
    setExpandedCoach(expandedCoach === name ? null : name);
  };

  // 全公司匯總
  const totalRegularStudents = coachStats.reduce((sum, c) => sum + c.regularStudentCount, 0);
  const totalRegularExpected = coachStats.reduce((sum, c) => sum + (c.regularExpectedFee || 0), 0);
  const totalRegularPaid = coachStats.reduce((sum, c) => sum + c.regularTotalFee, 0);
  const totalEliteStudents = coachStats.reduce((sum, c) => sum + c.eliteStudentCount, 0);
  const totalElitePaid = coachStats.reduce((sum, c) => sum + c.eliteTotalPaid, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">教練統計</h2>
          <p className="text-sm text-muted-foreground mt-1">包含恆常班及精英班的學費歸屬統計</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm"
          >
            {QUARTER_LABELS.map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-blue-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">🧑‍🎓 恆常班學生</p>
            <p className="text-2xl font-bold">{totalRegularStudents} 人</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-green-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">$ 恆常班季度學費</p>
            <p className="text-2xl font-bold text-green-700">${totalRegularExpected.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">
              實收 ${totalRegularPaid.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-amber-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">🏅 精英班學生</p>
            <p className="text-2xl font-bold text-amber-600">{totalEliteStudents} 人</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-purple-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">$ 精英班已收學費</p>
            <p className="text-2xl font-bold text-purple-600">${totalElitePaid.toLocaleString()}</p>
            <p className="text-xs text-purple-500 mt-0.5">
              共 {coachStats.reduce((sum, c) => sum + c.eliteTotalClasses, 0)} 堂
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 各教練卡片 */}
      {coachStats.map((coach) => {
        const isExpanded = expandedCoach === coach.coachName;
        const hasEliteStudents = coach.eliteStudentCount > 0;
        const regularExpected = coach.regularExpectedFee || 0;
        const regularPaid = coach.regularTotalFee;

        // 薪金計算用實收
        const totalRevenue = regularPaid + coach.eliteTotalPaid;
        const coachRates = feeRates?.[coach.coachName] || { mpfRate: 0.10, operatingRate: 0.05 };
        const mpfDeduction = Math.round(totalRevenue * coachRates.mpfRate);
        const operatingFee = Math.round(totalRevenue * coachRates.operatingRate);
        const netSalary = totalRevenue - mpfDeduction - operatingFee;

        return (
          <Card key={coach.coachName} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                    {coach.coachName.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{coach.coachName}</CardTitle>
                    <CardDescription>
                      恆常班 {coach.regularStudentCount} 人
                      {hasEliteStudents && <span className="text-amber-600"> · 精英班 {coach.eliteStudentCount} 人</span>}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleCoach(coach.coachName)}>
                  {isExpanded ? (
                    <><ChevronUp className="h-4 w-4 mr-1" />收起</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-1" />展開</>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* 統計數字 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">恆常班學生</span>
                  </div>
                  <p className="text-xl font-bold text-blue-700">{coach.regularStudentCount} 人</p>
                  <p className="text-xs text-blue-500 mt-0.5">已繳 {coach.regularPaidStudentCount || 0} 人</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">恆常班季度學費</span>
                  </div>
                  <p className="text-xl font-bold text-green-700">${regularExpected.toLocaleString()}</p>
                  <p className="text-xs text-green-500 mt-0.5">實收 ${regularPaid.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-amber-600 font-medium">精英班學生</span>
                  </div>
                  <p className="text-xl font-bold text-amber-700">{coach.eliteStudentCount} 人</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-purple-600 font-medium">精英班已收學費</span>
                  </div>
                  <p className="text-xl font-bold text-purple-700">${coach.eliteTotalPaid.toLocaleString()}</p>
                  {coach.eliteTotalClasses > 0 && (
                    <p className="text-xs text-purple-500 mt-0.5">共 {coach.eliteTotalClasses} 堂</p>
                  )}
                </div>
              </div>

              {/* 教練薪金計算 */}
              <div className="rounded-lg border-2 border-teal-200 bg-teal-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-teal-700" />
                  <span className="text-sm font-bold text-teal-800">
                    教練薪金計算 — {selectedYear}年 {QUARTER_LABELS[selectedQuarter - 1]}
                  </span>
                </div>
                <Table>
                  <TableBody>
                    <TableRow className="border-0">
                      <TableCell className="py-1.5 pl-0 text-sm text-gray-600">恆常班學費收入（實收）</TableCell>
                      <TableCell className="py-1.5 text-right font-medium">${regularPaid.toLocaleString()}</TableCell>
                    </TableRow>
                    {coach.eliteTotalPaid > 0 && (
                      <TableRow className="border-0">
                        <TableCell className="py-1.5 pl-0 text-sm text-gray-600">精英班學費收入</TableCell>
                        <TableCell className="py-1.5 text-right font-medium">${coach.eliteTotalPaid.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="border-t">
                      <TableCell className="py-1.5 pl-0 text-sm font-semibold">學費總收入</TableCell>
                      <TableCell className="py-1.5 text-right font-bold">${totalRevenue.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-0">
                      <TableCell className="py-1.5 pl-0 text-sm text-red-600">− MPF 強積金 (10%)</TableCell>
                      <TableCell className="py-1.5 text-right text-red-600">−${mpfDeduction.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-0">
                      <TableCell className="py-1.5 pl-0 text-sm text-red-600">− 公司營運費用 ({Math.round(coachRates.operatingRate * 100)}%)</TableCell>
                      <TableCell className="py-1.5 text-right text-red-600">−${operatingFee.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-teal-300">
                      <TableCell className="py-2 pl-0 text-base font-bold text-teal-800">💰 教練實收薪金</TableCell>
                      <TableCell className="py-2 text-right text-xl font-bold text-teal-700">${netSalary.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="text-[10px] text-gray-400 mt-1">
                  計算方式：學費總收入 − MPF − 公司營運 = 教練實收
                </p>
                {/* 出糧按鈕 */}
                <div className="mt-3 pt-3 border-t border-teal-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {selectedYear}年 {QUARTER_LABELS[selectedQuarter - 1]} 應發薪金
                  </span>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                    onClick={() => {
                      setShowPayDialog({ coachName: coach.coachName, amount: netSalary });
                      setPayAmount(netSalary.toString());
                    }}
                  >
                    <Banknote className="h-4 w-4" />
                    出糧
                  </Button>
                </div>
              </div>

              {/* 展開的月度薪金明細 + 每月出糧 */}
              {isExpanded && (
                <div className="pt-4 border-t space-y-4">
                  {/* 每月薪金表 */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                      📅 每月薪金明細 — {selectedYear}年
                    </h4>
                    {(() => {
                      const coachFinance = monthlyFinance?.find(c => c.coachName === coach.coachName);
                      if (!coachFinance) return <p className="text-xs text-gray-400">暫無月度數據</p>;

                      const startMonth = (selectedQuarter - 1) * 3 + 1;
                      const endMonth = selectedQuarter * 3;

                      // 計算跨年前期結餘
                      function getPriorBalance(coachName: string): number {
                        let balance = 0;
                        const priorYearsData: Array<{ year: number; data: any[] | undefined }> = [];
                        if (selectedYear > 2024) priorYearsData.push({ year: 2024, data: prior2024.data as any });
                        if (selectedYear > 2025) priorYearsData.push({ year: 2025, data: prior2025.data as any });
                        for (const { year, data } of priorYearsData) {
                          if (!data) continue;
                          const c = data.find((x: any) => x.coachName === coachName);
                          if (!c) continue;
                          for (let m = 1; m <= 12; m++) {
                            const md = c.months[m];
                            if (md) balance += md.netSalary || 0;
                          }
                        }
                        // 減去前期已付
                        const priorPaid = (payrollRecords || [])
                          .filter((r: any) => r.coachName === coachName && r.year < selectedYear && r.status === 'paid')
                          .reduce((sum: number, r: any) => sum + parseFloat(String(r.netAmount)), 0);
                        balance -= priorPaid;
                        return Math.round(balance * 100) / 100;
                      }

                      // 從跨年前期結餘開始累積
                      let runningBalance = getPriorBalance(coach.coachName);
                      const priorBal = runningBalance;
                      const monthBalances: Record<number, { paid: number; balance: number }> = {};
                      for (let m = 1; m <= 12; m++) {
                        const md = coachFinance.months[m];
                        const mNet = md?.netSalary || 0;
                        const mPaid = (payrollRecords || [])
                          .filter((r: any) => r.coachName === coach.coachName && r.year === selectedYear && r.month === m && r.status === 'paid')
                          .reduce((sum: number, r: any) => sum + parseFloat(String(r.netAmount)), 0);
                        runningBalance = runningBalance + mNet - mPaid;
                        monthBalances[m] = { paid: mPaid, balance: Math.round(runningBalance * 100) / 100 };
                      }

                      // 上季末結餘（帶入本季）— 含跨年前期
                      const prevQuarterEndBalance = startMonth > 1 ? (monthBalances[startMonth - 1]?.balance || 0) : priorBal;

                      return (
                        <div className="space-y-2">
                          {priorBal !== 0 && startMonth === 1 && (
                            <div className={`text-xs px-3 py-1.5 rounded ${priorBal > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                              📌 跨年前期結餘（由2024年Q1累積）：{priorBal > 0 ? `欠薪 $${priorBal.toLocaleString()}` : `溢付 $${Math.abs(priorBal).toLocaleString()}`}
                            </div>
                          )}
                          {prevQuarterEndBalance !== 0 && (
                            <div className={`text-xs px-3 py-1.5 rounded ${prevQuarterEndBalance > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                              {startMonth === 1 ? '前期結餘帶入' : '上季結餘帶入'}：{prevQuarterEndBalance > 0 ? `欠薪 $${prevQuarterEndBalance.toLocaleString()}` : `溢付 $${Math.abs(prevQuarterEndBalance).toLocaleString()}`}
                            </div>
                          )}
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 text-xs">
                                  <TableHead className="text-xs">月份</TableHead>
                                  <TableHead className="text-xs text-right">恆常班</TableHead>
                                  <TableHead className="text-xs text-right">精英班</TableHead>
                                  <TableHead className="text-xs text-right">總收入</TableHead>
                                  <TableHead className="text-xs text-right text-red-600">MPF</TableHead>
                                  <TableHead className="text-xs text-right text-red-600">行政費</TableHead>
                                  <TableHead className="text-xs text-right font-bold">應發</TableHead>
                                  <TableHead className="text-xs text-right text-green-700">已出糧</TableHead>
                                  <TableHead className="text-xs text-right">結餘</TableHead>
                                  <TableHead className="text-xs text-center w-20">操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Array.from({ length: 3 }, (_, i) => startMonth + i).map(m => {
                                  const md = coachFinance.months[m];
                                  if (!md || (md.totalIncome === 0 && monthBalances[m].paid === 0)) return null;

                                  const { paid: monthPaid, balance } = monthBalances[m];

                                  return (
                                    <TableRow key={m} className="text-xs">
                                      <TableCell className="font-medium">{m}月</TableCell>
                                      <TableCell className="text-right">${md.regularIncome.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">${md.eliteIncome.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">${md.totalIncome.toLocaleString()}</TableCell>
                                      <TableCell className="text-right text-red-600">−${md.mpf.toLocaleString()}</TableCell>
                                      <TableCell className="text-right text-red-600">−${md.operating.toLocaleString()}</TableCell>
                                      <TableCell className="text-right font-bold text-teal-700">${md.netSalary.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">
                                        {monthPaid > 0 ? (
                                          <span className="text-green-700 font-medium">${monthPaid.toLocaleString()}</span>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {balance > 0 ? (
                                          <span className="text-red-600 font-medium">${balance.toLocaleString()}</span>
                                        ) : balance < 0 ? (
                                          <span className="text-green-600 font-medium">−${Math.abs(balance).toLocaleString()}</span>
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
                                            // 出糧預填：如有欠薪就填欠薪金額，否則填本月應發
                                            const suggestAmount = balance > 0 ? balance : md.netSalary;
                                            setShowPayDialog({ coachName: coach.coachName, amount: suggestAmount });
                                            setPayAmount(suggestAmount.toString());
                                            setPayNotes(`${selectedYear}年${m}月出糧`);
                                          }}
                                        >
                                          <Banknote className="h-3 w-3 mr-0.5" />
                                          出糧
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {/* 季度小結 */}
                                {(() => {
                                  const qEnd = monthBalances[endMonth]?.balance || 0;
                                  return (
                                    <TableRow className="bg-gray-50 font-semibold text-xs border-t-2">
                                      <TableCell colSpan={8} className="text-right">季末累積結餘：</TableCell>
                                      <TableCell className="text-right">
                                        {qEnd > 0 ? (
                                          <span className="text-red-600">欠 ${qEnd.toLocaleString()}</span>
                                        ) : qEnd < 0 ? (
                                          <span className="text-green-600">溢付 ${Math.abs(qEnd).toLocaleString()}</span>
                                        ) : (
                                          <span>結清</span>
                                        )}
                                      </TableCell>
                                      <TableCell />
                                    </TableRow>
                                  );
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                          {(() => {
                            const qEnd = monthBalances[endMonth]?.balance || 0;
                            if (qEnd === 0) return null;
                            return (
                              <p className="text-[10px] text-gray-500">
                                {qEnd > 0
                                  ? `⚠️ 累積欠薪 $${qEnd.toLocaleString()} 將帶入下季。出糧時建議填入累積金額一次清還。`
                                  : `✅ 溢付 $${Math.abs(qEnd).toLocaleString()} 已帶入下季扣減（下季少出 $${Math.abs(qEnd).toLocaleString()}）。`
                                }
                              </p>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 季度繳費詳情 */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                      恆常班季度統計詳情 — {selectedYear}年 {QUARTER_LABELS[selectedQuarter - 1]}
                    </h4>
                    <QuarterlyFeeStatistics coachName={coach.coachName} year={selectedYear} quarter={selectedQuarter} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* 學費歸屬說明 */}
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-4 pb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 學費歸屬及薪金計算邏輯說明</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• <strong>恆常班</strong>：根據學生所在道場的班別自動歸屬對應教練</li>
            <li>• <strong>恆常班實收</strong>：按選定季度的實際繳費記錄計算（支援季繳、月繳、自選月份）</li>
            <li>• <strong>精英班</strong>：根據精英班學生管理中設定的「負責教練」欄位歸屬</li>
            <li>• 精英班學費以每 12 堂 $2,400 為一個繳費循環計算</li>
            <li>• 未設定負責教練的精英班學生不會計入任何教練的統計</li>
            <li className="border-t pt-1.5 mt-1.5">• <strong>教練薪金計算</strong>：學費總收入（實收）− MPF 強積金 − 公司營運費用 = 教練實收（費率可在行政費管理設定）</li>
          </ul>
        </CardContent>
      </Card>

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
                {selectedYear}年 {QUARTER_LABELS[selectedQuarter - 1]} · 應發 ${showPayDialog.amount.toLocaleString()}
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
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">上傳收據</label>
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
                  placeholder="例：銀行轉帳 / FPS / 季度出糧"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowPayDialog(null)}>取消</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  onClick={async () => {
                    const amount = parseFloat(payAmount);
                    if (isNaN(amount) || amount <= 0) { alert('請輸入有效金額'); return; }
                    const today = new Date().toISOString().split('T')[0];

                    let receiptBase64: string | undefined;
                    let receiptMimeType: string | undefined;
                    if (payReceipt) {
                      receiptMimeType = payReceipt.type || 'image/jpeg';
                      const arrayBuffer = await payReceipt.arrayBuffer();
                      const bytes = new Uint8Array(arrayBuffer);
                      let binary = '';
                      bytes.forEach(b => binary += String.fromCharCode(b));
                      receiptBase64 = btoa(binary);
                    }

                    payMutation.mutate({
                      coachName: showPayDialog.coachName,
                      amount,
                      paymentDate: today,
                      notes: payNotes || `${selectedYear}年${QUARTER_LABELS[selectedQuarter - 1]}出糧`,
                      receiptBase64,
                      receiptMimeType,
                    });
                  }}
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
