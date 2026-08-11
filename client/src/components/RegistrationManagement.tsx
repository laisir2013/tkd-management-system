import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, Loader2, Trash2, ExternalLink, Copy, Clock, UserCheck, XCircle, ChevronDown, ChevronUp, MessageSquare, CheckCircle2, Image, Calendar, CreditCard } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待處理", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  contacted: { label: "已聯繫", color: "bg-blue-100 text-blue-800 border-blue-300" },
  enrolled: { label: "已入學", color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "已拒絕", color: "bg-red-100 text-red-800 border-red-300" },
};

export default function RegistrationManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [approveDialog, setApproveDialog] = useState<any | null>(null);
  const [editDialog, setEditDialog] = useState<any | null>(null);

  const registrationsQuery = trpc.registration.getAll.useQuery();
  const updateMutation = trpc.registration.update.useMutation({
    onSuccess: () => { registrationsQuery.refetch(); toast.success("已更新"); setEditDialog(null); },
  });
  const approveMutation = trpc.registration.approve.useMutation({
    onSuccess: (data) => {
      registrationsQuery.refetch();
      toast.success(`已批准入學！學生已加入系統，覆蓋 ${data.monthsCovered.map((m: number) => m + '月').join('、')}`);
      setApproveDialog(null);
    },
    onError: (err) => toast.error(`批准失敗：${err.message}`),
  });
  const updateStatusMutation = trpc.registration.updateStatus.useMutation({
    onSuccess: () => { registrationsQuery.refetch(); toast.success("狀態已更新"); },
  });
  const deleteMutation = trpc.registration.delete.useMutation({
    onSuccess: () => { registrationsQuery.refetch(); setDeleteId(null); toast.success("已刪除"); },
  });

  const registrations = registrationsQuery.data || [];
  const filtered = statusFilter === "all" ? registrations : registrations.filter(r => r.status === statusFilter);

  const counts = {
    all: registrations.length,
    pending: registrations.filter(r => r.status === "pending").length,
    contacted: registrations.filter(r => r.status === "contacted").length,
    enrolled: registrations.filter(r => r.status === "enrolled").length,
    rejected: registrations.filter(r => r.status === "rejected").length,
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register`);
    toast.success("報名連結已複製");
  };

  if (registrationsQuery.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-lg">新生報名管理</h3>
              <p className="text-sm text-gray-500">共 {counts.all} 筆報名，{counts.pending} 筆待審核</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> 複製報名連結
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open('/register', '_blank')} className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> 預覽
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: "全部" },
          { key: "pending", label: "待審核" },
          { key: "contacted", label: "已聯繫" },
          { key: "enrolled", label: "已入學" },
          { key: "rejected", label: "已拒絕" },
        ] as const).map(({ key, label }) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(key)}
          >
            {label} <Badge variant="secondary" className="ml-1 text-xs">{counts[key]}</Badge>
          </Button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">暫無報名記錄</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(reg => {
            const statusInfo = STATUS_MAP[reg.status] || STATUS_MAP.pending;
            const isExpanded = expandedId === reg.id;
            return (
              <Card key={reg.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Summary row */}
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : reg.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{reg.studentName}</span>
                        {reg.studentGender && <span className="text-xs text-gray-400">{reg.studentGender === 'male' ? '♂' : '♀'}</span>}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3">
                        <span>{reg.parentName} ({reg.relationship || '家長'})</span>
                        <span>{reg.parentPhone}</span>
                        <span>{reg.preferredDojo || '未選道場'}</span>
                        {reg.firstClassDate && <span>首堂：{reg.firstClassDate}</span>}
                        <span>{reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('zh-HK') : ''}</span>
                      </div>
                    </div>
                    <div className="ml-2">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Detail fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {reg.studentBirthDate && <div><span className="text-gray-400">出生日期：</span>{reg.studentBirthDate}</div>}
                        {reg.parentPhone2 && <div><span className="text-gray-400">第二電話：</span>{reg.parentPhone2}</div>}
                        {reg.parentEmail && <div><span className="text-gray-400">電郵：</span>{reg.parentEmail}</div>}
                        {reg.preferredSchedule && <div><span className="text-gray-400">時段：</span>{reg.preferredSchedule}</div>}
                        {reg.tuitionAmount && <div><span className="text-gray-400">繳費金額：</span>${Number(reg.tuitionAmount).toLocaleString()}</div>}
                        {reg.receivingBank && <div><span className="text-gray-400">收款方式：</span>{reg.receivingBank}</div>}
                        {reg.previousExperience && <div><span className="text-gray-400">經驗：</span>{reg.previousExperience}</div>}
                        {reg.medicalConditions && <div><span className="text-gray-400">身體狀況：</span>{reg.medicalConditions}</div>}
                        {reg.howDidYouHear && <div><span className="text-gray-400">得知途徑：</span>{reg.howDidYouHear}</div>}
                        {reg.remarks && <div className="sm:col-span-2"><span className="text-gray-400">備註：</span>{reg.remarks}</div>}
                      </div>

                      {/* Receipt preview */}
                      {reg.receiptUrl && (
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Image className="w-3 h-3" /> 收據</span>
                          <img src={reg.receiptUrl.startsWith('/') ? reg.receiptUrl : `/api/receipts/${reg.receiptKey}`} alt="收據" className="max-h-48 rounded border object-contain" />
                        </div>
                      )}

                      {/* Admin notes */}
                      {reg.adminNotes && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                          <strong>管理員備註：</strong> {reg.adminNotes}
                        </div>
                      )}

                      {/* Enrolled info */}
                      {reg.status === 'enrolled' && reg.convertedStudentId && (
                        <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 已入學（學生 ID: {reg.convertedStudentId}）
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {/* WhatsApp */}
                        <a href={`https://wa.me/852${reg.parentPhone}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-green-50 text-green-700 text-xs hover:bg-green-100 border border-green-200">
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </a>
                        <a href={`tel:${reg.parentPhone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 border border-blue-200">
                          <Phone className="w-3 h-3" /> 致電
                        </a>

                        {/* Edit */}
                        {reg.status !== 'enrolled' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => setEditDialog({ ...reg, tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : '' })}>
                            修改資料
                          </Button>
                        )}

                        {/* Approve */}
                        {reg.status !== 'enrolled' && (
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => setApproveDialog({
                              ...reg,
                              tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : 1800,
                              feePerQuarter: 1800,
                              firstClassDate: reg.firstClassDate || '',
                              receivingBank: reg.receivingBank?.includes('BOC') ? 'BOC' : reg.receivingBank?.includes('HSBC') ? 'HSBC' : reg.receivingBank === '現金' ? 'CASH' : 'BOC',
                            })}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> 批准入學
                          </Button>
                        )}

                        {/* Status quick change */}
                        {reg.status !== 'enrolled' && (
                          <Select value={reg.status} onValueChange={v => updateStatusMutation.mutate({ id: reg.id, status: v as any })}>
                            <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">待審核</SelectItem>
                              <SelectItem value="contacted">已聯繫</SelectItem>
                              <SelectItem value="rejected">已拒絕</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {/* Delete */}
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700"
                          onClick={() => setDeleteId(reg.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ Approve Dialog ═══ */}
      {approveDialog && (
        <Dialog open={true} onOpenChange={() => setApproveDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                批准報名 — {approveDialog.studentName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-500">
                批准後系統將自動建立學生資料、繳費記錄及會計記錄。請確認以下資料：
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">學生姓名</Label>
                  <Input value={approveDialog.studentName}
                    onChange={e => setApproveDialog({ ...approveDialog, studentName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">家長電話</Label>
                  <Input value={approveDialog.parentPhone}
                    onChange={e => setApproveDialog({ ...approveDialog, parentPhone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">道場</Label>
                  <Input value={approveDialog.preferredDojo}
                    onChange={e => setApproveDialog({ ...approveDialog, preferredDojo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">時段</Label>
                  <Input value={approveDialog.preferredSchedule || ''} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">首堂日期 (入學日) <span className="text-red-500">*</span></Label>
                  <Input type="date" value={approveDialog.firstClassDate}
                    onChange={e => setApproveDialog({ ...approveDialog, firstClassDate: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">繳費金額 <span className="text-red-500">*</span></Label>
                    <Input type="number" value={approveDialog.tuitionAmount}
                      onChange={e => setApproveDialog({ ...approveDialog, tuitionAmount: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">季費標準 (用於計算月數)</Label>
                    <Input type="number" value={approveDialog.feePerQuarter}
                      onChange={e => setApproveDialog({ ...approveDialog, feePerQuarter: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">收款方式</Label>
                  <Select value={approveDialog.receivingBank} onValueChange={v => setApproveDialog({ ...approveDialog, receivingBank: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOC">中銀香港 (BOC)</SelectItem>
                      <SelectItem value="HSBC">滙豐銀行 (HSBC)</SelectItem>
                      <SelectItem value="CASH">現金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview: calculated months */}
                {approveDialog.firstClassDate && approveDialog.feePerQuarter > 0 && approveDialog.tuitionAmount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                    <strong>系統將自動計算：</strong>
                    <br />
                    月費 = ${approveDialog.feePerQuarter}/3 = ${Math.round(approveDialog.feePerQuarter / 3)}/月
                    <br />
                    覆蓋月數 = ${approveDialog.tuitionAmount} ÷ ${Math.round(approveDialog.feePerQuarter / 3)} = {Math.round(approveDialog.tuitionAmount / (approveDialog.feePerQuarter / 3))} 個月
                    <br />
                    起始月份 = {new Date(approveDialog.firstClassDate + 'T00:00:00').getMonth() + 1}月
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialog(null)}>取消</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending || !approveDialog.firstClassDate || !approveDialog.tuitionAmount}
                onClick={() => {
                  if (!approveDialog.firstClassDate) { toast.error("請填寫首堂日期"); return; }
                  if (!approveDialog.tuitionAmount) { toast.error("請填寫繳費金額"); return; }
                  if (!approveDialog.preferredDojo) { toast.error("請填寫道場"); return; }
                  approveMutation.mutate({
                    id: approveDialog.id,
                    studentName: approveDialog.studentName,
                    parentPhone: approveDialog.parentPhone,
                    preferredDojo: approveDialog.preferredDojo,
                    preferredSchedule: approveDialog.preferredSchedule || undefined,
                    firstClassDate: approveDialog.firstClassDate,
                    tuitionAmount: approveDialog.tuitionAmount,
                    feePerQuarter: approveDialog.feePerQuarter,
                    receivingBank: approveDialog.receivingBank,
                    studentGender: approveDialog.studentGender || null,
                    studentBirthDate: approveDialog.studentBirthDate || null,
                  });
                }}
              >
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                確認批准入學
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══ Edit Dialog ═══ */}
      {editDialog && (
        <Dialog open={true} onOpenChange={() => setEditDialog(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>修改報名資料</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">學生姓名</Label>
                <Input value={editDialog.studentName} onChange={e => setEditDialog({ ...editDialog, studentName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">家長姓名</Label>
                <Input value={editDialog.parentName} onChange={e => setEditDialog({ ...editDialog, parentName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">電話</Label>
                <Input value={editDialog.parentPhone} onChange={e => setEditDialog({ ...editDialog, parentPhone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">道場</Label>
                <Input value={editDialog.preferredDojo || ''} onChange={e => setEditDialog({ ...editDialog, preferredDojo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">首堂日期</Label>
                <Input type="date" value={editDialog.firstClassDate || ''} onChange={e => setEditDialog({ ...editDialog, firstClassDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">繳費金額</Label>
                <Input type="number" value={editDialog.tuitionAmount || ''} onChange={e => setEditDialog({ ...editDialog, tuitionAmount: Number(e.target.value) || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">管理員備註</Label>
                <Textarea value={editDialog.adminNotes || ''} onChange={e => setEditDialog({ ...editDialog, adminNotes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(null)}>取消</Button>
              <Button onClick={() => {
                updateMutation.mutate({
                  id: editDialog.id,
                  studentName: editDialog.studentName,
                  parentName: editDialog.parentName,
                  parentPhone: editDialog.parentPhone,
                  preferredDojo: editDialog.preferredDojo,
                  firstClassDate: editDialog.firstClassDate || null,
                  tuitionAmount: editDialog.tuitionAmount || null,
                  adminNotes: editDialog.adminNotes || null,
                });
              }} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>確定要刪除此報名記錄嗎？此操作無法撤銷。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
