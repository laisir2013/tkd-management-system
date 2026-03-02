import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Users,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const triggerSourceLabels: Record<string, string> = {
  elite_class_progress: "精英班訓練進度",
  payment_confirmed: "繳費確認",
  new_event: "新活動/考試",
  elite_low_balance: "精英班續費提醒",
  exam_result: "考試結果",
  payment_overdue: "繳費逾期催繳",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
};

const statusLabels: Record<string, string> = {
  pending: "待審核",
  approved: "已批准",
  rejected: "已拒絕",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
};

function formatDateTime(d: any) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PushQueueReviewContent() {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDetail, setShowDetail] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectIds, setRejectIds] = useState<number[]>([]);
  const [rejectReason, setRejectReason] = useState("");

  // ── Queries ──
  const {
    data: items,
    isLoading,
    refetch,
  } = trpc.pushQueue.list.useQuery(
    { status: activeTab as any },
    { refetchInterval: 30000 }
  );

  const { data: pendingCount, refetch: refetchCount } =
    trpc.pushQueue.pendingCount.useQuery(undefined, {
      refetchInterval: 30000,
    });

  const { data: detailData, isLoading: detailLoading } =
    trpc.pushQueue.detail.useQuery(
      { id: detailId! },
      { enabled: !!detailId && showDetail }
    );

  // ── Mutations ──
  const approveMutation = trpc.pushQueue.approve.useMutation({
    onSuccess: (data) => {
      toast.success(`推播已批准並發送給 ${data.sentCount} 位用戶`);
      refetch();
      refetchCount();
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(`批准失敗: ${err.message}`);
    },
  });

  const rejectMutation = trpc.pushQueue.reject.useMutation({
    onSuccess: () => {
      toast.success("推播已拒絕");
      refetch();
      refetchCount();
      setSelectedIds(new Set());
      setShowRejectDialog(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast.error(`拒絕失敗: ${err.message}`);
    },
  });

  const batchApproveMutation = trpc.pushQueue.batchApprove.useMutation({
    onSuccess: (data) => {
      toast.success(
        `已批准 ${data.approved} 筆推播，共發送給 ${data.totalSent} 位用戶`
      );
      refetch();
      refetchCount();
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(`批量批准失敗: ${err.message}`);
    },
  });

  const batchRejectMutation = trpc.pushQueue.batchReject.useMutation({
    onSuccess: (data) => {
      toast.success(`已拒絕 ${data.rejected} 筆推播`);
      refetch();
      refetchCount();
      setSelectedIds(new Set());
      setShowRejectDialog(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast.error(`批量拒絕失敗: ${err.message}`);
    },
  });

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // ── Handlers ──
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (!items) return;
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item: any) => item.id)));
    }
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id });
  };

  const handleReject = (ids: number[]) => {
    setRejectIds(ids);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (rejectIds.length === 1) {
      rejectMutation.mutate({ id: rejectIds[0], reason: rejectReason || undefined });
    } else {
      batchRejectMutation.mutate({ ids: rejectIds, reason: rejectReason || undefined });
    }
  };

  const handleBatchApprove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    batchApproveMutation.mutate({ ids });
  };

  const handleBatchReject = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    handleReject(ids);
  };

  const openDetail = (id: number) => {
    setDetailId(id);
    setShowDetail(true);
  };

  const isProcessing =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    batchApproveMutation.isPending ||
    batchRejectMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          推播審核
          {pendingCount && pendingCount.count > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingCount.count} 待審核
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              待審核
              {pendingCount && pendingCount.count > 0 && (
                <Badge variant="destructive" className="text-xs ml-1 px-1.5 py-0">
                  {pendingCount.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已批准
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              已拒絕
            </TabsTrigger>
          </TabsList>

          {/* Batch actions bar */}
          {activeTab === "pending" && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="text-sm text-indigo-700 font-medium">
                已選 {selectedIds.size} 項
              </span>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleBatchApprove}
                disabled={isProcessing}
              >
                {batchApproveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                全部批准
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBatchReject}
                disabled={isProcessing}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                全部拒絕
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                取消
              </Button>
            </div>
          )}

          {["pending", "approved", "rejected"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !items || items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>沒有{statusLabels[tab]}的推播項目</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Select all for pending tab */}
                  {tab === "pending" && items.length > 0 && (
                    <div className="flex items-center gap-2 px-1">
                      <Checkbox
                        checked={selectedIds.size === items.length && items.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-xs text-muted-foreground">全選</span>
                    </div>
                  )}

                  {items.map((item: any) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        selectedIds.has(item.id)
                          ? "border-indigo-400 bg-indigo-50/50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {tab === "pending" && (
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="mt-1"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs ${statusColors[item.status]}`}
                              >
                                {statusIcons[item.status]}
                                <span className="ml-1">{statusLabels[item.status]}</span>
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {triggerSourceLabels[item.trigger_source] ||
                                  item.trigger_source}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                #{item.id}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(item.created_at)}
                            </span>
                          </div>

                          {/* Content preview */}
                          <h4 className="font-semibold text-sm">{item.title}</h4>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {item.body}
                          </p>

                          {/* Target info */}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>
                              {item.target_type === "individual" &&
                              item.targetStudentIds ? (
                                <>
                                  對象：
                                  {(Array.isArray(item.targetStudentIds)
                                    ? item.targetStudentIds
                                    : []
                                  )
                                    .map((t: any) => t.name)
                                    .join(", ")}
                                </>
                              ) : item.target_type === "role" ? (
                                "對象：全部家長"
                              ) : item.target_type === "all" ? (
                                "對象：全部用戶"
                              ) : (
                                `對象：${item.target_type}`
                              )}
                            </span>
                            {item.student_type && (
                              <Badge variant="outline" className="text-xs px-1.5">
                                {item.student_type === "regular"
                                  ? "恆常班"
                                  : item.student_type === "elite"
                                    ? "精英班"
                                    : "全部"}
                              </Badge>
                            )}
                          </div>

                          {/* Review info */}
                          {item.status !== "pending" && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {item.reviewed_by && (
                                <span>
                                  審核人：{item.reviewed_by}　
                                </span>
                              )}
                              {item.reviewed_at && (
                                <span>
                                  審核時間：{formatDateTime(item.reviewed_at)}
                                </span>
                              )}
                              {item.status === "approved" && item.sent_count > 0 && (
                                <span className="ml-2 text-green-600">
                                  <Send className="w-3 h-3 inline" /> 已發送 {item.sent_count} 則
                                </span>
                              )}
                              {item.status === "rejected" && item.reject_reason && (
                                <div className="mt-1 text-red-600">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  拒絕原因：{item.reject_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => openDetail(item.id)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            詳情
                          </Button>
                          {tab === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="text-xs h-7 bg-green-600 hover:bg-green-700"
                                onClick={() => handleApprove(item.id)}
                                disabled={isProcessing}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                                批准
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs h-7"
                                onClick={() => handleReject([item.id])}
                                disabled={isProcessing}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                拒絕
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Detail Modal */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                推播詳情 #{detailId}
              </DialogTitle>
              <DialogDescription>推播通知預覽和詳細資訊</DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : detailData ? (
              <div className="space-y-4">
                {/* Preview Card */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">推播預覽</span>
                  </div>
                  <h3 className="font-bold text-lg">{detailData.title}</h3>
                  <p className="text-sm text-gray-700 mt-1">{detailData.body}</p>
                </div>

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">狀態：</span>
                    <Badge
                      variant="outline"
                      className={`ml-1 ${statusColors[detailData.status]}`}
                    >
                      {statusLabels[detailData.status]}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">觸發來源：</span>
                    <span className="font-medium">
                      {triggerSourceLabels[detailData.trigger_source] ||
                        detailData.trigger_source}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">建立時間：</span>
                    <span>{formatDateTime(detailData.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">學生類型：</span>
                    <span>
                      {detailData.student_type === "regular"
                        ? "恆常班"
                        : detailData.student_type === "elite"
                          ? "精英班"
                          : "全部"}
                    </span>
                  </div>
                </div>

                {/* Targets */}
                {detailData.targetStudentIds &&
                  Array.isArray(detailData.targetStudentIds) && (
                    <div>
                      <span className="text-sm text-muted-foreground">推播對象：</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {detailData.targetStudentIds.map((t: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {t.name} ({t.type === "elite" ? "精英班" : "恆常班"})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Trigger Detail */}
                {detailData.triggerDetail && (
                  <div>
                    <span className="text-sm text-muted-foreground">觸發詳情：</span>
                    <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(detailData.triggerDetail, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Review info */}
                {detailData.status !== "pending" && (
                  <div className="border-t pt-3 space-y-1 text-sm">
                    {detailData.reviewed_by && (
                      <div>
                        <span className="text-muted-foreground">審核人：</span>
                        <span>{detailData.reviewed_by}</span>
                      </div>
                    )}
                    {detailData.reviewed_at && (
                      <div>
                        <span className="text-muted-foreground">審核時間：</span>
                        <span>{formatDateTime(detailData.reviewed_at)}</span>
                      </div>
                    )}
                    {detailData.status === "approved" && (
                      <div className="text-green-600">
                        <Send className="w-3.5 h-3.5 inline mr-1" />
                        已發送 {detailData.sent_count || 0} 則
                      </div>
                    )}
                    {detailData.status === "rejected" && detailData.reject_reason && (
                      <div className="text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                        拒絕原因：{detailData.reject_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">找不到資料</p>
            )}

            <DialogFooter>
              {detailData?.status === "pending" && (
                <div className="flex gap-2 w-full">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleApprove(detailData.id);
                      setShowDetail(false);
                    }}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    批准並發送
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setShowDetail(false);
                      handleReject([detailData.id]);
                    }}
                    disabled={isProcessing}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    拒絕
                  </Button>
                </div>
              )}
              <Button variant="outline" onClick={() => setShowDetail(false)}>
                關閉
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                拒絕推播
              </DialogTitle>
              <DialogDescription>
                {rejectIds.length === 1
                  ? "確定要拒絕此推播通知嗎？"
                  : `確定要拒絕 ${rejectIds.length} 筆推播通知嗎？`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">拒絕原因（選填）</label>
                <Textarea
                  placeholder="請輸入拒絕原因..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={
                  rejectMutation.isPending || batchRejectMutation.isPending
                }
              >
                {(rejectMutation.isPending || batchRejectMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1" />
                )}
                確定拒絕
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
