import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, XCircle, Eye, Clock, ImageIcon, UserCheck, FileText } from "lucide-react";
import { toast } from "sonner";

const matchTypeLabels: Record<string, string> = {
  same_amount_date: "同金額+同日期",
  same_transaction_ref: "疑似同一筆交易",
  exact_image: "相同收據圖片",
  similar_image: "相似收據圖片",
  parent_upload: "家長上傳",
  validation_failed: "驗證失敗",
};

const statusColors: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
};

const statusLabels: Record<string, string> = {
  pending_review: "待審查",
  approved: "已批准",
  rejected: "已拒絕",
};

function formatDate(d: any) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(d: any) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ReceiptReviewContent() {
  const [activeTab, setActiveTab] = useState("pending_review");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<"regular" | "elite">("regular");
  const [showCompare, setShowCompare] = useState(false);
  const [showImage, setShowImage] = useState<string | null>(null);
  const [showStudentPayments, setShowStudentPayments] = useState<{ studentId: number; studentName: string; paymentType: "regular" | "elite" } | null>(null);

  const { data: reviews, isLoading, refetch } = trpc.receiptReview.list.useQuery(
    { status: activeTab as any }
  );

  const { data: pendingCount } = trpc.receiptReview.pendingCount.useQuery();

  const { data: studentPayments, isLoading: studentPaymentsLoading } = trpc.receiptReview.studentPayments.useQuery(
    { studentId: showStudentPayments?.studentId ?? 0, paymentType: showStudentPayments?.paymentType ?? 'regular' },
    { enabled: !!showStudentPayments }
  );

  const { data: compareData, isLoading: compareLoading } = trpc.receiptReview.compare.useQuery(
    { paymentId: selectedId ?? 0, paymentType: selectedType },
    { enabled: !!selectedId && showCompare }
  );

  const decideMutation = trpc.receiptReview.decide.useMutation({
    onSuccess: (data) => {
      toast.success(data.decision === "approved" ? "已批准收據" : "已拒絕收據");
      refetch();
      setShowCompare(false);
      setSelectedId(null);
    },
    onError: (err) => {
      toast.error(err.message || "操作失敗");
    },
  });

  const handleDecide = (paymentId: number, paymentType: "regular" | "elite", decision: "approved" | "rejected") => {
    if (!confirm(decision === "approved" ? "確定批准此收據？繳費將被確認。" : "確定拒絕此收據？繳費將保持待確認狀態。")) return;
    decideMutation.mutate({ paymentId, paymentType, decision });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          收據審查
          {(pendingCount?.count ?? 0) > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingCount?.count} 待審
            </Badge>
          )}
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending_review" className="text-xs sm:text-sm">
            <Clock className="w-3 h-3 mr-1" />
            待審查
            {(pendingCount?.count ?? 0) > 0 && (
              <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5">
                {pendingCount?.count}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            已批准
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm">
            <XCircle className="w-3 h-3 mr-1" />
            已拒絕
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : !reviews?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeTab === "pending_review" ? "🎉 沒有待審查的收據" : `沒有${statusLabels[activeTab]}的記錄`}
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((item: any) => (
                <Card key={`${item.paymentType}-${item.id}`} className="border-l-4" style={{
                  borderLeftColor: activeTab === "pending_review" ? "#f59e0b" : activeTab === "approved" ? "#22c55e" : "#ef4444"
                }}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.studentName || "未知學生"}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.paymentType === "elite" ? "精英班" : "恆常班"}
                          </Badge>
                          {item.review_match_type && (
                            <Badge className={`text-xs ${statusColors.pending_review}`}>
                              {matchTypeLabels[item.review_match_type] || item.review_match_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>金額: <span className="font-medium text-foreground">${item.amount}</span> | 期間: {item.paymentPeriod} | {item.venue}{item.coach ? ` · ${item.coach}` : ''}</div>
                          <div>上傳: {formatDateTime(item.createdAt)} | 轉帳: {formatDate(item.receiptTransferDate)}</div>
                          {item.review_reason && (
                            <div className="text-yellow-700 font-medium">原因: {item.review_reason}</div>
                          )}
                          {item.reviewed_by && (
                            <div className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-green-600" />
                              <span className="font-medium text-green-700">
                                {item.confirmedBy === 'coach_approved' ? '教練核准' : '管理員核准'}
                              </span>
                              <span>: {item.reviewed_by}</span>
                              <span className="text-gray-400 ml-1">{formatDateTime(item.reviewed_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {item.receiptUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => setShowImage(item.receiptUrl)}
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            收據
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => setShowStudentPayments({
                            studentId: item.studentId,
                            studentName: item.studentName || '未知',
                            paymentType: item.paymentType,
                          })}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          繳費記錄
                        </Button>
                        {item.review_match_payment_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedId(item.id);
                              setSelectedType(item.paymentType);
                              setShowCompare(true);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            比對
                          </Button>
                        )}
                        {activeTab === "pending_review" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-green-600 hover:bg-green-700"
                              onClick={() => handleDecide(item.id, item.paymentType, "approved")}
                              disabled={decideMutation.isPending}
                            >
                              ✓ 批准
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs h-7"
                              onClick={() => handleDecide(item.id, item.paymentType, "rejected")}
                              disabled={decideMutation.isPending}
                            >
                              ✗ 拒絕
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 收據圖片放大檢視 */}
      <Dialog open={!!showImage} onOpenChange={() => setShowImage(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>收據圖片</DialogTitle>
          </DialogHeader>
          {showImage && (
            <img src={showImage} alt="收據" className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* 學生繳費記錄 Modal */}
      <Dialog open={!!showStudentPayments} onOpenChange={(open) => { if (!open) setShowStudentPayments(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {showStudentPayments?.studentName} — 繳費記錄
            </DialogTitle>
            <DialogDescription>
              {showStudentPayments?.paymentType === 'elite' ? '精英班' : '恆常班'}所有繳費及收據
            </DialogDescription>
          </DialogHeader>
          {studentPaymentsLoading ? (
            <div className="text-center py-8">載入中...</div>
          ) : !studentPayments?.length ? (
            <div className="text-center py-8 text-muted-foreground">沒有繳費記錄</div>
          ) : (
            <div className="space-y-2">
              {(studentPayments as any[]).map((p: any) => (
                <div key={p.id} className={`border rounded-lg p-3 text-xs space-y-1 ${
                  p.reviewStatus === 'pending_review' ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${p.amount}</span>
                      <span className="text-muted-foreground">{p.period}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        p.status === 'confirmed' ? 'border-green-300 text-green-700' : 'border-yellow-300 text-yellow-700'
                      }`}>
                        {p.status === 'confirmed' ? '已確認' : '待確認'}
                      </Badge>
                      {p.reviewStatus && p.reviewStatus !== 'normal' && (
                        <Badge className={`text-[10px] ${statusColors[p.reviewStatus] || ''}`}>
                          {statusLabels[p.reviewStatus] || p.reviewStatus}
                        </Badge>
                      )}
                    </div>
                    {p.receiptUrl && (
                      <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => setShowImage(p.receiptUrl)}>
                        <ImageIcon className="w-3 h-3 mr-1" /> 收據
                      </Button>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    繳費日期: {formatDate(p.paymentDate)} | 建立: {formatDate(p.createdAt)}
                    {p.confirmedBy && ` | ${p.confirmedBy === 'coach_approved' ? '教練核准' : p.confirmedBy === 'parent_upload' ? '家長上傳' : '管理員'}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 比對詳情 Modal */}
      <Dialog open={showCompare} onOpenChange={(open) => { if (!open) { setShowCompare(false); setSelectedId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              收據比對詳情
            </DialogTitle>
            <DialogDescription>
              比較當前上傳收據與疑似重複收據
            </DialogDescription>
          </DialogHeader>

          {compareLoading ? (
            <div className="text-center py-8">載入中...</div>
          ) : compareData ? (
            <div className="space-y-4">
              {/* 當前收據 */}
              <Card className="border-yellow-300 bg-yellow-50/50">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className="bg-yellow-500">當前收據</Badge>
                    {compareData.current?.studentName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 text-xs space-y-1">
                  <div>金額: <strong>${compareData.current?.amount}</strong></div>
                  <div>期間: {compareData.current?.paymentPeriod}</div>
                  <div>上傳時間: {formatDateTime(compareData.current?.createdAt || compareData.current?.created_at)}</div>
                  <div>轉帳日期: {formatDate(compareData.current?.receiptTransferDate || compareData.current?.payment_date)}</div>
                  {compareData.current?.review_reason && (
                    <div className="text-yellow-700 font-medium">審查原因: {compareData.current.review_reason}</div>
                  )}
                  {(compareData.current?.receiptUrl || compareData.current?.receipt_url) && (
                    <img
                      src={compareData.current?.receiptUrl || compareData.current?.receipt_url}
                      alt="當前收據"
                      className="max-h-48 rounded border cursor-pointer"
                      onClick={() => setShowImage(compareData.current?.receiptUrl || compareData.current?.receipt_url)}
                    />
                  )}
                </CardContent>
              </Card>

              {/* 匹配收據 */}
              {compareData.matchedReceipt && (
                <Card className="border-blue-300 bg-blue-50/50">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge className="bg-blue-500">疑似重複</Badge>
                      {compareData.matchedReceipt.studentName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 text-xs space-y-1">
                    <div>金額: <strong>${compareData.matchedReceipt.amount}</strong></div>
                    <div>期間: {compareData.matchedReceipt.paymentPeriod || `${compareData.matchedReceipt.class_count}堂`}</div>
                    <div>上傳時間: {formatDateTime(compareData.matchedReceipt.createdAt || compareData.matchedReceipt.created_at)}</div>
                    <div>轉帳日期: {formatDate(compareData.matchedReceipt.receiptTransferDate || compareData.matchedReceipt.payment_date)}</div>
                    <div>狀態: {compareData.matchedReceipt.status === 'confirmed' ? '✅ 已確認' : '⏳ 待確認'}</div>
                    {(compareData.matchedReceipt.receiptUrl || compareData.matchedReceipt.receipt_url) && (
                      <img
                        src={compareData.matchedReceipt.receiptUrl || compareData.matchedReceipt.receipt_url}
                        alt="疑似重複收據"
                        className="max-h-48 rounded border cursor-pointer"
                        onClick={() => setShowImage(compareData.matchedReceipt?.receiptUrl || compareData.matchedReceipt?.receipt_url)}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">無法取得比對資料</div>
          )}

          {compareData?.current?.review_status === "pending_review" && (
            <DialogFooter className="flex gap-2 pt-2">
              <Button
                className="bg-green-600 hover:bg-green-700 flex-1"
                onClick={() => handleDecide(selectedId!, selectedType, "approved")}
                disabled={decideMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                批准
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDecide(selectedId!, selectedType, "rejected")}
                disabled={decideMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-1" />
                拒絕
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
