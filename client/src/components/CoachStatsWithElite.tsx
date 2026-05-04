import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, Award, ChevronDown, ChevronUp, Loader2, Calculator } from "lucide-react";
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

  // 傳入 year/quarter 讓後端按季度計算實收
  const { data: coachStats, isLoading } = trpc.coachStats.getAll.useQuery({
    year: selectedYear,
    quarter: selectedQuarter,
  }, { refetchInterval: 30000 });

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
        const mpfDeduction = Math.round(totalRevenue * 0.10);
        const operatingFee = Math.round(totalRevenue * 0.05);
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
                      <TableCell className="py-1.5 pl-0 text-sm text-red-600">− 公司營運費用 (5%)</TableCell>
                      <TableCell className="py-1.5 text-right text-red-600">−${operatingFee.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-teal-300">
                      <TableCell className="py-2 pl-0 text-base font-bold text-teal-800">💰 教練實收薪金</TableCell>
                      <TableCell className="py-2 text-right text-xl font-bold text-teal-700">${netSalary.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="text-[10px] text-gray-400 mt-1">
                  計算方式：學費總收入 − 10% MPF − 5% 公司營運 = 實收 85%
                </p>
              </div>

              {/* 展開的季度統計 */}
              {isExpanded && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                    恆常班季度統計詳情 — {selectedYear}年 {QUARTER_LABELS[selectedQuarter - 1]}
                  </h4>
                  <QuarterlyFeeStatistics coachName={coach.coachName} year={selectedYear} quarter={selectedQuarter} />
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
            <li className="border-t pt-1.5 mt-1.5">• <strong>教練薪金計算</strong>：學費總收入（實收）− 10% MPF 強積金 − 5% 公司營運費用 = 實收 85%</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
