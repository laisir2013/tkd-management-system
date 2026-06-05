import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, GraduationCap, DollarSign, Calendar } from "lucide-react";

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

  const formatDate = (d: string | Date | null) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

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
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="payments" className="flex items-center gap-1 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              付款紀錄
            </TabsTrigger>
            <TabsTrigger value="exams" className="flex items-center gap-1 text-xs">
              <GraduationCap className="h-3.5 w-3.5" />
              考試成績
            </TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
