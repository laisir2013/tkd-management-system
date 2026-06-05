import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, GraduationCap, DollarSign, Calendar, Trophy, CheckCircle, XCircle } from "lucide-react";

interface StudentRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  studentPhone?: string;
}

const PERIOD_LABELS: Record<string, string> = {
  Q1: "1-3月",
  Q2: "4-6月",
  Q3: "7-9月",
  Q4: "10-12月",
  CUSTOM: "自訂",
  MONTHLY: "單月",
};

export function StudentRecordDialog({ open, onOpenChange, studentId, studentName, studentPhone }: StudentRecordDialogProps) {
  const [activeTab, setActiveTab] = useState("payments");

  // 查詢付款紀錄
  const { data: paymentRecords = [], isLoading: paymentsLoading } = trpc.payments.getByStudentIds.useQuery(
    { studentIds: [studentId] },
    { enabled: open }
  );

  // 查詢考試成績（優先用 phone 匹配，因為 exam_candidates.student_id 可能為 NULL）
  const { data: examByPhone = [], isLoading: examsByPhoneLoading } = trpc.exams.resultsByPhone.useQuery(
    { phone: studentPhone || '' },
    { enabled: open && !!studentPhone }
  );
  const { data: examByStudentId = [], isLoading: examsByIdLoading } = trpc.exams.resultsByStudent.useQuery(
    { studentId },
    { enabled: open && !studentPhone }
  );
  const examResults = studentPhone ? examByPhone : examByStudentId;
  const examsLoading = studentPhone ? examsByPhoneLoading : examsByIdLoading;

  // 查詢是否為精英班學生
  const { data: eliteStudents = [], isLoading: eliteStudentLoading } = trpc.elite.getStudentsByPhone.useQuery(
    { phone: studentPhone || '' },
    { enabled: open && !!studentPhone }
  );
  const eliteStudent = eliteStudents.length > 0 ? eliteStudents[0] : null;
  const eliteStudentId = eliteStudent?.id;

  // 查詢精英班期數明細
  const { data: periodsBreakdown, isLoading: periodsLoading } = trpc.elite.getPeriodsBreakdown.useQuery(
    { studentId: eliteStudentId! },
    { enabled: open && !!eliteStudentId }
  );

  // 查詢精英班付款記錄
  const { data: elitePayments = [], isLoading: elitePaymentsLoading } = trpc.elite.getPayments.useQuery(
    { studentId: eliteStudentId! },
    { enabled: open && !!eliteStudentId }
  );

  const isEliteStudent = !eliteStudentLoading && eliteStudent !== null;
  const eliteLoading = eliteStudentLoading || periodsLoading || elitePaymentsLoading;

  const formatDate = (d: string | Date | null) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const tabCount = isEliteStudent ? 3 : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {studentName} — 學生紀錄
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className={`grid w-full ${tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="payments" className="flex items-center gap-1 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              付款紀錄
            </TabsTrigger>
            <TabsTrigger value="exams" className="flex items-center gap-1 text-xs">
              <GraduationCap className="h-3.5 w-3.5" />
              考試成績
            </TabsTrigger>
            {isEliteStudent && (
              <TabsTrigger value="elite" className="flex items-center gap-1 text-xs">
                <Trophy className="h-3.5 w-3.5" />
                精英班
              </TabsTrigger>
            )}
          </TabsList>

          {/* 付款紀錄 */}
          <TabsContent value="payments" className="mt-3 space-y-3">
            {paymentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : paymentRecords.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">暫無付款紀錄</p>
            ) : (
              <div className="space-y-2">
                {paymentRecords
                  .sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                  .map((record: any) => (
                    <div key={record.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {record.year}年 {PERIOD_LABELS[record.paymentPeriod] || record.paymentPeriod}
                          </Badge>
                          <Badge
                            className={`text-[10px] ${
                              record.status === "confirmed"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-yellow-100 text-yellow-700 border-yellow-300"
                            }`}
                            variant="outline"
                          >
                            {record.status === "confirmed" ? "已確認" : "待確認"}
                          </Badge>
                        </div>
                        <span className="font-bold text-base text-green-700">${Number(record.amount).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>日期：{formatDate(record.paymentDate)}</span>
                        </div>
                        <div>
                          {record.bank && <span>付款銀行：{record.bank}</span>}
                        </div>
                        <div>
                          {record.receivingBank && <span>存入銀行：{record.receivingBank}</span>}
                        </div>
                        <div>
                          {record.confirmedBy && (
                            <span>
                              方式：{record.confirmedBy === "parent_upload" ? "家長上傳" : record.confirmedBy === "admin_approved" ? "管理員" : "教練"}
                            </span>
                          )}
                        </div>
                      </div>
                      {record.receiptTransferDate && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          轉帳日期：{formatDate(record.receiptTransferDate)}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 考試成績 */}
          <TabsContent value="exams" className="mt-3 space-y-3">
            {examsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : examResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">暫無考試紀錄</p>
            ) : (
              <div className="space-y-3">
                {examResults.map((result: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-sm">{result.exam?.title || "考試"}</span>
                        {result.exam?.examDate && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatDate(result.exam.examDate)}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {result.candidate?.beltLevel || "-"}
                      </Badge>
                    </div>
                    {result.candidate?.status && (
                      <div className="mb-2">
                        <Badge
                          className={`text-[10px] ${
                            result.candidate.status === "checked_in"
                              ? "bg-green-100 text-green-700"
                              : result.candidate.status === "absent"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                          variant="outline"
                        >
                          {result.candidate.status === "checked_in" ? "已簽到" : result.candidate.status === "absent" ? "缺席" : result.candidate.status}
                        </Badge>
                      </div>
                    )}
                    {result.scores && result.scores.length > 0 ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-[1fr_auto] gap-x-3 text-xs">
                          {result.scores.map((score: any, sIdx: number) => (
                            <div key={sIdx} className="contents">
                              <span className="text-muted-foreground truncate">{score.itemName}</span>
                              <span className="font-medium text-right">
                                {score.score !== null && score.score !== undefined ? score.score : "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* 總分 */}
                        {result.scores.some((s: any) => s.score !== null) && (
                          <div className="flex justify-between items-center pt-1 border-t mt-1">
                            <span className="text-xs font-medium">總分</span>
                            <span className="font-bold text-sm">
                              {result.scores.reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">尚無評分</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 精英班紀錄 */}
          {isEliteStudent && (
            <TabsContent value="elite" className="mt-3 space-y-4">
              {eliteLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* 基本資訊摘要 */}
                  {periodsBreakdown && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-4 w-4 text-purple-600" />
                        <span className="font-semibold text-sm text-purple-800">週期概覽</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">總期數：</span>
                          <span className="font-medium">{periodsBreakdown.totalPeriods} 期</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">已繳費：</span>
                          <span className="font-medium text-green-700">{periodsBreakdown.paidPeriods} 期</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">每期費用：</span>
                          <span className="font-medium">${periodsBreakdown.feePerPeriod?.toLocaleString()}</span>
                        </div>
                        {periodsBreakdown.unpaidPeriods && periodsBreakdown.unpaidPeriods.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">欠費：</span>
                            <span className="font-medium text-red-600">{periodsBreakdown.unpaidPeriods.length} 期</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 精英班付款記錄 */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      精英班繳費紀錄
                    </h4>
                    {elitePayments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-3 text-xs">暫無繳費紀錄</p>
                    ) : (
                      <div className="space-y-2">
                        {[...elitePayments]
                          .sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                          .map((payment: any) => (
                            <div key={payment.id} className="border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {payment.periodNumber && (
                                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300">
                                      第{payment.periodNumber}期
                                    </Badge>
                                  )}
                                  <Badge
                                    className={`text-[10px] ${
                                      payment.status === "confirmed"
                                        ? "bg-green-100 text-green-700 border-green-300"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                    }`}
                                    variant="outline"
                                  >
                                    {payment.status === "confirmed" ? "已確認" : "待確認"}
                                  </Badge>
                                </div>
                                <span className="font-bold text-sm text-green-700">${Number(payment.amount).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  付款：{formatDate(payment.paymentDate)}
                                </span>
                                <span>{payment.classCount} 堂</span>
                              </div>
                              {payment.periodStartDate && (
                                <div className="text-[10px] text-purple-500 mt-0.5">
                                  期數起始：{formatDate(payment.periodStartDate)}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* 各期出席明細 */}
                  {periodsBreakdown && periodsBreakdown.periods && periodsBreakdown.periods.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-blue-600" />
                        各期出席明細
                      </h4>
                      <div className="space-y-2">
                        {[...periodsBreakdown.periods].reverse().map((period: any) => (
                          <div key={period.periodNumber} className="border rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">第{period.periodNumber}期</span>
                                {period.isComplete ? (
                                  <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-300" variant="outline">
                                    已完成
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-300" variant="outline">
                                    進行中
                                  </Badge>
                                )}
                                {period.isPaid ? (
                                  <Badge className="text-[9px] bg-green-100 text-green-700 border-green-300" variant="outline">
                                    已繳費
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] bg-red-100 text-red-700 border-red-300" variant="outline">
                                    未繳費
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {period.attendedCount}/12 堂
                              </span>
                            </div>
                            {/* 出席日期詳細列表 */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {period.records.map((rec: any, idx: number) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                                    rec.isAttended
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : "bg-orange-50 text-orange-700 border border-orange-200"
                                  }`}
                                >
                                  {rec.isAttended ? (
                                    <CheckCircle className="h-2.5 w-2.5" />
                                  ) : (
                                    <XCircle className="h-2.5 w-2.5" />
                                  )}
                                  {rec.date}
                                </span>
                              ))}
                            </div>
                            {period.absentDates.length > 0 && (
                              <div className="text-[10px] text-orange-600 mt-1">
                                請假/缺席：{period.absentDates.join("、")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
