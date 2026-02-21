import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface EliteParentSectionProps {
  phone: string;
}

export function EliteParentSection({ phone }: EliteParentSectionProps) {
  const { data: eliteInfo, isLoading } = trpc.students.getParentEliteInfo.useQuery(
    { phone },
    { enabled: !!phone }
  );

  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <Award className="w-5 h-5" />
            精英班
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600 mr-2" />
            <span className="text-amber-600">載入中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!eliteInfo || eliteInfo.length === 0) {
    return null; // 沒有精英班學生就不顯示
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
      <CardHeader className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Award className="w-6 h-6" />
          精英班
        </CardTitle>
        <p className="text-amber-100 text-sm mt-1">
          每期 12 堂 · 每堂 $200 · 每期 $2,400
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {eliteInfo.map((item) => {
          const { student, totalAttended, cycleNumber, paidClasses, remainingClasses, needPayment, attendanceDetails } = item;
          const isExpanded = expandedStudentId === student.id;
          const currentCycleClass = cycleNumber; // 當前期中的第幾堂
          const remainingInCycle = 12 - currentCycleClass; // 當前期中剩餘堂數
          const unpaidClasses = Math.max(0, totalAttended - paidClasses);

          return (
            <div
              key={student.id}
              className="border rounded-xl overflow-hidden bg-white shadow-sm"
            >
              {/* 學生摘要 */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-lg text-gray-900">
                      {student.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      已上 {totalAttended} 堂 · 已付 {paidClasses} 堂
                    </div>
                  </div>
                  <div className="text-right">
                    {needPayment ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-semibold">需繳費</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-semibold">已繳費</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 當前堂數進度條 */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>當前期數進度</span>
                    <span>第 {currentCycleClass || 0}/12 堂</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        remainingInCycle <= 3
                          ? "bg-red-500"
                          : remainingInCycle <= 6
                          ? "bg-amber-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(((currentCycleClass || 0) / 12) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className={remainingInCycle <= 3 ? "text-red-600 font-semibold" : "text-gray-500"}>
                      剩餘 {remainingInCycle} 堂
                    </span>
                    {remainingClasses > 0 && (
                      <span className="text-green-600">
                        餘額 {remainingClasses} 堂
                      </span>
                    )}
                  </div>
                </div>

                {/* 繳費狀態摘要 */}
                {needPayment && unpaidClasses > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="text-red-800 font-medium">
                          需繳交下一期費用 $2,400
                        </p>
                        <p className="text-red-600 mt-1">
                          未付 {unpaidClasses} 堂 · 
                          共 {Math.ceil(unpaidClasses / 12)} 期 · 
                          合計 ${unpaidClasses * 200}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 展開/收起出席詳情 */}
              <div className="border-t">
                <Button
                  variant="ghost"
                  className="w-full h-10 rounded-none text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  onClick={() =>
                    setExpandedStudentId(isExpanded ? null : student.id)
                  }
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  {isExpanded ? "收起出席詳情" : "查看出席詳情"}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-1" />
                  )}
                </Button>
              </div>

              {/* 出席詳情列表 */}
              {isExpanded && attendanceDetails && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    出席記錄（共 {attendanceDetails.length} 堂）
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                            堂數
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                            日期
                          </th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">
                            期數
                          </th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">
                            繳費
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceDetails.map((record, index) => {
                          const isNewCycle = record.cycleNumber === 1;
                          const isPaid = record.classNumber <= paidClasses;

                          return (
                            <tr key={record.classNumber}>
                              {isNewCycle && index > 0 && (
                                <td colSpan={4} className="p-0">
                                  <div className="py-2 px-3 bg-amber-50 border-t border-b border-amber-200">
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="text-xs font-semibold text-amber-700">
                                        第 {record.cycleIndex} 期（$2,400）
                                        {isPaid ? (
                                          <span className="ml-2 text-green-600">已繳費</span>
                                        ) : (
                                          <span className="ml-2 text-red-600">未繳費</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              )}
                              <td className={`py-2 px-3 border-t border-gray-100 ${!isPaid ? 'bg-red-50/50' : ''}`}>
                                <span className="text-gray-700">第 {record.classNumber} 堂</span>
                                <span className="text-gray-400 text-xs ml-1">
                                  ({record.cycleNumber}/12)
                                </span>
                              </td>
                              <td className={`py-2 px-3 border-t border-gray-100 text-gray-700 ${!isPaid ? 'bg-red-50/50' : ''}`}>
                                {new Date(record.date).toLocaleDateString(
                                  "zh-TW",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    weekday: "short",
                                  }
                                )}
                              </td>
                              <td className={`py-2 px-3 border-t border-gray-100 text-center text-xs ${!isPaid ? 'bg-red-50/50' : ''}`}>
                                第 {record.cycleIndex} 期
                              </td>
                              <td className={`py-2 px-3 border-t border-gray-100 text-center ${!isPaid ? 'bg-red-50/50' : ''}`}>
                                {isPaid ? (
                                  <span className="text-green-600 text-xs font-medium">已付</span>
                                ) : (
                                  <span className="text-red-600 text-xs font-medium">未付</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
