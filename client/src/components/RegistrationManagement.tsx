import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// Switch removed — not used
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Phone, Loader2, Trash2, ExternalLink, Copy,
  MessageSquare, CheckCircle2, Image, CreditCard, User,
  MapPin, Settings, GripVertical, Eye, EyeOff, Pencil, FileText,
  ArrowLeft, ClipboardList
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待處理", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  contacted: { label: "已聯繫", color: "bg-blue-100 text-blue-800 border-blue-300" },
  enrolled: { label: "已入學", color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "已拒絕", color: "bg-red-100 text-red-800 border-red-300" },
};

// ═══ Form field configuration (for settings page) ═══
type FormField = {
  key: string;
  label: string;
  section: string;
  visible: boolean;
  required: boolean;
  order: number;
};

const DEFAULT_FORM_FIELDS: FormField[] = [
  // 學生資料
  { key: "studentName", label: "中文姓名", section: "學生資料", visible: true, required: true, order: 0 },
  { key: "englishName", label: "英文姓名", section: "學生資料", visible: true, required: true, order: 1 },
  { key: "studentGender", label: "性別", section: "學生資料", visible: true, required: true, order: 2 },
  { key: "studentBirthDate", label: "出生日期", section: "學生資料", visible: true, required: true, order: 3 },
  { key: "beltLevel", label: "色帶", section: "學生資料", visible: true, required: true, order: 4 },
  { key: "dobokSize", label: "跆拳道袍尺寸", section: "學生資料", visible: true, required: true, order: 5 },
  // 上課安排
  { key: "preferredDojo", label: "上課地點", section: "上課安排", visible: true, required: true, order: 6 },
  { key: "classSchedule", label: "上課時間", section: "上課安排", visible: true, required: true, order: 7 },
  { key: "firstClassDate", label: "首堂日期", section: "上課安排", visible: true, required: true, order: 8 },
  // 聯絡資料
  { key: "parentName", label: "家長姓名", section: "聯絡資料", visible: true, required: true, order: 9 },
  { key: "parentPhone", label: "聯絡電話", section: "聯絡資料", visible: true, required: true, order: 10 },
  { key: "parentPhone2", label: "第二聯絡電話", section: "聯絡資料", visible: true, required: false, order: 11 },
  { key: "parentEmail", label: "Email", section: "聯絡資料", visible: true, required: true, order: 12 },
  { key: "facebook", label: "Facebook", section: "聯絡資料", visible: true, required: true, order: 13 },
  { key: "referrer", label: "介紹人", section: "聯絡資料", visible: true, required: false, order: 14 },
  { key: "address", label: "住址", section: "聯絡資料", visible: true, required: true, order: 15 },
  // 繳費
  { key: "tuitionAmount", label: "繳費金額", section: "繳費資料", visible: true, required: false, order: 16 },
  { key: "receivingBank", label: "轉帳銀行", section: "繳費資料", visible: true, required: true, order: 17 },
  { key: "receiptUrl", label: "繳費收據", section: "繳費資料", visible: true, required: true, order: 18 },
  // 其他
  { key: "howDidYouHear", label: "從何得知", section: "其他資料", visible: true, required: true, order: 19 },
  { key: "medicalConditions", label: "身體狀況", section: "其他資料", visible: true, required: false, order: 20 },
  { key: "remarks", label: "備註", section: "其他資料", visible: true, required: false, order: 21 },
];

// ═══ Sub-page types ═══
type PageView = "list" | "record" | "settings";

