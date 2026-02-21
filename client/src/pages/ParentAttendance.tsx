import { useState, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, MinusCircle, CalendarOff, Award } from "lucide-react";
import { EliteAttendanceSection } from "@/components/EliteAttendanceSection";

const STATUS_CONFIG = {
  present: { label: "出席", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  absent: { label: "缺席", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  late: { label: "遲到", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  excused: { label: "請假", icon: MinusCircle, color: "text-blue-600", bg: "bg-blue-50" },
} as const;

export default function ParentAttendance() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") || "";
  const [, setLocation] = useLocation();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: attendanceData, isLoading } = trpc.students.getParentAttendance.useQuery(
    { phone, year, month },
    { enabled: !!phone }
  );

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1);
      setMonth(12);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1);
      setMonth(1);
    } else {
      setMonth(m => m + 1);
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="mb-4">請先登入家長系統</p>
            <Button onClick={() => setLocation("/parent")}>返回登入</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 sm:py-12">
      <div className="container max-w-4xl px-3 sm:px-4">
        {/* 頂部導航 */}
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => setLocation(`/payment?phone=${encodeURIComponent(phone)}`)} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回繳費
          </Button>
        </div>

        {/* 月份切換 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl font-bold text-gray-900">
                {year}年{month}月 出席記錄
              </h2>
              <Button variant="ghost" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 圖例 */}
        <div className="flex flex-wrap gap-3 mb-4 px-1">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-center gap-1 text-xs">
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                <span className="text-gray-600">{config.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1 text-xs">
            <CalendarOff className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-600">休息</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3.5 h-3.5 rounded border border-gray-300 bg-gray-100" />
            <span className="text-gray-600">未記錄</span>
          </div>
        </div>

        {/* 精英班出席記錄 */}
        <EliteAttendanceSection phone={phone} />

        {/* 恆常班出席記錄 */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              載入中...
            </CardContent>
          </Card>
        ) : !attendanceData || attendanceData.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              找不到學生資料
            </CardContent>
          </Card>
        ) : (
          attendanceData.map((studentData) => {
            const { student, schedules } = studentData;
            const activeSchedules = schedules.filter((s: any) => s.status === 'active');
            const presentCount = schedules.filter((s: any) => s.attendanceStatus === 'present').length;
            const absentCount = schedules.filter((s: any) => s.attendanceStatus === 'absent').length;
            const lateCount = schedules.filter((s: any) => s.attendanceStatus === 'late').length;
            const excusedCount = schedules.filter((s: any) => s.attendanceStatus === 'excused').length;
            const totalActive = activeSchedules.length;
            const attendanceRate = totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0;

            return (
              <Card key={student.id} className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {student.venue} · {student.scheduleDay} · {student.scheduleTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {attendanceRate}%
                      </div>
                      <p className="text-xs text-gray-500">出席率</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* 統計摘要 */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">{presentCount}</div>
                      <div className="text-xs text-gray-500">出席</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="text-lg font-bold text-red-600">{absentCount}</div>
                      <div className="text-xs text-gray-500">缺席</div>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded">
                      <div className="text-lg font-bold text-amber-600">{lateCount}</div>
                      <div className="text-xs text-gray-500">遲到</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="text-lg font-bold text-blue-600">{excusedCount}</div>
                      <div className="text-xs text-gray-500">請假</div>
                    </div>
                  </div>

                  {/* 每日出席詳情 */}
                  {schedules.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">本月無訓練日期</p>
                  ) : (
                    <div className="space-y-2">
                      {schedules.map((schedule: any) => {
                        const date = new Date(schedule.date);
                        const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()];
                        const dateStr = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
                        const isCancelled = schedule.status === 'cancelled';

                        if (isCancelled) {
                          return (
                            <div key={schedule.scheduleId} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 opacity-60">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-400 w-12 line-through">{dateStr}</span>
                                <span className="text-xs text-gray-400">(星期{dayOfWeek})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CalendarOff className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-400">休息</span>
                              </div>
                            </div>
                          );
                        }

                        const attendanceStatus = schedule.attendanceStatus as keyof typeof STATUS_CONFIG | null;
                        const config = attendanceStatus ? STATUS_CONFIG[attendanceStatus] : null;

                        return (
                          <div key={schedule.scheduleId} className={`flex items-center justify-between p-2.5 rounded-lg ${config ? config.bg : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-700 w-12">{dateStr}</span>
                              <span className="text-xs text-gray-500">(星期{dayOfWeek})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {config ? (
                                <>
                                  {(() => { const Icon = config.icon; return <Icon className={`w-4 h-4 ${config.color}`} />; })()}
                                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-400">未記錄</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
