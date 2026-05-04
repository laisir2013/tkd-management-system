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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  UserCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const triggerSourceLabels: Record<string, string> = {
  elite_class_progress: "精英班訓練進度",
  payment_confirmed: "繳費確認",
  new_event: "新活動/考試",
  elite_low_balance: "精英班續費提醒",
  exam_result: "考試結果",
  payment_overdue: "繳費逾期催繳",
  admin_manual: "管理員手動",
};

const PUSH_TEMPLATES = [
  { label: "自訂內容", title: "", body: "" },
  { label: "繳費提醒", title: "繳費提醒", body: "您好，本月學費尚未繳納，請盡快完成繳費，謝謝！" },
  { label: "課程變動", title: "課程變動通知", body: "您好，近期課程時間有所調整，詳情請查閱最新課表。" },
  { label: "活動通知", title: "活動通知", body: "您好，我們即將舉辦新活動，歡迎報名參加！" },
  { label: "考試通知", title: "考試通知", body: "您好，下一次段考即將進行，請做好準備。" },
  { label: "一般通知", title: "道場公告", body: "" },
];

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

  // Create push state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createTargetType, setCreateTargetType] = useState<"all" | "class" | "students">("all");
  const [createSendNow, setCreateSendNow] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Array<{ id: number; type: string; name: string; className: string }>>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showSelectedReview, setShowSelectedReview] = useState(false);

  // ── Queries ──
  const {
    data: items,
    isLoading,
    refetch,
  } = trpc.pushQueue.list.useQuery(
    { status: activeTab as any }
  );

  const { data: pendingCount, refetch: refetchCount } =
    trpc.pushQueue.pendingCount.useQuery();

  const { data: detailData, isLoading: detailLoading } =
    trpc.pushQueue.detail.useQuery(
      { id: detailId! },
      { enabled: !!detailId && showDetail }
    );

  const { data: classList } = trpc.pushQueue.classList.useQuery(undefined, {
    enabled: showCreateDialog,
  });

  const { data: studentListData } = trpc.pushQueue.studentListSimple.useQuery(undefined, {
    enabled: showCreateDialog,
  });

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

  const createPushMutation = trpc.pushQueue.createPush.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || '操作完成');
      refetch();
      refetchCount();
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (err) => {
      toast.error(`建立失敗: ${err.message}`);
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

  // Create push handlers
  const resetCreateForm = () => {
    setCreateTitle("");
    setCreateBody("");
    setCreateTargetType("all");
    setCreateSendNow(false);
    setSelectedClasses([]);
    setSelectedStudents([]);
    setStudentSearch("");
    setExpandedClasses(new Set());
    setShowSelectedReview(false);
  };

  const applyTemplate = (tpl: typeof PUSH_TEMPLATES[0]) => {
    setCreateTitle(tpl.title);
    setCreateBody(tpl.body);
  };

  const toggleClassSelect = (key: string) => {
    setSelectedClasses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleStudentSelect = (id: number, type: string, name: string, className: string) => {
    setSelectedStudents((prev) => {
      const exists = prev.find((s) => s.id === id && s.type === type);
      if (exists) return prev.filter((s) => !(s.id === id && s.type === type));
      return [...prev, { id, type, name, className }];
    });
  };

  const isStudentSelected = (id: number, type: string) => {
    return selectedStudents.some((s) => s.id === id && s.type === type);
  };

  const toggleClassExpand = (classKey: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classKey)) next.delete(classKey);
      else next.add(classKey);
      return next;
    });
  };

  const selectAllInClass = (classKey: string, students: any[], className: string) => {
    const allSelected = students.every((s: any) => isStudentSelected(s.id, s.studentType));
    if (allSelected) {
      // deselect all in this class
      setSelectedStudents((prev) =>
        prev.filter((sel) => !students.some((s: any) => s.id === sel.id && s.studentType === sel.type))
      );
    } else {
      // select all in this class
      setSelectedStudents((prev) => {
        const next = [...prev];
        for (const s of students) {
          if (!next.some((sel) => sel.id === s.id && sel.type === s.studentType)) {
            next.push({ id: s.id, type: s.studentType, name: s.name, className });
          }
        }
        return next;
      });
    }
  };

  const removeStudent = (id: number, type: string) => {
    setSelectedStudents((prev) => prev.filter((s) => !(s.id === id && s.type === type)));
  };

  const clearAllStudents = () => {
    setSelectedStudents([]);
  };

  // Filter class groups by search query
  const getFilteredGroups = () => {
    if (!studentListData || !Array.isArray(studentListData)) return [];
    const groups = studentListData as any[];
    if (!studentSearch.trim()) return groups;
    const q = studentSearch.toLowerCase();
    return groups
      .map((g: any) => ({
        ...g,
        students: g.students.filter(
          (s: any) =>
            s.name?.toLowerCase().includes(q) ||
            s.phone?.includes(q) ||
            g.className?.toLowerCase().includes(q)
        ),
      }))
      .filter((g: any) => g.students.length > 0);
  };

  const handleCreatePush = () => {
    if (!createTitle.trim() || !createBody.trim()) {
      toast.error('請填寫標題和內容');
      return;
    }
    if (createTargetType === 'class' && selectedClasses.length === 0) {
      toast.error('請至少選擇一個班級');
      return;
    }
    if (createTargetType === 'students' && selectedStudents.length === 0) {
      toast.error('請至少選擇一位學生');
      return;
    }
    let targetValue: any = null;
    if (createTargetType === 'class') targetValue = selectedClasses;
    if (createTargetType === 'students') targetValue = selectedStudents.map((s) => ({ id: s.id, type: s.type }));

    createPushMutation.mutate({
      title: createTitle.trim(),
      body: createBody.trim(),
      targetType: createTargetType,
      targetValue,
      sendNow: createSendNow,
    });
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            推播審核
            {pendingCount && pendingCount.count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount.count} 待審核
              </Badge>
            )}
          </CardTitle>
          <Button
            onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新增推播
          </Button>
        </div>
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
        {/* Create Push Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                新增推播
              </DialogTitle>
              <DialogDescription>手動建立推播通知，可選擇立即發送或排入審核隊列</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Template picker */}
              <div>
                <Label className="text-sm">快速範本</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {PUSH_TEMPLATES.map((tpl, i) => (
                    <Button
                      key={i}
                      variant={createTitle === tpl.title && createBody === tpl.body && i > 0 ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => applyTemplate(tpl)}
                    >
                      {tpl.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label className="text-sm">推播標題 *</Label>
                <Input
                  className="mt-1"
                  placeholder="輸入推播標題"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                />
              </div>

              {/* Body */}
              <div>
                <Label className="text-sm">推播內容 *</Label>
                <Textarea
                  className="mt-1"
                  placeholder="輸入推播內容"
                  value={createBody}
                  onChange={(e) => setCreateBody(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Target type */}
              <div>
                <Label className="text-sm">推播對象</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {(['all', 'class', 'students'] as const).map((t) => (
                    <Button
                      key={t}
                      variant={createTargetType === t ? "default" : "outline"}
                      size="sm"
                      className={createTargetType === t ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                      onClick={() => setCreateTargetType(t)}
                    >
                      {t === 'all' ? '🌐 全體' : t === 'class' ? '📚 班級' : '👤 學生'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Class selection — 恆常班 + 精英班 */}
              {createTargetType === 'class' && (
                <div>
                  <Label className="text-sm">選擇班級</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-52 overflow-y-auto">
                    {(classList as any[] || []).map((c: any) => {
                      const key = c.classKey;
                      const selected = selectedClasses.includes(key);
                      const isElite = c.type === 'elite';
                      return (
                        <Button
                          key={key}
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          className={`text-xs h-auto py-1.5 px-2.5 gap-1.5 ${
                            selected
                              ? isElite
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                              : ''
                          }`}
                          onClick={() => toggleClassSelect(key)}
                        >
                          {isElite && <span className="text-[10px]">⭐</span>}
                          {c.className} ({c.studentCount}人)
                        </Button>
                      );
                    })}
                  </div>
                  {selectedClasses.length > 0 && (
                    <p className="text-xs text-indigo-600 mt-1">已選 {selectedClasses.length} 個班級</p>
                  )}
                </div>
              )}

              {/* Student selection — collapsible class groups */}
              {createTargetType === 'students' && (
                <div className="space-y-2">
                  <Label className="text-sm">選擇學生</Label>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="搜尋學生姓名 / 電話 / 道場..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>

                  {/* Selected students summary bar */}
                  {selectedStudents.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <UserCheck className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="text-sm font-medium text-red-700 flex-1">
                        已選 {selectedStudents.length} 位學生
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 text-red-600 hover:text-red-800 hover:bg-red-100"
                        onClick={() => setShowSelectedReview(!showSelectedReview)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {showSelectedReview ? '收起' : '檢視'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 text-red-600 hover:text-red-800 hover:bg-red-100"
                        onClick={clearAllStudents}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        清除全部
                      </Button>
                    </div>
                  )}

                  {/* Selected students review panel — grouped by class */}
                  {showSelectedReview && selectedStudents.length > 0 && (
                    <div className="border border-red-200 rounded-lg p-2.5 bg-red-50/50 max-h-40 overflow-y-auto">
                      {Object.entries(
                        selectedStudents.reduce<Record<string, typeof selectedStudents>>((acc, s) => {
                          const key = s.className || '未分類';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(s);
                          return acc;
                        }, {})
                      ).map(([cls, studs]) => (
                        <div key={cls} className="mb-2 last:mb-0">
                          <div className="text-xs font-semibold text-red-600 mb-1">
                            {cls}（{studs.length}）
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {studs.map((s) => (
                              <Badge
                                key={`${s.type}-${s.id}`}
                                variant="secondary"
                                className="text-xs pl-2 pr-1 py-0.5 gap-1 bg-white border border-red-200"
                              >
                                {s.name}
                                {s.type === 'elite' && (
                                  <span className="text-purple-600 text-[10px]">(精英)</span>
                                )}
                                <button
                                  className="ml-0.5 text-red-400 hover:text-red-600 rounded-full"
                                  onClick={() => removeStudent(s.id, s.type)}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Collapsible class groups */}
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {(() => {
                      const filteredGroups = getFilteredGroups();
                      if (filteredGroups.length === 0) {
                        return (
                          <div className="text-center text-muted-foreground text-xs py-6">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            找不到符合的學生
                          </div>
                        );
                      }
                      return filteredGroups.map((group: any) => {
                        const isExpanded = expandedClasses.has(group.classKey);
                        const allInClassSelected =
                          group.students.length > 0 &&
                          group.students.every((s: any) => isStudentSelected(s.id, s.studentType));
                        const someInClassSelected =
                          !allInClassSelected &&
                          group.students.some((s: any) => isStudentSelected(s.id, s.studentType));
                        const selectedInClass = group.students.filter((s: any) =>
                          isStudentSelected(s.id, s.studentType)
                        ).length;

                        return (
                          <div key={group.classKey} className="border-b last:border-b-0">
                            {/* Class header row */}
                            <div
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                                allInClassSelected
                                  ? 'bg-indigo-50'
                                  : someInClassSelected
                                    ? 'bg-indigo-50/40'
                                    : ''
                              }`}
                              onClick={() => toggleClassExpand(group.classKey)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">{group.className}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({group.studentCount} 人{selectedInClass > 0 ? `，已選 ${selectedInClass}` : ''})
                                </span>
                              </div>
                              <Button
                                variant={allInClassSelected ? 'default' : 'outline'}
                                size="sm"
                                className={`text-xs h-6 px-2 shrink-0 ${
                                  allInClassSelected ? 'bg-indigo-600 hover:bg-indigo-700' : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllInClass(group.classKey, group.students, group.className);
                                }}
                              >
                                {allInClassSelected ? '取消全選' : '全選'}
                              </Button>
                            </div>

                            {/* Expanded student list */}
                            {isExpanded && (
                              <div className="bg-gray-50/50">
                                {group.students.map((s: any) => {
                                  const checked = isStudentSelected(s.id, s.studentType);
                                  return (
                                    <div
                                      key={`${s.studentType}-${s.id}`}
                                      className={`flex items-center gap-2 px-3 pl-9 py-1.5 cursor-pointer hover:bg-gray-100 transition-colors border-t border-gray-100 ${
                                        checked ? 'bg-indigo-50/70' : ''
                                      }`}
                                      onClick={() =>
                                        toggleStudentSelect(s.id, s.studentType, s.name, group.className)
                                      }
                                    >
                                      <Checkbox checked={checked} className="shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm truncate">
                                          {s.name}
                                          {s.studentType === 'elite' && (
                                            <Badge
                                              variant="secondary"
                                              className="ml-1 text-[10px] px-1 py-0 bg-purple-100 text-purple-700"
                                            >
                                              精英
                                            </Badge>
                                          )}
                                        </span>
                                      </div>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {s.phone}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Send mode */}
              <div>
                <Label className="text-sm">發送模式</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <Button
                    variant={!createSendNow ? "default" : "outline"}
                    size="sm"
                    className={!createSendNow ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                    onClick={() => setCreateSendNow(false)}
                  >
                    📋 排入隊列
                  </Button>
                  <Button
                    variant={createSendNow ? "default" : "outline"}
                    size="sm"
                    className={createSendNow ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setCreateSendNow(true)}
                  >
                    🚀 立即發送
                  </Button>
                </div>
                {createSendNow && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>立即發送模式會直接推播給用戶，無需審核</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={handleCreatePush}
                disabled={createPushMutation.isPending}
              >
                {createPushMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                {createSendNow ? '立即發送' : '提交至審核隊列'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
