import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Phone, Mail, Loader2, Trash2, Eye, ExternalLink, Copy, CheckCircle2, Clock, UserCheck, XCircle, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待處理", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  contacted: { label: "已聯繫", color: "bg-blue-100 text-blue-800 border-blue-300", icon: MessageSquare },
  enrolled: { label: "已入學", color: "bg-green-100 text-green-800 border-green-300", icon: UserCheck },
  rejected: { label: "已拒絕", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

export default function RegistrationManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [notesDialog, setNotesDialog] = useState<{ id: number; notes: string } | null>(null);

  const registrationsQuery = trpc.registration.getAll.useQuery();
  const updateStatusMutation = trpc.registration.updateStatus.useMutation({
    onSuccess: () => {
      registrationsQuery.refetch();
      toast.success("狀態已更新");
    },
  });
  const deleteMutation = trpc.registration.delete.useMutation({
    onSuccess: () => {
      registrationsQuery.refetch();
      setDeleteId(null);
      toast.success("已刪除報名記錄");
    },
  });

  const registrations = registrationsQuery.data || [];

  // Filter
  const filtered = statusFilter === "all"
    ? registrations
    : registrations.filter(r => r.status === statusFilter);

  // Count by status
  const counts = {
    all: registrations.length,
    pending: registrations.filter(r => r.status === "pending").length,
    contacted: registrations.filter(r => r.status === "contacted").length,
    enrolled: registrations.filter(r => r.status === "enrolled").length,
    rejected: registrations.filter(r => r.status === "rejected").length,
  };

  const copyLink = () => {
    const url = `${window.location.origin}/register`;
    navigator.clipboard.writeText(url);
    toast.success("報名連結已複製");
  };

  if (registrationsQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Link */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-lg">新生報名管理</h3>
              <p className="text-sm text-gray-500">共 {counts.all} 筆報名，{counts.pending} 筆待處理</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                複製報名連結
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/register', '_blank')}
                className="gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                預覽報名表
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: "全部" },
          { key: "pending", label: "待處理" },
          { key: "contacted", label: "已聯繫" },
          { key: "enrolled", label: "已入學" },
          { key: "rejected", label: "已拒絕" },
        ] as const).map(({ key, label }) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(key)}
            className="gap-1"
          >
            {label}
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts[key]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            暫無{statusFilter !== "all" ? STATUS_MAP[statusFilter]?.label : ""}報名記錄
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>學生姓名</TableHead>
                    <TableHead>家長</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>首選道場</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>報名日期</TableHead>
                    <TableHead className="w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(reg => {
                    const statusInfo = STATUS_MAP[reg.status] || STATUS_MAP.pending;
                    const isExpanded = expandedId === reg.id;
                    return (
                      <>
                        <TableRow
                          key={reg.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                        >
                          <TableCell className="text-gray-400 text-xs">{reg.id}</TableCell>
                          <TableCell className="font-medium">
                            {reg.studentName}
                            {reg.studentGender && (
                              <span className="ml-1 text-xs text-gray-400">
                                {reg.studentGender === 'male' ? '♂' : '♀'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reg.parentName}
                            {reg.relationship && <span className="text-gray-400 text-xs ml-1">({reg.relationship})</span>}
                          </TableCell>
                          <TableCell>
                            <a href={`tel:${reg.parentPhone}`} className="text-blue-600 hover:underline text-sm">
                              {reg.parentPhone}
                            </a>
                          </TableCell>
                          <TableCell className="text-sm">{reg.preferredDojo || "-"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('zh-HK') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Select
                                value={reg.status}
                                onValueChange={v => updateStatusMutation.mutate({ id: reg.id, status: v as any })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[90px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">待處理</SelectItem>
                                  <SelectItem value="contacted">已聯繫</SelectItem>
                                  <SelectItem value="enrolled">已入學</SelectItem>
                                  <SelectItem value="rejected">已拒絕</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-600"
                                onClick={() => setDeleteId(reg.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${reg.id}-detail`}>
                            <TableCell colSpan={8} className="bg-gray-50 p-4">
                              <RegistrationDetail reg={reg} onNotesEdit={() => setNotesDialog({ id: reg.id, notes: reg.adminNotes || '' })} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {filtered.map(reg => {
                const statusInfo = STATUS_MAP[reg.status] || STATUS_MAP.pending;
                const isExpanded = expandedId === reg.id;
                return (
                  <div key={reg.id} className="p-3">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                    >
                      <div>
                        <div className="font-medium">
                          {reg.studentName}
                          {reg.studentGender && (
                            <span className="ml-1 text-xs text-gray-400">
                              {reg.studentGender === 'male' ? '♂' : '♀'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {reg.parentName} · {reg.parentPhone} · {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('zh-HK') : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 border-t pt-3">
                        <RegistrationDetail reg={reg} onNotesEdit={() => setNotesDialog({ id: reg.id, notes: reg.adminNotes || '' })} />
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Select
                            value={reg.status}
                            onValueChange={v => updateStatusMutation.mutate({ id: reg.id, status: v as any })}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">待處理</SelectItem>
                              <SelectItem value="contacted">已聯繫</SelectItem>
                              <SelectItem value="enrolled">已入學</SelectItem>
                              <SelectItem value="rejected">已拒絕</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200"
                            onClick={() => setDeleteId(reg.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>確定要刪除此報名記錄嗎？此操作無法撤銷。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin notes dialog */}
      {notesDialog && (
        <AlertDialog open={true} onOpenChange={() => setNotesDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>管理員備註</AlertDialogTitle>
            </AlertDialogHeader>
            <Textarea
              value={notesDialog.notes}
              onChange={e => setNotesDialog({ ...notesDialog, notes: e.target.value })}
              placeholder="輸入備註..."
              rows={4}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  updateStatusMutation.mutate({
                    id: notesDialog.id,
                    status: registrations.find(r => r.id === notesDialog.id)?.status as any || 'pending',
                    adminNotes: notesDialog.notes,
                  });
                  setNotesDialog(null);
                }}
              >
                儲存
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Detail sub-component
function RegistrationDetail({ reg, onNotesEdit }: { reg: any; onNotesEdit: () => void }) {
  const fields = [
    { label: "出生日期", value: reg.studentBirthDate ? new Date(reg.studentBirthDate).toLocaleDateString('zh-HK') : null },
    { label: "首選道場", value: reg.preferredDojo },
    { label: "首選時段", value: reg.preferredSchedule },
    { label: "電郵", value: reg.parentEmail },
    { label: "第二電話", value: reg.parentPhone2 },
    { label: "跆拳道經驗", value: reg.previousExperience },
    { label: "身體狀況", value: reg.medicalConditions },
    { label: "得知途徑", value: reg.howDidYouHear },
    { label: "備註", value: reg.remarks },
  ].filter(f => f.value);

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {fields.map(f => (
          <div key={f.label}>
            <span className="text-gray-400 text-xs">{f.label}：</span>
            <span className="ml-1">{f.value}</span>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href={`https://wa.me/852${reg.parentPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-green-50 text-green-700 text-xs hover:bg-green-100 border border-green-200"
        >
          <MessageSquare className="w-3 h-3" />
          WhatsApp
        </a>
        <a
          href={`tel:${reg.parentPhone}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 border border-blue-200"
        >
          <Phone className="w-3 h-3" />
          致電
        </a>
        <button
          onClick={onNotesEdit}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 text-gray-700 text-xs hover:bg-gray-100 border border-gray-200"
        >
          <Eye className="w-3 h-3" />
          {reg.adminNotes ? '編輯備註' : '加備註'}
        </button>
      </div>

      {/* Admin notes display */}
      {reg.adminNotes && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 mt-1">
          <strong>管理員備註：</strong> {reg.adminNotes}
        </div>
      )}
    </div>
  );
}
