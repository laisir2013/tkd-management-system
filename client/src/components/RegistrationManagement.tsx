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
  ArrowLeft, ClipboardList, Plus, X, CircleDot, CheckSquare, Type, List,
  Send
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { calcNewStudentProRata, WEEKDAY_NAMES } from "@/lib/newStudentCalc";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待處理", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  contacted: { label: "已聯繫", color: "bg-blue-100 text-blue-800 border-blue-300" },
  enrolled: { label: "已入學", color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "已拒絕", color: "bg-red-100 text-red-800 border-red-300" },
};

// ═══ Form field configuration (for settings page) ═══
type FieldType = "text" | "radio" | "checkbox" | "textarea" | "date" | "file" | "select";

type FormField = {
  key: string;
  label: string;
  section: string;
  visible: boolean;
  required: boolean;
  order: number;
  // Custom question fields
  fieldType?: FieldType;      // field input type
  options?: string[];         // choices for radio/checkbox/select
  isCustom?: boolean;         // true = user-added question (can be deleted)
  placeholder?: string;       // placeholder hint text
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文字輸入",
  radio: "單選題",
  checkbox: "多選題",
  textarea: "長文字",
  date: "日期",
  file: "檔案上傳",
  select: "下拉選單",
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
  const [approvalResult, setApprovalResult] = useState<{
    data: any;          // server response: { studentId, monthsCovered, nextPaymentDate, nextPaymentAmount }
    dialogSnapshot: any; // approveDialog data at the time of approval
  } | null>(null);

  // Form settings state
  const [formFields, setFormFields] = useState<FormField[]>(() => {
    try {
      const saved = localStorage.getItem("reg_form_fields");
      return saved ? JSON.parse(saved) : DEFAULT_FORM_FIELDS;
    } catch { return DEFAULT_FORM_FIELDS; }
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  const registrationsQuery = trpc.registration.getAll.useQuery();
  const updateMutation = trpc.registration.update.useMutation({
    onSuccess: () => { registrationsQuery.refetch(); toast.success("已更新"); setEditDialog(null); },
  });
  const approveMutation = trpc.registration.approve.useMutation({
    onSuccess: (data) => {
      registrationsQuery.refetch();
      toast.success(`已批准入學！學生已加入系統，覆蓋 ${data.monthsCovered.map((m: number) => m + '月').join('、')}`);
      // 不關閉 dialog，而是切換到 WhatsApp 通知模式
      setApprovalResult({ data, dialogSnapshot: { ...approveDialog } });
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
  // PAGE: 報名表設定 (Google Form 風格)
  // ═══════════════════════════════════════════
  if (pageView === "settings") {
    const sortedFields = [...formFields].sort((a, b) => a.order - b.order);
    const sections = ["學生資料", "上課安排", "聯絡資料", "繳費資料", "其他資料"];
    const SECTION_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
      "學生資料": { bg: "bg-blue-100", icon: "text-blue-600", border: "border-blue-200" },
      "上課安排": { bg: "bg-emerald-100", icon: "text-emerald-600", border: "border-emerald-200" },
      "聯絡資料": { bg: "bg-violet-100", icon: "text-violet-600", border: "border-violet-200" },
      "繳費資料": { bg: "bg-amber-100", icon: "text-amber-600", border: "border-amber-200" },
      "其他資料": { bg: "bg-slate-100", icon: "text-slate-600", border: "border-slate-200" },
    };
    const SECTION_ICONS: Record<string, typeof User> = {
      "學生資料": User,
      "上課安排": MapPin,
      "聯絡資料": Phone,
      "繳費資料": CreditCard,
      "其他資料": FileText,
    };
    // Which field is being edited (expanded)
    const resetEditField = () => setEditingField(null);

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
    const updateFieldType = (key: string, fieldType: FieldType) => {
      setFormFields(prev => prev.map(f => {
        if (f.key !== key) return f;
        const updated = { ...f, fieldType };
        // Auto-add default options for radio/checkbox/select if none exist
        if ((fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'select') && (!updated.options || updated.options.length === 0)) {
          updated.options = ["選項 1", "選項 2"];
        }
        // Clear options for non-choice types
        if (fieldType === 'text' || fieldType === 'textarea' || fieldType === 'date' || fieldType === 'file') {
          updated.options = undefined;
        }
        return updated;
      }));
    };
    const updateOption = (key: string, idx: number, value: string) => {
      setFormFields(prev => prev.map(f => {
        if (f.key !== key || !f.options) return f;
        const opts = [...f.options];
        opts[idx] = value;
        return { ...f, options: opts };
      }));
    };
    const addOption = (key: string) => {
      setFormFields(prev => prev.map(f => {
        if (f.key !== key) return f;
        const opts = [...(f.options || [])];
        opts.push(`選項 ${opts.length + 1}`);
        return { ...f, options: opts };
      }));
    };
    const removeOption = (key: string, idx: number) => {
      setFormFields(prev => prev.map(f => {
        if (f.key !== key || !f.options) return f;
        const opts = f.options.filter((_, i) => i !== idx);
        return { ...f, options: opts.length > 0 ? opts : ["選項 1"] };
      }));
    };
    const addCustomField = (section: string) => {
      const newKey = `custom_${Date.now()}`;
      const maxOrder = Math.max(...formFields.map(f => f.order), -1);
      // Insert after last field of this section
      const sectionFields = formFields.filter(f => f.section === section);
      const insertAfterOrder = sectionFields.length > 0
        ? Math.max(...sectionFields.map(f => f.order))
        : maxOrder;
      // Shift all fields after insertion point
      const updated = formFields.map(f => f.order > insertAfterOrder ? { ...f, order: f.order + 1 } : f);
      const newField: FormField = {
        key: newKey,
        label: "新問題",
        section,
        visible: true,
        required: false,
        order: insertAfterOrder + 1,
        fieldType: "text",
        isCustom: true,
        placeholder: "輸入答案...",
      };
      setFormFields([...updated, newField]);
      setEditingField(newKey);
    };
    const deleteField = (key: string) => {
      setFormFields(prev => {
        const filtered = prev.filter(f => f.key !== key);
        // Re-order
        const sorted = [...filtered].sort((a, b) => a.order - b.order);
        sorted.forEach((f, i) => f.order = i);
        return sorted;
      });
      if (editingField === key) setEditingField(null);
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

    // Helper: get display placeholder for a field
    const getFieldPlaceholder = (field: FormField): string => {
      if (field.isCustom) {
        if (field.fieldType === 'radio') return '⊙ 單選題';
        if (field.fieldType === 'checkbox') return '☑ 多選題';
        if (field.fieldType === 'select') return '▼ 下拉選單';
        if (field.fieldType === 'textarea') return '長文字輸入...';
        if (field.fieldType === 'date') return '選擇日期...';
        if (field.fieldType === 'file') return '📎 上傳檔案';
        return field.placeholder || `輸入${field.label}...`;
      }
      // Built-in fields
      switch (field.key) {
        case 'studentGender': return '男 / 女';
        case 'studentBirthDate': return '年 / 月 / 日';
        case 'beltLevel': return '選擇色帶...';
        case 'dobokSize': return '選擇道袍尺寸...';
        case 'preferredDojo': return '選擇道場...';
        case 'classSchedule': return '選擇上課時間...';
        case 'firstClassDate': return '選擇日期...';
        case 'receivingBank': return '選擇收款方式...';
        case 'receiptUrl': return '📷 上傳收據圖片';
        case 'howDidYouHear': return '選擇途徑...';
        case 'medicalConditions': case 'remarks': return '選填文字...';
        default: return `輸入${field.label}...`;
      }
    };

    return (
      <div className="space-y-4">
        {/* Sticky header bar */}
        <div className="flex items-center justify-between sticky top-0 z-20 bg-white/95 backdrop-blur-sm -mx-1 px-1 py-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setPageView("list")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回
            </Button>
            <h3 className="font-bold text-lg">報名表設定</h3>
            <span className="text-xs text-gray-400 hidden sm:inline">（拖拽排序 • 點擊欄位可修改）</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetSettings}>重置預設</Button>
            <Button size="sm" onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 儲存設定
            </Button>
          </div>
        </div>

        {/* Form header preview - like real form */}
        <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-6 text-center relative">
            <div className="absolute top-2 right-2 bg-white/10 backdrop-blur px-2 py-1 rounded-full text-[10px] text-white/60">預覽</div>
            <img src="/static/logo.png" alt="Logo" className="mx-auto w-16 h-16 object-contain mb-2 drop-shadow-lg" />
            <h2 className="text-xl font-black text-white">創武跆拳道館</h2>
            <p className="text-sm text-white/70">新生報名表</p>
          </div>
        </div>

        {/* Form sections - Google Form style */}
        {sections.map(sectionName => {
          const sectionFields = sortedFields.filter(f => f.section === sectionName);
          if (sectionFields.length === 0 && !["學生資料", "上課安排", "聯絡資料", "繳費資料", "其他資料"].includes(sectionName)) return null;
          const color = SECTION_COLORS[sectionName] || SECTION_COLORS["其他資料"];
          const IconComp = SECTION_ICONS[sectionName] || FileText;

          return (
            <div key={sectionName} className={`rounded-3xl border ${color.border} overflow-hidden shadow-sm`}>
              {/* Section header */}
              <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl ${color.bg} flex items-center justify-center`}>
                  <IconComp className={`w-4 h-4 ${color.icon}`} />
                </div>
                <span className="font-bold text-slate-800 text-sm">{sectionName}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{sectionFields.filter(f => f.visible).length}/{sectionFields.length} 欄位</span>
              </div>

              {/* Fields in this section */}
              <div className="bg-white p-4 space-y-2">
                {sectionFields.map((field) => {
                  const globalIdx = sortedFields.findIndex(f => f.key === field.key);
                  const isEditing = editingField === field.key;
                  const isDragging = dragIdx === globalIdx;
                  const hasOptions = field.options && field.options.length > 0;
                  const fType = field.fieldType || 'text';

                  return (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={() => handleDragStart(globalIdx)}
                      onDragOver={(e) => handleDragOver(e, globalIdx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setEditingField(isEditing ? null : field.key)}
                      className={`group relative rounded-2xl border-2 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                        isDragging
                          ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.02] ring-2 ring-blue-200'
                          : isEditing
                            ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-100'
                            : 'border-transparent hover:border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm'
                      } ${!field.visible ? 'opacity-40' : ''}`}
                    >
                      {/* Drag handle bar */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-slate-200 group-hover:bg-slate-300 mt-1 transition-colors" />

                      <div className="p-4 pt-4">
                        {/* Field display — like the real form */}
                        <div className="flex items-start gap-3">
                          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 mt-0.5 shrink-0 transition-colors" />

                          <div className="flex-1 min-w-0">
                            {/* Label row */}
                            <div className="flex items-center gap-2 mb-2">
                              {isEditing ? (
                                <input
                                  value={field.label}
                                  onChange={e => { e.stopPropagation(); updateLabel(field.key, e.target.value); }}
                                  onClick={e => e.stopPropagation()}
                                  className="flex-1 text-sm font-semibold text-slate-700 bg-white border border-blue-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-200"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                              )}
                              {field.required && <span className="text-red-500 text-sm">*</span>}
                              {field.isCustom && (
                                <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full border border-blue-200">自訂</span>
                              )}
                              {!field.visible && (
                                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">已隱藏</span>
                              )}
                            </div>

                            {/* Field preview — depends on type */}
                            {(fType === 'radio' || fType === 'checkbox') && hasOptions ? (
                              /* Radio/Checkbox options preview */
                              <div className="space-y-1.5">
                                {field.options!.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    {fType === 'radio' ? (
                                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                                    ) : (
                                      <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                                    )}
                                    {isEditing ? (
                                      <div className="flex-1 flex items-center gap-1">
                                        <input
                                          value={opt}
                                          onChange={e => { e.stopPropagation(); updateOption(field.key, oi, e.target.value); }}
                                          onClick={e => e.stopPropagation()}
                                          className="flex-1 text-sm text-slate-600 bg-transparent border-b border-slate-200 focus:border-blue-400 outline-none py-0.5 px-1"
                                        />
                                        {field.options!.length > 1 && (
                                          <button onClick={e => { e.stopPropagation(); removeOption(field.key, oi); }}
                                            className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-slate-600">{opt}</span>
                                    )}
                                  </div>
                                ))}
                                {isEditing && (
                                  <button onClick={e => { e.stopPropagation(); addOption(field.key); }}
                                    className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-700 ml-6 mt-1 py-1">
                                    <Plus className="w-3.5 h-3.5" /> 新增選項
                                  </button>
                                )}
                              </div>
                            ) : fType === 'select' && hasOptions ? (
                              /* Select dropdown preview */
                              <div className="space-y-1.5">
                                <div className="h-10 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center px-3 justify-between">
                                  <span className="text-sm text-slate-300">▼ 從下列選項中選擇...</span>
                                </div>
                                {isEditing && (
                                  <div className="ml-2 pl-3 border-l-2 border-slate-200 space-y-1 mt-2">
                                    {field.options!.map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-300 w-4">{oi+1}.</span>
                                        <input
                                          value={opt}
                                          onChange={e => { e.stopPropagation(); updateOption(field.key, oi, e.target.value); }}
                                          onClick={e => e.stopPropagation()}
                                          className="flex-1 text-sm text-slate-600 bg-transparent border-b border-slate-200 focus:border-blue-400 outline-none py-0.5 px-1"
                                        />
                                        {field.options!.length > 1 && (
                                          <button onClick={e => { e.stopPropagation(); removeOption(field.key, oi); }}
                                            className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button onClick={e => { e.stopPropagation(); addOption(field.key); }}
                                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1 py-1">
                                      <Plus className="w-3.5 h-3.5" /> 新增選項
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Text/textarea/date/file input preview */
                              <div className={`${fType === 'textarea' ? 'h-20' : 'h-10'} rounded-xl border border-slate-200 bg-slate-50/80 flex items-center px-3`}>
                                <span className="text-sm text-slate-300 truncate">{getFieldPlaceholder(field)}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick controls */}
                          <div className={`flex flex-col items-end gap-1 shrink-0 transition-opacity ${isEditing || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => toggleRequired(field.key)}
                              title={field.required ? "改為選填" : "改為必填"}
                              className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
                                field.required ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {field.required ? "必填" : "選填"}
                            </button>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => toggleVisible(field.key)}
                                title={field.visible ? "隱藏此欄位" : "顯示此欄位"}
                                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                {field.visible ? <Eye className="w-3.5 h-3.5 text-green-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
                              </button>
                              {field.isCustom && (
                                <button
                                  onClick={() => deleteField(field.key)}
                                  title="刪除此問題"
                                  className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded editing panel */}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-dashed border-blue-200" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">問題類型</label>
                                <select
                                  value={fType}
                                  onChange={e => updateFieldType(field.key, e.target.value as FieldType)}
                                  className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                  <option value="text">✏️ 文字輸入</option>
                                  <option value="radio">⊙ 單選題</option>
                                  <option value="checkbox">☑ 多選題</option>
                                  <option value="select">▼ 下拉選單</option>
                                  <option value="textarea">📝 長文字</option>
                                  <option value="date">📅 日期</option>
                                  <option value="file">📎 檔案上傳</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">所屬區塊</label>
                                <select
                                  value={field.section}
                                  onChange={e => updateSection(field.key, e.target.value)}
                                  className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">欄位 ID</label>
                                <div className="mt-1 text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1.5 font-mono border border-slate-100 truncate">{field.key}</div>
                              </div>
                            </div>

                            {/* Type description */}
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                              {fType === 'radio' && <><CircleDot className="w-3 h-3" /> 家長只能選 1 個答案</>}
                              {fType === 'checkbox' && <><CheckSquare className="w-3 h-3" /> 家長可以選多個答案</>}
                              {fType === 'select' && <><List className="w-3 h-3" /> 下拉式選單，只能選 1 個</>}
                              {fType === 'text' && <><Type className="w-3 h-3" /> 家長自由輸入文字</>}
                              {fType === 'textarea' && <><Type className="w-3 h-3" /> 多行文字輸入</>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add question button */}
                <button
                  onClick={(e) => { e.stopPropagation(); addCustomField(sectionName); }}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">新增問題</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Floating save bar for mobile */}
        <div className="sticky bottom-4 flex justify-center">
          <Button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 rounded-full px-6 h-11">
            <CheckCircle2 className="w-4 h-4 mr-2" /> 儲存所有設定
          </Button>
        </div>
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
                            dobokSize: reg.dobokSize || '',
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
        <Dialog open={true} onOpenChange={() => { setApproveDialog(null); setApprovalResult(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            {/* ─── 批准成功：WhatsApp 通知模式 ─── */}
            {approvalResult ? (() => {
              const snap = approvalResult.dialogSnapshot;
              const res = approvalResult.data;
              // 從 classSchedule 或 preferredSchedule 提取星期
              const scheduleStr = snap.classSchedule || snap.preferredSchedule || '';
              // 嘗試從 scheduleStr 提取星期X（e.g. "星期六 2:00-3:00pm"）
              const weekdayMatch = scheduleStr.match(/星期[一二三四五六日]/);
              const scheduleDayStr = weekdayMatch ? weekdayMatch[0] : '';
              // 計算 pro-rata 資訊
              const proRata = scheduleDayStr
                ? calcNewStudentProRata(snap.firstClassDate, scheduleDayStr, snap.feePerQuarter)
                : null;
              // 覆蓋月份文字
              const coveredMonthsText = (res.monthsCovered as number[]).map((m: number) => `${m}月`).join('、');
              // 首堂日期
              const joinDate = new Date(snap.firstClassDate + 'T00:00:00');
              const joinDateText = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月${joinDate.getDate()}日`;
              // 12 堂結束日期
              const class12DateText = proRata
                ? `${proRata.class12Date.getFullYear()}年${proRata.class12Date.getMonth() + 1}月${proRata.class12Date.getDate()}日`
                : '';
              // 學費期間文字
              const firstMonth = (res.monthsCovered as number[])[0];
              const lastMonth = (res.monthsCovered as number[])[(res.monthsCovered as number[]).length - 1];
              const tuitionPeriodText = `${joinDate.getMonth() + 1}月${joinDate.getDate()}日–${lastMonth}月底`;
              // 下期繳費
              const nextPayDate = new Date(res.nextPaymentDate + 'T00:00:00');
              const nextPayDateText = `${nextPayDate.getFullYear()}年${nextPayDate.getMonth() + 1}月`;
              // 下期季度標籤
              const nextQuarterLabel = proRata?.nextQuarterLabel || (() => {
                const m = nextPayDate.getMonth() + 1;
                if (m <= 3) return '1-3月';
                if (m <= 6) return '4-6月';
                if (m <= 9) return '7-9月';
                return '10-12月';
              })();
              // 道袍尺寸
              const dobokSize = snap.dobokSize || '';
              // 學費金額分解
              const EQUIPMENT_FEE = 550;
              const pureTuition = snap.tuitionAmount - EQUIPMENT_FEE;

              // ═══ 生成 WhatsApp 訊息 ═══
              const buildWhatsAppMessage = () => {
                const lines: string[] = [];

                // Part 1: 收費確認
                lines.push(`🥋 *${snap.studentName}* 家長您好！`);
                lines.push('');
                lines.push(`感謝您報讀本館跆拳道課程。現確認已收到閣下繳交之費用 *$${snap.tuitionAmount.toLocaleString()}*，明細如下：`);
                lines.push('');
                lines.push('📋 *繳費明細*');
                lines.push(`• 學費（${tuitionPeriodText}，共12堂）：$${pureTuition.toLocaleString()}`);
                lines.push(`• 手把：$150`);
                lines.push(`• 道袍${dobokSize ? `（${dobokSize}）` : ''}：$400`);
                lines.push(`• 合計：*$${snap.tuitionAmount.toLocaleString()}*`);

                // Part 2: 上課詳情
                lines.push('');
                lines.push('📍 *上課詳情*');
                lines.push(`• 地點：${snap.preferredDojo}`);
                lines.push(`• 時間：${scheduleStr || '待安排'}`);
                lines.push(`• 首堂日期：${joinDateText}`);
                if (class12DateText) {
                  lines.push(`• 第12堂日期：${class12DateText}`);
                }

                // Part 3: 收費模式說明
                lines.push('');
                lines.push('───────────────');
                lines.push('');
                lines.push('📌 *收費模式說明*');
                lines.push('');
                lines.push('本館採用「季度繳費」制度，每年分為四個季度：');
                lines.push('• 第一季：1月 – 3月');
                lines.push('• 第二季：4月 – 6月');
                lines.push('• 第三季：7月 – 9月');
                lines.push('• 第四季：10月 – 12月');
                lines.push('');
                lines.push(`每季學費為 *$${snap.feePerQuarter.toLocaleString()}*（3個月），即每月 $${Math.round(snap.feePerQuarter / 3).toLocaleString()}。`);

                // Part 4: 中途插班比例計算
                lines.push('');
                lines.push('📐 *中途入學按比例安排*');
                lines.push('');
                lines.push(`由於 ${snap.studentName} 於季度中途入學，首期費用以按比例方式計算。首12堂課程完成後，將銜接回本館的季度繳費周期。`);
                lines.push('');

                // Part 5: 下期繳費
                lines.push('💰 *下期繳費安排*');
                lines.push('');
                if (res.nextPaymentAmount >= snap.feePerQuarter) {
                  lines.push(`下一期繳費期為 *${nextQuarterLabel}*，費用為全期 *$${res.nextPaymentAmount.toLocaleString()}*。`);
                } else {
                  lines.push(`下一期繳費期為 *${nextQuarterLabel}*，由於12堂週期已覆蓋部分月份，按比例計算後費用為 *$${res.nextPaymentAmount.toLocaleString()}*。`);
                  if (proRata) {
                    if (proRata.coveredWholeMonths > 0) {
                      const coveredNames = [];
                      const qStartMonth = proRata.nextQuarterMonths[0];
                      for (let i = 0; i < proRata.coveredWholeMonths; i++) {
                        coveredNames.push(`${qStartMonth + i}月`);
                      }
                      lines.push(`（${coveredNames.join('、')}仍在12堂週期內，只需繳交餘下${proRata.monthsCharged}個月的費用${proRata.overlapClasses > 0 ? `，另扣除${proRata.overlapClasses}堂重疊堂數$${proRata.overlapDeduction}` : ''}）`);
                    } else if (proRata.overlapClasses > 0) {
                      lines.push(`（扣除${proRata.overlapClasses}堂重疊堂數 $${proRata.overlapDeduction}）`);
                    }
                  }
                }

                // Part 6: 補堂及順延政策
                lines.push('');
                lines.push('───────────────');
                lines.push('');
                lines.push('📝 *補堂及費用順延政策*');
                lines.push('');
                lines.push('1️⃣ *補堂安排*');
                lines.push('如因事請假，可安排於其他時段補課。補堂不限於當期完成，日後任何時間均可安排補回。');
                lines.push('');
                lines.push('2️⃣ *費用順延*');
                lines.push('如需申請費用順延，請於請假前 *至少一個月* 提出申請。未能於一個月前通知者，該堂費用將不作順延處理。');

                // Part 7: 結尾
                lines.push('');
                lines.push('───────────────');
                lines.push('');
                lines.push('如有任何疑問，歡迎隨時聯絡我們！🙏');

                return lines.join('\n');
              };

              const whatsappMessage = buildWhatsAppMessage();
              const whatsappUrl = `https://api.whatsapp.com/send?phone=852${snap.parentPhone}&text=${encodeURIComponent(whatsappMessage)}`;

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      入學批准成功！
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    {/* 成功摘要 */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                      <div className="font-semibold text-green-800">✅ {snap.studentName} 已成功加入系統</div>
                      <div className="text-green-700">學生 ID：{res.studentId}</div>
                      <div className="text-green-700">已繳 ${snap.tuitionAmount.toLocaleString()}（覆蓋 {coveredMonthsText}）</div>
                      <div className="text-green-700">下期：{nextQuarterLabel} — ${res.nextPaymentAmount.toLocaleString()}</div>
                    </div>

                    {/* WhatsApp 訊息預覽 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">📱 WhatsApp 通知訊息預覽</Label>
                      <div className="bg-gray-50 border rounded-lg p-3 text-xs whitespace-pre-wrap max-h-60 overflow-y-auto font-mono leading-relaxed">
                        {whatsappMessage}
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => { setApproveDialog(null); setApprovalResult(null); }}>
                      關閉
                    </Button>
                    <Button
                      variant="outline"
                      className="text-gray-600"
                      onClick={() => {
                        navigator.clipboard.writeText(whatsappMessage);
                        toast.success('訊息已複製到剪貼板');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-1" /> 複製訊息
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => window.open(whatsappUrl, '_blank')}
                    >
                      <WhatsAppIcon className="w-4 h-4 mr-1" /> 發送 WhatsApp 通知
                    </Button>
                  </DialogFooter>
                </>
              );
            })() : (
              /* ─── 批准確認表單（原有邏輯） ─── */
              <>
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
                      <Input value={approveDialog.preferredSchedule || approveDialog.classSchedule || ''} readOnly className="bg-gray-50" />
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
              </>
            )}
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
