import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, Award, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { QuarterlyFeeStatistics } from "@/components/QuarterlyFeeStatistics";

export default function CoachStatsWithElite() {
  const { data: coachStats, isLoading } = trpc.coachStats.getAll.useQuery();
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">教練統計</h2>
          <p className="text-sm text-muted-foreground mt-1">包含恆常班及精英班的學費歸屬統計</p>
        </div>
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">教練人數</p>
            <p className="text-2xl font-bold">{coachStats.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">恆常班總學生</p>
            <p className="text-2xl font-bold">{coachStats.reduce((sum, c) => sum + c.regularStudentCount, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">精英班總學生</p>
            <p className="text-2xl font-bold text-amber-600">{coachStats.reduce((sum, c) => sum + c.eliteStudentCount, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">精英班已收學費</p>
            <p className="text-2xl font-bold text-green-600">${coachStats.reduce((sum, c) => sum + c.eliteTotalPaid, 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 各教練卡片 */}
      {coachStats.map((coach) => {
        const isExpanded = expandedCoach === coach.coachName;
        const hasEliteStudents = coach.eliteStudentCount > 0;

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
                </div>
                <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">恆常班季度學費</span>
                  </div>
                  <p className="text-xl font-bold text-green-700">${coach.regularTotalFee.toLocaleString()}</p>
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

              {/* 精英班學生列表 */}
              {hasEliteStudents && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 border-b border-amber-200">
                    <span className="text-sm font-semibold text-amber-800">🥋 精英班學生名單</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">姓名</TableHead>
                        <TableHead className="text-xs">電話</TableHead>
                        <TableHead className="text-xs">帶級</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coach.eliteStudents.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.name}</TableCell>
                          <TableCell className="text-sm">{s.phone || '-'}</TableCell>
                          <TableCell className="text-sm">{s.beltLevel || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 展開的季度統計 */}
              {isExpanded && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">恆常班季度統計詳情</h4>
                  <QuarterlyFeeStatistics coachName={coach.coachName} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* 學費歸屬說明 */}
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-4 pb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 學費歸屬邏輯說明</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• <strong>恆常班</strong>：根據學生所在道場的班別自動歸屬對應教練</li>
            <li>• <strong>精英班</strong>：根據精英班學生管理中設定的「負責教練」欄位歸屬</li>
            <li>• 精英班學費以每 12 堂 $2,400 為一個繳費循環計算</li>
            <li>• 未設定負責教練的精英班學生不會計入任何教練的統計</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
