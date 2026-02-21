import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { QuarterlyFeeStatistics } from "@/components/QuarterlyFeeStatistics";
import { useState } from "react";

export default function CoachStatisticsContent() {
  const { data: statistics, isLoading } = trpc.users.getStatistics.useQuery();
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center py-8">載入中...</div>;
  }

  if (!statistics || statistics.length === 0) {
    return <div className="text-center py-8 text-gray-500">暫無教練統計資料</div>;
  }

  const toggleCoach = (coachName: string) => {
    setExpandedCoach(expandedCoach === coachName ? null : coachName);
  };

  return (
    <div className="space-y-6">
      {statistics.map((stat) => (
        <Card key={stat.coachName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{stat.coachName}</CardTitle>
                <CardDescription>教練統計資料</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCoach(stat.coachName)}
              >
                {expandedCoach === stat.coachName ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    收起季度統計
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    展開季度統計
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-600">學生人數</p>
                  <p className="text-2xl font-bold">{stat.studentCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-600 break-words">總學費收入(季度)</p>
                  <p className="text-xl sm:text-2xl font-bold break-all">${stat.totalFee.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 季度統計詳細資訊 */}
            {expandedCoach === stat.coachName && (
              <div className="mt-6 pt-6 border-t">
                <QuarterlyFeeStatistics coachName={stat.coachName} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