export default function RegistrationManagement() {
  const [pageView, setPageView] = useState<PageView>("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [approveDialog, setApproveDialog] = useState<any | null>(null);
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  // Form settings state
  const [formFields, setFormFields] = useState<FormField[]>(() => {
    try {
      const saved = localStorage.getItem("reg_form_fields");
      return saved ? JSON.parse(saved) : DEFAULT_FORM_FIELDS;
    } catch { return DEFAULT_FORM_FIELDS; }
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

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
  const filtered = (statusFilter === "all" ? registrations : registrations.filter(r => r.status === statusFilter))
    .filter(r => {
      if (!searchText.trim()) return true;
      const q = searchText.trim().toLowerCase();
      return (
        r.studentName?.toLowerCase().includes(q) ||
        r.englishName?.toLowerCase().includes(q) ||
        r.parentName?.toLowerCase().includes(q) ||
        r.parentPhone?.includes(q) ||
        r.preferredDojo?.toLowerCase().includes(q) ||
        r.parentEmail?.toLowerCase().includes(q)
      );
    });

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

  // Helper to get field value from registration
  const getFieldValue = (reg: any, key: string): string => {
    switch (key) {
      case "studentGender": return reg.studentGender === "male" ? "男" : reg.studentGender === "female" ? "女" : "";
      case "studentBirthDate": return reg.studentBirthDate ? String(reg.studentBirthDate) : "";
      case "firstClassDate": return reg.firstClassDate ? String(reg.firstClassDate) : "";
      case "tuitionAmount": return reg.tuitionAmount ? `$${Number(reg.tuitionAmount).toLocaleString()}` : "";
      case "receiptUrl": return reg.receiptUrl ? "已上傳" : "未上傳";
      default: return reg[key] || "";
    }
  };

  if (registrationsQuery.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  // ═══════════════════════════════════════════
  // PAGE: 報名紀錄詳情
  // ═══════════════════════════════════════════
  if (pageView === "record" && selectedRecord) {
    const reg = selectedRecord;
    const statusInfo = STATUS_MAP[reg.status] || STATUS_MAP.pending;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setPageView("list"); setSelectedRecord(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
          </Button>
          <h3 className="font-bold text-lg">{reg.studentName} 的報名紀錄</h3>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        {/* Full form display - mirrors the public register page layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 學生資料 */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <h4 className="font-bold text-sm text-blue-700 flex items-center gap-2 mb-4"><User className="w-4 h-4" /> 學生資料</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">中文姓名</span><span className="font-medium">{reg.studentName}</span></div>
                <div><span className="text-gray-400 text-xs block">英文姓名</span><span className="font-medium">{reg.englishName || "—"}</span></div>
                <div><span className="text-gray-400 text-xs block">性別</span><span className="font-medium">{reg.studentGender === 'male' ? '男' : reg.studentGender === 'female' ? '女' : '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">出生日期</span><span className="font-medium">{reg.studentBirthDate ? String(reg.studentBirthDate) : '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">色帶</span><span className="font-medium">{reg.beltLevel || '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">道袍尺寸</span><span className="font-medium">{reg.dobokSize || '—'}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 上課安排 */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <h4 className="font-bold text-sm text-emerald-700 flex items-center gap-2 mb-4"><MapPin className="w-4 h-4" /> 上課安排</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">道場</span><span className="font-medium">{reg.preferredDojo || '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">時段</span><span className="font-medium">{reg.classSchedule || reg.preferredSchedule || '—'}</span></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs block">首堂日期</span><span className="font-medium">{reg.firstClassDate ? String(reg.firstClassDate) : '—'}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 聯絡資料 */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <h4 className="font-bold text-sm text-violet-700 flex items-center gap-2 mb-4"><Phone className="w-4 h-4" /> 聯絡資料</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">家長姓名</span><span className="font-medium">{reg.parentName}</span></div>
                <div><span className="text-gray-400 text-xs block">電話</span><span className="font-medium">{reg.parentPhone}</span></div>
                {reg.parentPhone2 && <div><span className="text-gray-400 text-xs block">第二電話</span><span className="font-medium">{reg.parentPhone2}</span></div>}
                <div><span className="text-gray-400 text-xs block">Email</span><span className="font-medium">{reg.parentEmail || '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">Facebook</span><span className="font-medium">{reg.facebook || '—'}</span></div>
                {reg.referrer && <div><span className="text-gray-400 text-xs block">介紹人</span><span className="font-medium">{reg.referrer}</span></div>}
                <div className="col-span-2"><span className="text-gray-400 text-xs block">住址</span><span className="font-medium">{reg.address || '—'}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 繳費資料 */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <h4 className="font-bold text-sm text-amber-700 flex items-center gap-2 mb-4"><CreditCard className="w-4 h-4" /> 繳費資料</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">金額</span><span className="font-medium">{reg.tuitionAmount ? `$${Number(reg.tuitionAmount).toLocaleString()}` : '—'}</span></div>
                <div><span className="text-gray-400 text-xs block">收款方式</span><span className="font-medium">{reg.receivingBank || '—'}</span></div>
              </div>
              {reg.receiptUrl && (
                <div className="mt-3">
                  <span className="text-gray-400 text-xs flex items-center gap-1 mb-1"><Image className="w-3 h-3" /> 收據</span>
                  <img src={reg.receiptUrl.startsWith('/') ? reg.receiptUrl : `/api/receipts/${reg.receiptKey}`} alt="收據" className="max-h-60 rounded-lg border object-contain" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 其他 */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-5 pb-4">
              <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2 mb-4"><FileText className="w-4 h-4" /> 其他資料</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">得知途徑</span><span className="font-medium">{reg.howDidYouHear || '—'}</span></div>
                {reg.medicalConditions && <div className="col-span-2"><span className="text-gray-400 text-xs block">身體狀況</span><span className="font-medium">{reg.medicalConditions}</span></div>}
                {reg.remarks && <div className="col-span-2"><span className="text-gray-400 text-xs block">備註</span><span className="font-medium">{reg.remarks}</span></div>}
                {reg.adminNotes && <div className="col-span-2"><span className="text-gray-400 text-xs block">管理員備註</span><span className="font-medium text-amber-700">{reg.adminNotes}</span></div>}
                <div><span className="text-gray-400 text-xs block">報名時間</span><span className="font-medium">{reg.createdAt ? new Date(reg.createdAt).toLocaleString('zh-HK') : '—'}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions bar */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/852${reg.parentPhone}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <a href={`tel:${reg.parentPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors">
                <Phone className="w-3.5 h-3.5" /> 致電
              </a>
              {reg.status !== 'enrolled' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditDialog({ ...reg, tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : '' })}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> 修改資料
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => setApproveDialog({
                      ...reg,
                      tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : 1800,
                      feePerQuarter: 1800,
                      firstClassDate: reg.firstClassDate || '',
                      receivingBank: reg.receivingBank?.includes('BOC') ? 'BOC' : reg.receivingBank?.includes('HSBC') ? 'HSBC' : reg.receivingBank?.includes('FPS') ? 'FPS' : reg.receivingBank === '現金' ? 'CASH' : 'BOC',
                    })}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 批准入學
                  </Button>
                  <Select value={reg.status} onValueChange={v => updateStatusMutation.mutate({ id: reg.id, status: v as any })}>
                    <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">待審核</SelectItem>
                      <SelectItem value="contacted">已聯繫</SelectItem>
                      <SelectItem value="rejected">已拒絕</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              {reg.status === 'enrolled' && reg.convertedStudentId && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 已入學（學生 ID: {reg.convertedStudentId}）
                </span>
              )}
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 ml-auto" onClick={() => setDeleteId(reg.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 刪除
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // PAGE: 報名表設定 (拖拽排版)
  // ═══════════════════════════════════════════
  if (pageView === "settings") {
    const sections = [...new Set(formFields.map(f => f.section))];
    const sortedFields = [...formFields].sort((a, b) => a.order - b.order);

    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) return;
      const updated = [...sortedFields];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(idx, 0, moved);
      updated.forEach((f, i) => f.order = i);
      setFormFields(updated);
      setDragIdx(idx);
    };
    const handleDragEnd = () => setDragIdx(null);

    const toggleVisible = (key: string) => {
      setFormFields(prev => prev.map(f => f.key === key ? { ...f, visible: !f.visible } : f));
    };
    const toggleRequired = (key: string) => {
      setFormFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f));
    };
    const updateLabel = (key: string, label: string) => {
      setFormFields(prev => prev.map(f => f.key === key ? { ...f, label } : f));
    };
    const updateSection = (key: string, section: string) => {
      setFormFields(prev => prev.map(f => f.key === key ? { ...f, section } : f));
    };
    const saveSettings = () => {
      localStorage.setItem("reg_form_fields", JSON.stringify(formFields));
      toast.success("報名表設定已儲存");
    };
    const resetSettings = () => {
      setFormFields(DEFAULT_FORM_FIELDS);
      localStorage.removeItem("reg_form_fields");
      toast.success("已重置為預設");
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setPageView("list")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回
            </Button>
            <h3 className="font-bold text-lg">報名表設定</h3>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetSettings}>重置預設</Button>
            <Button size="sm" onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700">儲存設定</Button>
          </div>
        </div>

        <p className="text-sm text-gray-500">拖拽欄位調整順序，開關控制顯示/隱藏和必填。修改會影響報名表的顯示排版。</p>

        <Card>
          <CardContent className="pt-4 pb-2">
            <div className="space-y-1">
              {sortedFields.map((field, idx) => (
                <div
                  key={field.key}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                    dragIdx === idx ? 'bg-blue-50 border-blue-300 shadow-md scale-[1.02]' : 'border-slate-200 hover:bg-slate-50'
                  } ${!field.visible ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="text-xs text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>

                  {/* Editable label */}
                  <input
                    value={field.label}
                    onChange={e => updateLabel(field.key, e.target.value)}
                    className="flex-1 text-sm font-medium bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1 -mx-1 min-w-0"
                  />

                  {/* Section tag */}
                  <select
                    value={field.section}
                    onChange={e => updateSection(field.key, e.target.value)}
                    className="text-[10px] bg-slate-100 border-none rounded px-2 py-1 text-slate-500 shrink-0"
                  >
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* Required toggle */}
                  <button
                    onClick={() => toggleRequired(field.key)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${field.required ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                  >
                    {field.required ? "必填" : "選填"}
                  </button>

                  {/* Visible toggle */}
                  <button onClick={() => toggleVisible(field.key)} className="shrink-0">
                    {field.visible ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-300" />}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview section */}
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Eye className="w-4 h-4" /> 排版預覽</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {sortedFields.filter(f => f.visible).map(field => (
                <div key={field.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-dashed border-slate-200">
                  <span className="text-gray-500">{field.label}</span>
                  {field.required && <span className="text-red-400 text-xs">*</span>}
                  <span className="ml-auto text-[10px] text-gray-300">{field.section}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // PAGE: 報名列表 (main view - full card display)
  // ═══════════════════════════════════════════
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
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> 複製連結
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open('/register', '_blank')} className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> 預覽表單
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPageView("settings")} className="gap-1.5">
                <Settings className="w-3.5 h-3.5" /> 表單設定
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
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
        <Input
          placeholder="搜尋姓名/電話/道場..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full sm:w-48 h-8 text-sm"
        />
      </div>

      {/* Registration cards - full display */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">暫無報名記錄</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(reg => {
            const statusInfo = STATUS_MAP[reg.status] || STATUS_MAP.pending;
            return (
              <Card key={reg.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: reg.status === 'pending' ? '#eab308' : reg.status === 'enrolled' ? '#22c55e' : reg.status === 'contacted' ? '#3b82f6' : '#ef4444' }}>
                <CardContent className="p-4 sm:p-5">
                  {/* Header: name + status + time */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold text-base">{reg.studentName}</span>
                      {reg.englishName && <span className="text-xs text-gray-400">({reg.englishName})</span>}
                      {reg.studentGender && <span className="text-xs">{reg.studentGender === 'male' ? '♂' : '♀'}</span>}
                      {reg.beltLevel && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 font-medium">{reg.beltLevel}</span>}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('zh-HK') : ''}</span>
                  </div>

                  {/* Full details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                    {reg.studentBirthDate && (
                      <div><span className="text-gray-400 text-xs">出生日期</span><div className="font-medium">{String(reg.studentBirthDate)}</div></div>
                    )}
                    {reg.dobokSize && (
                      <div><span className="text-gray-400 text-xs">道袍</span><div className="font-medium">{reg.dobokSize}</div></div>
                    )}
                    <div><span className="text-gray-400 text-xs">道場</span><div className="font-medium">{reg.preferredDojo || '—'}</div></div>
                    <div><span className="text-gray-400 text-xs">時段</span><div className="font-medium">{reg.classSchedule || reg.preferredSchedule || '—'}</div></div>
                    {reg.firstClassDate && (
                      <div><span className="text-gray-400 text-xs">首堂日期</span><div className="font-medium">{String(reg.firstClassDate)}</div></div>
                    )}
                    <div><span className="text-gray-400 text-xs">家長</span><div className="font-medium">{reg.parentName}</div></div>
                    <div><span className="text-gray-400 text-xs">電話</span><div className="font-medium">{reg.parentPhone}</div></div>
                    {reg.parentPhone2 && (
                      <div><span className="text-gray-400 text-xs">第二電話</span><div className="font-medium">{reg.parentPhone2}</div></div>
                    )}
                    {reg.parentEmail && (
                      <div><span className="text-gray-400 text-xs">Email</span><div className="font-medium truncate" title={reg.parentEmail}>{reg.parentEmail}</div></div>
                    )}
                    {reg.facebook && (
                      <div><span className="text-gray-400 text-xs">Facebook</span><div className="font-medium truncate" title={reg.facebook}>{reg.facebook}</div></div>
                    )}
                    {reg.address && (
                      <div className="col-span-2"><span className="text-gray-400 text-xs">住址</span><div className="font-medium">{reg.address}</div></div>
                    )}
                    {reg.referrer && (
                      <div><span className="text-gray-400 text-xs">介紹人</span><div className="font-medium">{reg.referrer}</div></div>
                    )}
                    {reg.tuitionAmount && (
                      <div><span className="text-gray-400 text-xs">繳費</span><div className="font-medium">${Number(reg.tuitionAmount).toLocaleString()}</div></div>
                    )}
                    {reg.receivingBank && (
                      <div><span className="text-gray-400 text-xs">收款方式</span><div className="font-medium">{reg.receivingBank}</div></div>
                    )}
                    {reg.howDidYouHear && (
                      <div><span className="text-gray-400 text-xs">得知途徑</span><div className="font-medium">{reg.howDidYouHear}</div></div>
                    )}
                    {reg.medicalConditions && (
                      <div className="col-span-2"><span className="text-gray-400 text-xs">身體狀況</span><div className="font-medium">{reg.medicalConditions}</div></div>
                    )}
                    {reg.remarks && (
                      <div className="col-span-2"><span className="text-gray-400 text-xs">備註</span><div className="font-medium">{reg.remarks}</div></div>
                    )}
                  </div>

                  {/* Receipt thumbnail */}
                  {reg.receiptUrl && (
                    <div className="mt-3">
                      <span className="text-gray-400 text-xs flex items-center gap-1 mb-1"><Image className="w-3 h-3" /> 收據</span>
                      <img src={reg.receiptUrl.startsWith('/') ? reg.receiptUrl : `/api/receipts/${reg.receiptKey}`} alt="收據" className="max-h-32 rounded-lg border object-contain" />
                    </div>
                  )}

                  {/* Admin notes */}
                  {reg.adminNotes && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                      <strong>管理員備註：</strong> {reg.adminNotes}
                    </div>
                  )}

                  {/* Enrolled badge */}
                  {reg.status === 'enrolled' && reg.convertedStudentId && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 已入學（學生 ID: {reg.convertedStudentId}）
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-100">
                    <a href={`https://wa.me/852${reg.parentPhone}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs hover:bg-green-100 border border-green-200 font-medium">
                      <MessageSquare className="w-3 h-3" /> WhatsApp
                    </a>
                    <a href={`tel:${reg.parentPhone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 border border-blue-200 font-medium">
                      <Phone className="w-3 h-3" /> 致電
                    </a>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSelectedRecord(reg); setPageView("record"); }}>
                      <ClipboardList className="w-3 h-3 mr-1" /> 報名紀錄
                    </Button>

                    {reg.status !== 'enrolled' && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => setEditDialog({ ...reg, tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : '' })}>
                          <Pencil className="w-3 h-3 mr-1" /> 修改
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => setApproveDialog({
                            ...reg,
                            tuitionAmount: reg.tuitionAmount ? Number(reg.tuitionAmount) : 1800,
                            feePerQuarter: 1800,
                            firstClassDate: reg.firstClassDate || '',
                            receivingBank: reg.receivingBank?.includes('BOC') ? 'BOC' : reg.receivingBank?.includes('HSBC') ? 'HSBC' : reg.receivingBank?.includes('FPS') ? 'FPS' : reg.receivingBank === '現金' ? 'CASH' : 'BOC',
                          })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> 批准入學
                        </Button>
                        <Select value={reg.status} onValueChange={v => updateStatusMutation.mutate({ id: reg.id, status: v as any })}>
                          <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">待審核</SelectItem>
                            <SelectItem value="contacted">已聯繫</SelectItem>
                            <SelectItem value="rejected">已拒絕</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700 ml-auto"
                      onClick={() => setDeleteId(reg.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
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
                  <Input value={approveDialog.studentName} onChange={e => setApproveDialog({ ...approveDialog, studentName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">家長電話</Label>
                  <Input value={approveDialog.parentPhone} onChange={e => setApproveDialog({ ...approveDialog, parentPhone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">道場</Label>
                  <Input value={approveDialog.preferredDojo} onChange={e => setApproveDialog({ ...approveDialog, preferredDojo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">時段</Label>
                  <Input value={approveDialog.preferredSchedule || ''} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">首堂日期 (入學日) <span className="text-red-500">*</span></Label>
                  <Input type="date" value={approveDialog.firstClassDate} onChange={e => setApproveDialog({ ...approveDialog, firstClassDate: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">繳費金額 <span className="text-red-500">*</span></Label>
                    <Input type="number" value={approveDialog.tuitionAmount} onChange={e => setApproveDialog({ ...approveDialog, tuitionAmount: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">季費標準</Label>
                    <Input type="number" value={approveDialog.feePerQuarter} onChange={e => setApproveDialog({ ...approveDialog, feePerQuarter: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">收款方式</Label>
                  <Select value={approveDialog.receivingBank} onValueChange={v => setApproveDialog({ ...approveDialog, receivingBank: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOC">中銀香港 (BOC)</SelectItem>
                      <SelectItem value="HSBC">滙豐銀行 (HSBC)</SelectItem>
                      <SelectItem value="FPS">轉數快 (FPS)</SelectItem>
                      <SelectItem value="CASH">現金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {approveDialog.beltLevel && (
                  <div className="space-y-1">
                    <Label className="text-xs">色帶</Label>
                    <Input value={approveDialog.beltLevel} readOnly className="bg-gray-50" />
                  </div>
                )}
                {approveDialog.firstClassDate && approveDialog.feePerQuarter > 0 && approveDialog.tuitionAmount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <strong>系統將自動計算：</strong><br />
                    月費 = ${approveDialog.feePerQuarter}/3 = ${Math.round(approveDialog.feePerQuarter / 3)}/月<br />
                    純學費 = ${approveDialog.tuitionAmount} − $550(裝備) = ${Math.max(approveDialog.tuitionAmount - 550, Math.round(approveDialog.feePerQuarter / 3))}<br />
                    覆蓋月數 = {Math.round(Math.max(approveDialog.tuitionAmount - 550, approveDialog.feePerQuarter / 3) / (approveDialog.feePerQuarter / 3))} 個月<br />
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
                    classSchedule: approveDialog.classSchedule || undefined,
                    firstClassDate: approveDialog.firstClassDate,
                    tuitionAmount: approveDialog.tuitionAmount,
                    feePerQuarter: approveDialog.feePerQuarter,
                    receivingBank: approveDialog.receivingBank,
                    studentGender: approveDialog.studentGender || null,
                    studentBirthDate: approveDialog.studentBirthDate || null,
                    beltLevel: approveDialog.beltLevel || null,
                    englishName: approveDialog.englishName || null,
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
              <div className="space-y-1"><Label className="text-xs">學生姓名(中文)</Label><Input value={editDialog.studentName} onChange={e => setEditDialog({ ...editDialog, studentName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">學生姓名(英文)</Label><Input value={editDialog.englishName || ''} onChange={e => setEditDialog({ ...editDialog, englishName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">色帶</Label><Input value={editDialog.beltLevel || ''} onChange={e => setEditDialog({ ...editDialog, beltLevel: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">家長姓名</Label><Input value={editDialog.parentName} onChange={e => setEditDialog({ ...editDialog, parentName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">電話</Label><Input value={editDialog.parentPhone} onChange={e => setEditDialog({ ...editDialog, parentPhone: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">道場</Label><Input value={editDialog.preferredDojo || ''} onChange={e => setEditDialog({ ...editDialog, preferredDojo: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">上課日期及時間</Label><Input value={editDialog.classSchedule || ''} onChange={e => setEditDialog({ ...editDialog, classSchedule: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">入學日期</Label><Input type="date" value={editDialog.firstClassDate || ''} onChange={e => setEditDialog({ ...editDialog, firstClassDate: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">繳費金額</Label><Input type="number" value={editDialog.tuitionAmount || ''} onChange={e => setEditDialog({ ...editDialog, tuitionAmount: Number(e.target.value) || null })} /></div>
              <div className="space-y-1"><Label className="text-xs">管理員備註</Label><Textarea value={editDialog.adminNotes || ''} onChange={e => setEditDialog({ ...editDialog, adminNotes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(null)}>取消</Button>
              <Button onClick={() => {
                updateMutation.mutate({
                  id: editDialog.id,
                  studentName: editDialog.studentName,
                  englishName: editDialog.englishName || null,
                  beltLevel: editDialog.beltLevel || null,
                  parentName: editDialog.parentName,
                  parentPhone: editDialog.parentPhone,
                  preferredDojo: editDialog.preferredDojo || null,
                  classSchedule: editDialog.classSchedule || null,
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
