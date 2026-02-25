import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Trophy, FileText, Award, Calendar } from "lucide-react";

const EVENT_TYPE_MAP = {
  exam: { label: '考試', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  competition: { label: '比賽', icon: Trophy, color: 'text-orange-600', bg: 'bg-orange-50' },
  training: { label: '交流訓練', icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
} as const;

const STATUS_MAP = {
  open: { label: '開放報名', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: '已截止', color: 'text-gray-700', bg: 'bg-gray-100' },
  cancelled: { label: '已取消', color: 'text-red-700', bg: 'bg-red-100' },
} as const;

export default function EventManagement() {
  const { data: events, refetch: refetchEvents } = trpc.events.getAll.useQuery({});
  const { data: registrations } = trpc.events.getRegistrations.useQuery({});
  
  const createMutation = trpc.events.create.useMutation();
  const updateMutation = trpc.events.update.useMutation();
  const deleteMutation = trpc.events.delete.useMutation();
  const updateRegStatus = trpc.events.updateRegistrationStatus.useMutation();

  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showRegsDialog, setShowRegsDialog] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  // Form state
  const [form, setForm] = useState({
    title: '',
    type: 'exam' as 'exam' | 'competition' | 'training',
    description: '',
    eventDate: '',
    eventTime: '',
    location: '',
    fee: '',
    maxParticipants: '',
    registrationDeadline: '',
  });

  const resetForm = () => {
    setForm({ title: '', type: 'exam', description: '', eventDate: '', eventTime: '', location: '', fee: '', maxParticipants: '', registrationDeadline: '' });
    setEditingEvent(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (event: any) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      type: event.type,
      description: event.description || '',
      eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : '',
      eventTime: event.eventTime || '',
      location: event.location || '',
      fee: event.fee || '',
      maxParticipants: event.maxParticipants?.toString() || '',
      registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline).toISOString().split('T')[0] : '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.eventDate) {
      toast.error("請填寫活動名稱和日期");
      return;
    }

    try {
      if (editingEvent) {
        await updateMutation.mutateAsync({
          id: editingEvent.id,
          title: form.title,
          type: form.type,
          description: form.description || undefined,
          eventDate: new Date(form.eventDate),
          eventTime: form.eventTime || undefined,
          location: form.location || undefined,
          fee: form.fee || undefined,
          maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
          registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline) : undefined,
        });
        toast.success("活動已更新");
      } else {
        await createMutation.mutateAsync({
          title: form.title,
          type: form.type,
          description: form.description || undefined,
          eventDate: new Date(form.eventDate),
          eventTime: form.eventTime || undefined,
          location: form.location || undefined,
          fee: form.fee || undefined,
          maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
          registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline) : undefined,
        });
        toast.success("活動已建立");
      }
      setShowDialog(false);
      resetForm();
      refetchEvents();
    } catch {
      toast.error("操作失敗");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("確定要刪除此活動？所有報名記錄也會被刪除。")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("活動已刪除");
      refetchEvents();
    } catch {
      toast.error("刪除失敗");
    }
  };

  const handleStatusChange = async (id: number, status: 'open' | 'closed' | 'cancelled') => {
    try {
      await updateMutation.mutateAsync({ id, status });
      toast.success("狀態已更新");
      refetchEvents();
    } catch {
      toast.error("更新失敗");
    }
  };

  const handleRegStatusChange = async (regId: number, status: 'registered' | 'confirmed' | 'cancelled') => {
    try {
      await updateRegStatus.mutateAsync({ id: regId, status });
      toast.success("報名狀態已更新");
    } catch {
      toast.error("更新失敗");
    }
  };

  const getRegCount = (eventId: number) => {
    return registrations?.filter(r => r.eventId === eventId && r.status !== 'cancelled').length || 0;
  };

  const filteredEvents = events?.filter(e => filterType === 'all' || e.type === filterType) || [];

  return (
    <div className="space-y-4">
      {/* 頂部操作 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="類型篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              <SelectItem value="exam">考試</SelectItem>
              <SelectItem value="competition">比賽</SelectItem>
              <SelectItem value="training">交流訓練</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 新增活動
        </Button>
      </div>

      {/* 活動列表 */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            目前沒有活動
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => {
            const typeConfig = EVENT_TYPE_MAP[event.type as keyof typeof EVENT_TYPE_MAP];
            const statusConfig = STATUS_MAP[event.status as keyof typeof STATUS_MAP];
            const regCount = getRegCount(event.id);
            const TypeIcon = typeConfig.icon;

            return (
              <Card key={event.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeConfig.bg} ${typeConfig.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig.label}
                        </span>
                        <span className="font-semibold">{event.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(event.eventDate).toLocaleDateString('zh-TW')}
                          {event.eventTime && ` ${event.eventTime}`}
                        </span>
                        {event.location && <span>📍 {event.location}</span>}
                        {event.fee && parseFloat(event.fee) > 0 && <span>💰 ${event.fee}</span>}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {regCount}人報名
                          {event.maxParticipants && ` / ${event.maxParticipants}人上限`}
                        </span>
                      </div>
                      {event.description && <p className="text-sm text-gray-600">{event.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => { setSelectedEventId(event.id); setShowRegsDialog(true); }}
                        title="查看報名"
                      >
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(event)} title="編輯">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Select
                        value={event.status}
                        onValueChange={(v) => handleStatusChange(event.id, v as any)}
                      >
                        <SelectTrigger className="h-8 w-[90px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">開放</SelectItem>
                          <SelectItem value="closed">截止</SelectItem>
                          <SelectItem value="cancelled">取消</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(event.id)} title="刪除">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 新增/編輯對話框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? '編輯活動' : '新增活動'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>活動名稱 *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例如：2026年春季升帶考試" />
            </div>
            <div>
              <Label>類型 *</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">考試</SelectItem>
                  <SelectItem value="competition">比賽</SelectItem>
                  <SelectItem value="training">交流訓練</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>活動日期 *</Label>
                <Input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} />
              </div>
              <div>
                <Label>時間</Label>
                <Input value={form.eventTime} onChange={e => setForm({ ...form, eventTime: e.target.value })} placeholder="例如：14:00-17:00" />
              </div>
            </div>
            <div>
              <Label>地點</Label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="例如：九龍灣體育館" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>費用 (HKD)</Label>
                <Input value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>名額上限</Label>
                <Input value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} placeholder="不限" />
              </div>
            </div>
            <div>
              <Label>報名截止日期</Label>
              <Input type="date" value={form.registrationDeadline} onChange={e => setForm({ ...form, registrationDeadline: e.target.value })} />
            </div>
            <div>
              <Label>說明</Label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px]"
                placeholder="活動詳情..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingEvent ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 報名記錄對話框 */}
      <Dialog open={showRegsDialog} onOpenChange={setShowRegsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>報名記錄</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {registrations?.filter(r => r.eventId === selectedEventId).length === 0 ? (
              <p className="text-center text-gray-500 py-8">尚無報名記錄</p>
            ) : (
              registrations?.filter(r => r.eventId === selectedEventId).map(reg => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{reg.studentName}</div>
                    <div className="text-xs text-gray-500">
                      {reg.phone} · {new Date(reg.registeredAt).toLocaleDateString('zh-TW')}
                      {reg.notes && ` · ${reg.notes}`}
                    </div>
                  </div>
                  <Select
                    value={reg.status}
                    onValueChange={(v) => handleRegStatusChange(reg.id, v as any)}
                  >
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">待確認</SelectItem>
                      <SelectItem value="confirmed">已確認</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
