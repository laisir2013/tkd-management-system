import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, CheckCircle2, MinusCircle } from "lucide-react";

interface EliteAttendanceSectionProps {
  phone: string;
}

export function EliteAttendanceSection({ phone }: EliteAttendanceSectionProps) {
  const { data: eliteInfo, isLoading } = trpc.students.getParentEliteInfo.useQuery(
    { phone },
    { enabled: !!phone }
  );

  if (isLoading || !eliteInfo || eliteInfo.length === 0) {
    return null;
  }

  return (
    <>
      {eliteInfo.map((item) => {
        const { student, totalAttended, paidClasses, remainingClasses, attendanceDetails } = item;

        return (
          <Card key={student.id} className="mb-6 border-purple-200">
            <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  <div>
                    <CardTitle className="text-lg">{student.name}</CardTitle>
                    <p className="text-sm text-purple-600 mt-0.5">
                      精英班 · {student.scheduleDay || ''} {student.scheduleTime || ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">{totalAttended}</div>
                  <p className="text-xs text-gray-500">累計出席堂數</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* 統計摘要 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-600">{totalAttended}</div>
                  <div className="text-xs text-gray-500">出席</div>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded">
                  <div className="text-lg font-bold text-purple-600">{paidClasses}</div>
                  <div className="text-xs text-gray-500">已付堂數</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className={`text-lg font-bold ${remainingClasses <= 0 ? 'text-red-600' : remainingClasses <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>
                    {remainingClasses > 0 ? remainingClasses : 0}
                  </div>
                  <div className="text-xs text-gray-500">剩餘堂數</div>
                </div>
              </div>

              {/* 繳費狀態提醒 */}
              {remainingClasses <= 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    ⚠️ 已付堂數已用完（欠 {Math.abs(remainingClasses)} 堂），請盡快繳交下一期費用（12堂 $2,400）
                  </p>
                </div>
              )}
              {remainingClasses > 0 && remainingClasses <= 3 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 font-medium">
                    ⏰ 已付堂數剩餘 {remainingClasses} 堂，請準備繳交下一期費用
                  </p>
                </div>
              )}

              {/* 出席詳情列表 */}
              <div className="mt-2">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">出席記錄詳情（由近到遠）</h4>
                {attendanceDetails.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">暫無出席記錄</p>
                ) : (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {[...attendanceDetails].reverse().map((record) => {
                      const date = new Date(record.date);
                      const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()];
                      const dateStr = `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;

                      return (
                        <div
                          key={String(record.date)}
                          className="flex items-center justify-between p-2 rounded-lg bg-green-50 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700">{dateStr}</span>
                            <span className="text-xs text-gray-400">(星期{dayOfWeek})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                              第 {record.classNumber} 堂
                            </span>
                            <span className="text-xs text-gray-400">
                              第{record.cycleIndex}期 · {record.cycleNumber}/12
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
