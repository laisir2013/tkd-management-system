import { useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { addMonths, subMonths } from "date-fns";
import { formatDayMonthYear } from "@/lib/dateFormat";
import { zhTW } from "date-fns/locale";
import { Users, Calendar, DollarSign, ChevronLeft, ChevronRight, Plus, MoreHorizontal, ArrowLeft, Loader2, Ban, RotateCcw, ArrowRightLeft, Phone, RefreshCw, Pencil, Check, X, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { EliteWhatsAppButton } from "@/components/EliteWhatsAppButton";
import { EliteAttendanceWhatsAppButton } from "@/components/EliteAttendanceWhatsAppButton";
import { useLocation } from "wouter";
import EliteHistory from "@/pages/EliteHistory";

// ============ 學生管理 Tab ============
function EliteStudentsTab() {
  const utils = trpc.useUtils();
  const { data: students = [], isLoading } = trpc.elite.getStudents.useQuery();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<any>(null);
  const [deleteStudent, setDeleteStudent] = useState<any>(null);
  const [deactivateStudent, setDeactivateStudent] = useState<any>(null);
  const [reactivateStudent, setReactivateStudent] = useState<any>(null);
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState("");

  // Add mode: 'select' = pick from regular class, 'new' = create brand new
  const [addMode, setAddMode] = useState<'select' | 'new'>('select');
  const [selectedRegularId, setSelectedRegularId] = useState<number | null>(null);
  const [regularSearch, setRegularSearch] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "", phone: "", beltLevel: "", coach: "", scheduleDay: "", scheduleTime: "", feePerClass: "200", notes: "",
  });

  // 取得可加入精英班的恆常班學生
  const { data: regularStudents = [], isLoading: regularLoading } = trpc.elite.getRegularStudentsForElite.useQuery(
    undefined, { enabled: showAddDialog && addMode === 'select' }
  );
  const createFromRegularMutation = trpc.elite.createFromRegular.useMutation({
    onSuccess: (data) => { utils.elite.getStudents.invalidate(); setShowAddDialog(false); resetForm(); setSelectedRegularId(null); setRegularSearch(""); toast.success(`${data.name} 已從恆常班加入精英班`); },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.elite.createStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); setShowAddDialog(false); resetForm(); toast.success("學生已新增"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.elite.updateStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); setEditingStudent(null); toast.success("學生已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.elite.deleteStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); setDeleteStudent(null); toast.success("學生已刪除"); },
    onError: (e) => toast.error(e.message),
  });
  const resetPasswordMutation = trpc.elite.resetPassword.useMutation({
    onSuccess: () => { setResetPasswordStudent(null); toast.success("密碼已重置為電話號碼"); },
    onError: (e) => toast.error(e.message),
  });
  const switchClassMutation = trpc.elite.switchClass.useMutation({
    onSuccess: (data) => { utils.elite.getStudents.invalidate(); toast.success(`已轉到精英班${data.newClass}班`); },
    onError: (e) => toast.error(e.message),
  });
  const syncPhonesMutation = trpc.elite.syncPhonesFromRegular.useMutation({
    onSuccess: (data) => { utils.elite.getStudents.invalidate(); toast.success(`已從恆常班匹配 ${data.matched} 位學生的電話號碼（共 ${data.total} 位缺電話）`); },
    onError: (e) => toast.error(e.message),
  });
  const updatePhoneMutation = trpc.elite.updateStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); setEditingPhoneId(null); toast.success("電話號碼已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const updateCoachMutation = trpc.elite.updateStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); toast.success("負責教練已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const COACH_OPTIONS = ["賴政堡教練","鄺富華教練","林學曉教練","何翰錕教練","許悠教練"];
  const COACH_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    "賴政堡教練": { bg: "bg-blue-50", border: "border-l-4 border-l-blue-500", text: "text-blue-700", badge: "bg-blue-100 text-blue-800 border-blue-300" },
    "鄺富華教練": { bg: "bg-emerald-50", border: "border-l-4 border-l-emerald-500", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    "林學曉教練": { bg: "bg-amber-50", border: "border-l-4 border-l-amber-500", text: "text-amber-700", badge: "bg-amber-100 text-amber-800 border-amber-300" },
    "何翰錕教練": { bg: "bg-purple-50", border: "border-l-4 border-l-purple-500", text: "text-purple-700", badge: "bg-purple-100 text-purple-800 border-purple-300" },
    "許悠教練": { bg: "bg-rose-50", border: "border-l-4 border-l-rose-500", text: "text-rose-700", badge: "bg-rose-100 text-rose-800 border-rose-300" },
  };
  const DEFAULT_COACH_COLOR = { bg: "bg-gray-50", border: "border-l-4 border-l-gray-300", text: "text-gray-500", badge: "bg-gray-100 text-gray-600 border-gray-300" };
  const deactivateMutation = trpc.elite.updateStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); utils.elite.getAllBalances.invalidate(); setDeactivateStudent(null); toast.success("學生已停用"); },
    onError: (e) => toast.error(e.message),
  });
  const reactivateMutation = trpc.elite.updateStudent.useMutation({
    onSuccess: () => { utils.elite.getStudents.invalidate(); utils.elite.getAllBalances.invalidate(); setReactivateStudent(null); toast.success("學生已恢復"); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setFormData({ name: "", phone: "", beltLevel: "", coach: "", scheduleDay: "", scheduleTime: "", feePerClass: "200", notes: "" });
  }

  function openEdit(student: any) {
    setFormData({
      name: student.name, phone: student.phone, beltLevel: student.beltLevel || "",
      coach: student.coach || "",
      scheduleDay: student.scheduleDay || "", scheduleTime: student.scheduleTime || "",
      feePerClass: student.feePerClass || "200", notes: student.notes || "",
    });
    setEditingStudent(student);
  }

  function getStudentClass(s: any): 'A' | 'B' {
    return s.scheduleTime === '12:00-2:00pm' ? 'A' : 'B';
  }

  const activeStudents = students.filter((s: any) => s.status === "active");
  const inactiveStudents = students.filter((s: any) => s.status !== "active");
  const classAStudents = activeStudents.filter((s: any) => getStudentClass(s) === 'A');
  const classBStudents = activeStudents.filter((s: any) => getStudentClass(s) === 'B');
  const studentsNoPhone = activeStudents.filter((s: any) => !s.phone || s.phone === '' || s.phone === '0');

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // 按教練分組排序學生
  const sortByCoach = (students: any[]) => {
    return [...students].sort((a, b) => {
      const coachA = a.coach || '';
      const coachB = b.coach || '';
      const idxA = COACH_OPTIONS.indexOf(coachA);
      const idxB = COACH_OPTIONS.indexOf(coachB);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  };

  // 統計教練學生數
  const getCoachStats = (students: any[]) => {
    const map = new Map<string, number>();
    students.forEach(s => {
      const c = s.coach || '未指定';
      map.set(c, (map.get(c) || 0) + 1);
    });
    return map;
  };

  const renderClassTable = (classStudents: any[], className: string, classLabel: string, classTime: string) => {
    const sorted = sortByCoach(classStudents);
    const coachStats = getCoachStats(classStudents);
    return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={className === 'A' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-orange-500 text-orange-700 bg-orange-50'}>
          {classLabel}
        </Badge>
        <span className="text-sm text-muted-foreground">星期日 {classTime}</span>
        <span className="text-sm font-medium">{classStudents.length} 人</span>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {Array.from(coachStats.entries()).map(([coach, count]) => {
            const cc = COACH_COLORS[coach] || DEFAULT_COACH_COLOR;
            return (
              <span key={coach} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cc.badge}`}>
                <span className={`w-2 h-2 rounded-full ${cc.border.replace('border-l-4 border-l-', 'bg-')}`} />
                {coach}: {count}人
              </span>
            );
          })}
        </div>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">編號</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>電話</TableHead>
              <TableHead>色帶</TableHead>
              <TableHead>負責教練</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s: any, index: number) => {
              const cc = COACH_COLORS[s.coach] || DEFAULT_COACH_COLOR;
              return (
              <TableRow key={s.id} className={`${cc.bg} ${cc.border}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  {editingPhoneId === s.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-7 w-28 text-sm"
                        value={editingPhoneValue}
                        onChange={(e) => setEditingPhoneValue(e.target.value)}
                        placeholder="輸入電話"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingPhoneValue) {
                            updatePhoneMutation.mutate({ id: s.id, phone: editingPhoneValue });
                          } else if (e.key === 'Escape') {
                            setEditingPhoneId(null);
                          }
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (editingPhoneValue) updatePhoneMutation.mutate({ id: s.id, phone: editingPhoneValue }); }}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingPhoneId(null)}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className={!s.phone || s.phone === '' || s.phone === '0' ? 'text-red-400' : ''}>
                        {s.phone && s.phone !== '' && s.phone !== '0' ? s.phone : '未填寫'}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
                        onClick={() => { setEditingPhoneId(s.id); setEditingPhoneValue(s.phone && s.phone !== '0' ? s.phone : ''); }}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </TableCell>
                <TableCell>{s.beltLevel || "-"}</TableCell>
                <TableCell>
                  <Select
                    value={s.coach || ""}
                    onValueChange={(v) => updateCoachMutation.mutate({ id: s.id, coach: v })}
                  >
                    <SelectTrigger className={`h-7 w-[130px] text-xs font-medium ${cc.text}`}>
                      <SelectValue placeholder="選擇教練" />
                    </SelectTrigger>
                    <SelectContent>
                      {COACH_OPTIONS.map(c => {
                        const optColor = COACH_COLORS[c];
                        return (
                          <SelectItem key={c} value={c}>
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${optColor ? optColor.border.replace('border-l-4 border-l-', 'bg-') : 'bg-gray-300'}`} />
                              {c}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={switchClassMutation.isPending}
                      onClick={() => {
                        const targetClass = className === 'A' ? 'B' : 'A';
                        switchClassMutation.mutate({ id: s.id, targetClass: targetClass as 'A' | 'B' });
                      }}
                    >
                      <ArrowRightLeft className="h-3 w-3 mr-1" />
                      轉{className === 'A' ? 'B' : 'A'}班
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}>編輯資料</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetPasswordStudent(s)}>重置密碼</DropdownMenuItem>
                        <DropdownMenuItem className="text-orange-600" onClick={() => setDeactivateStudent(s)}>取消學生</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteStudent(s)}>刪除學生</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
            {classStudents.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">暫無學生</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">精英班學生 ({activeStudents.length} 人)</h3>
          <p className="text-sm text-muted-foreground">A班 {classAStudents.length} 人 · B班 {classBStudents.length} 人{inactiveStudents.length > 0 ? ` · 非活躍 ${inactiveStudents.length} 人` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncPhonesMutation.mutate()} disabled={syncPhonesMutation.isPending}>
            {syncPhonesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            從恆常班匹配電話
          </Button>
          <Button onClick={() => { resetForm(); setAddMode('select'); setSelectedRegularId(null); setRegularSearch(""); setShowAddDialog(true); }}><Plus className="h-4 w-4 mr-1" />新增學生</Button>
        </div>
      </div>

      {/* 缺電話號碼提示 */}
      {studentsNoPhone.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800">{studentsNoPhone.length} 位學生尚未填寫電話號碼</span>
            </div>
            <p className="text-sm text-amber-700 mb-2">缺少電話號碼將無法發送 WhatsApp 繳費提醒。可點擊表格中的「未填寫」直接編輯，或使用「從恆常班匹配電話」按鈕自動填入。</p>
            <div className="flex flex-wrap gap-2">
              {studentsNoPhone.map((s: any) => (
                <Badge key={s.id} variant="outline" className="border-amber-400 text-amber-800 bg-amber-100 cursor-pointer hover:bg-amber-200"
                  onClick={() => { setEditingPhoneId(s.id); setEditingPhoneValue(''); }}>
                  {s.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {renderClassTable(classAStudents, 'A', '精英班 A 班', '12:00-2:00pm')}
      {renderClassTable(classBStudents, 'B', '精英班 B 班', '4:30-6:30pm')}

      {/* 新增/編輯對話框 */}
      <Dialog open={showAddDialog || !!editingStudent} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditingStudent(null); setSelectedRegularId(null); setRegularSearch(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "編輯學生" : "新增精英班學生"}</DialogTitle>
            <DialogDescription>{editingStudent ? "修改學生資料" : "從恆常班選取現有學生，或新增全新學生"}</DialogDescription>
          </DialogHeader>

          {/* 新增模式切換（編輯時不顯示） */}
          {!editingStudent && (
            <div className="flex rounded-lg border p-1 gap-1 bg-muted/50">
              <button
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${addMode === 'select' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setAddMode('select'); setSelectedRegularId(null); setRegularSearch(""); }}
              >
                <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />從恆常班選取
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${addMode === 'new' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setAddMode('new'); setSelectedRegularId(null); }}
              >
                <Plus className="h-4 w-4 inline mr-1.5 -mt-0.5" />新增全新學生
              </button>
            </div>
          )}

          {/* ── 模式 A：從恆常班選取 ── */}
          {!editingStudent && addMode === 'select' && (
            <div className="space-y-3">
              <div>
                <Label>搜尋恆常班學生</Label>
                <Input
                  placeholder="輸入姓名或電話搜尋..."
                  value={regularSearch}
                  onChange={(e) => setRegularSearch(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {regularLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (() => {
                  const filtered = regularStudents.filter(s =>
                    s.name.toLowerCase().includes(regularSearch.toLowerCase()) ||
                    s.phone.includes(regularSearch)
                  );
                  return filtered.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      {regularSearch ? "找不到符合的學生" : "沒有可加入的恆常班學生"}
                    </p>
                  ) : (
                    filtered.map(s => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer border-b last:border-b-0 transition-colors ${selectedRegularId === s.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-muted/50'}`}
                        onClick={() => {
                          setSelectedRegularId(s.id);
                          setFormData(p => ({
                            ...p,
                            coach: s.coach || p.coach,
                            scheduleDay: '',
                            scheduleTime: '',
                            feePerClass: '200',
                            notes: '',
                          }));
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.venue} · {s.phone}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          {s.beltLevel && <Badge variant="outline" className="text-xs">{s.beltLevel}</Badge>}
                          {selectedRegularId === s.id && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
              {selectedRegularId && (
                <div className="border rounded-lg p-3 bg-blue-50/50 space-y-3">
                  <p className="text-sm font-medium text-blue-800">
                    已選：{regularStudents.find(s => s.id === selectedRegularId)?.name}
                    <span className="text-muted-foreground font-normal ml-2">— 設定精英班資料：</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">負責教練</Label>
                      <Select value={formData.coach} onValueChange={(v) => setFormData(p => ({ ...p, coach: v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="選擇教練" /></SelectTrigger>
                        <SelectContent>
                          {COACH_OPTIONS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">每堂費用 ($)</Label>
                      <Input className="h-9" value={formData.feePerClass} onChange={(e) => setFormData(p => ({ ...p, feePerClass: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">班別</Label>
                    <Select
                      value={formData.scheduleTime === '12:00-2:00pm' ? 'A' : formData.scheduleTime === '4:30-6:30pm' ? 'B' : ''}
                      onValueChange={(v) => setFormData(p => ({
                        ...p,
                        scheduleDay: '星期日',
                        scheduleTime: v === 'A' ? '12:00-2:00pm' : '4:30-6:30pm',
                      }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="選擇班別" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A 班（星期日 12:00-2:00pm）</SelectItem>
                        <SelectItem value="B">B 班（星期日 4:30-6:30pm）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">備註</Label>
                    <Input className="h-9" value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="選填" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 模式 B：新增全新學生 / 編輯模式 ── */}
          {(editingStudent || addMode === 'new') && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>姓名 *</Label><Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>電話 *</Label><Input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>帶級</Label><Input value={formData.beltLevel} onChange={(e) => setFormData(p => ({ ...p, beltLevel: e.target.value }))} placeholder="例如: 黑帶一段" /></div>
                <div>
                  <Label>負責教練</Label>
                  <Select value={formData.coach} onValueChange={(v) => setFormData(p => ({ ...p, coach: v }))}>
                    <SelectTrigger><SelectValue placeholder="選擇教練" /></SelectTrigger>
                    <SelectContent>
                      {COACH_OPTIONS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>每堂費用 ($)</Label><Input value={formData.feePerClass} onChange={(e) => setFormData(p => ({ ...p, feePerClass: e.target.value }))} /></div>
                <div>
                  <Label>班別</Label>
                  <Select
                    value={formData.scheduleTime === '12:00-2:00pm' ? 'A' : formData.scheduleTime === '4:30-6:30pm' ? 'B' : ''}
                    onValueChange={(v) => setFormData(p => ({
                      ...p,
                      scheduleDay: '星期日',
                      scheduleTime: v === 'A' ? '12:00-2:00pm' : '4:30-6:30pm',
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇班別" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A 班（星期日 12:00-2:00pm）</SelectItem>
                      <SelectItem value="B">B 班（星期日 4:30-6:30pm）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>備註</Label><Input value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingStudent(null); setSelectedRegularId(null); setRegularSearch(""); }}>取消</Button>
            {/* 從恆常班選取模式 */}
            {!editingStudent && addMode === 'select' && (
              <Button
                disabled={!selectedRegularId || createFromRegularMutation.isPending}
                onClick={() => {
                  if (!selectedRegularId) return;
                  createFromRegularMutation.mutate({
                    regularStudentId: selectedRegularId,
                    coach: formData.coach || undefined,
                    scheduleDay: formData.scheduleDay || undefined,
                    scheduleTime: formData.scheduleTime || undefined,
                    feePerClass: formData.feePerClass || '200',
                    notes: formData.notes || undefined,
                  });
                }}
              >
                {createFromRegularMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                加入精英班
              </Button>
            )}
            {/* 新增全新學生 / 編輯模式 */}
            {(editingStudent || addMode === 'new') && (
              <Button
                disabled={!formData.name || !formData.phone || createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  if (editingStudent) {
                    updateMutation.mutate({ id: editingStudent.id, ...formData });
                  } else {
                    createMutation.mutate(formData);
                  }
                }}
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingStudent ? "更新" : "新增"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密碼確認 */}
      <AlertDialog open={!!resetPasswordStudent} onOpenChange={(open) => { if (!open) setResetPasswordStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置密碼</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將 <strong>{resetPasswordStudent?.name}</strong> 的密碼重置為電話號碼 <strong>{resetPasswordStudent?.phone}</strong> 嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetPasswordMutation.mutate({ id: resetPasswordStudent.id })}>確認重置</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 取消學生確認 */}
      <AlertDialog open={!!deactivateStudent} onOpenChange={(open) => { if (!open) setDeactivateStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消學生</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將 <strong>{deactivateStudent?.name}</strong> 設為非活躍嗎？學生將從名單中移除，但出席和繳費記錄會保留。可隨時恢復。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => deactivateMutation.mutate({ id: deactivateStudent.id, status: 'inactive' })}>確認取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 恢復學生確認 */}
      <AlertDialog open={!!reactivateStudent} onOpenChange={(open) => { if (!open) setReactivateStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢復學生</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將 <strong>{reactivateStudent?.name}</strong> 恢復為活躍狀態嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction className="bg-green-600 text-white hover:bg-green-700" onClick={() => reactivateMutation.mutate({ id: reactivateStudent.id, status: 'active' })}>確認恢復</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認 */}
      <AlertDialog open={!!deleteStudent} onOpenChange={(open) => { if (!open) setDeleteStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除學生</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除 <strong>{deleteStudent?.name}</strong> 嗎？此操作會同時刪除該學生的所有出席記錄和繳費記錄，且無法恢復。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate({ id: deleteStudent.id })}>確認刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 非活躍學生列表 */}
      {inactiveStudents.length > 0 && (
        <Card className="border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-gray-500" />
              非活躍學生 ({inactiveStudents.length} 人)
            </CardTitle>
            <CardDescription>已取消的學生，可點擊「恢復」重新加入名單</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>帶級</TableHead>
                    <TableHead>班別</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveStudents.map((s: any) => (
                    <TableRow key={s.id} className="bg-gray-50">
                      <TableCell className="font-medium text-gray-500">{s.name}</TableCell>
                      <TableCell className="text-gray-500">{s.phone || '未填寫'}</TableCell>
                      <TableCell className="text-gray-500">{s.beltLevel || '-'}</TableCell>
                      <TableCell className="text-gray-500">{getStudentClass(s) === 'A' ? 'A班' : 'B班'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => setReactivateStudent(s)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            恢復
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => setDeleteStudent(s)}
                          >
                            刪除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ 點名表 Tab ============
function EliteAttendanceTab() {
  const utils = trpc.useUtils();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [activeClass, setActiveClass] = useState<'A' | 'B'>('A');

  const { data: students = [] } = trpc.elite.getStudents.useQuery();
  const { data: schedules = [], isLoading: schedulesLoading } = trpc.elite.getSchedules.useQuery({ year: currentYear, month: currentMonth });
  const { data: allAttendance = [] } = trpc.elite.getAttendance.useQuery({});
  const { data: cycleInfoList = [] } = trpc.elite.getAllCycleInfo.useQuery();

  const cancelScheduleMutation = trpc.elite.cancelSchedule.useMutation({
    onSuccess: () => { utils.elite.getSchedules.invalidate(); toast.success("已取消課堂"); },
  });
  const activateScheduleMutation = trpc.elite.activateSchedule.useMutation({
    onSuccess: () => { utils.elite.getSchedules.invalidate(); toast.success("已恢復課堂"); },
  });
  // Optimistic update state
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, string>>({});

  // Track in-flight mutations to avoid premature clearing
  const inflightCount = useRef(0);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      if (inflightCount.current > 0) {
        scheduleInvalidate();
        return;
      }
      Promise.all([
        utils.elite.getAttendance.invalidate(),
        utils.elite.getAllCycleInfo.invalidate(),
      ]).then(() => {
        setOptimisticUpdates({});
      });
    }, 800);
  }, [utils]);

  const upsertAttendanceMutation = trpc.elite.upsertAttendance.useMutation({
    onMutate: () => {
      inflightCount.current++;
    },
    onSuccess: (_data, _variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      scheduleInvalidate();
    },
    onError: (err: any, variables) => {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      const key = `${variables.scheduleId}-${variables.studentId}`;
      setOptimisticUpdates(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.error(`點名更新失敗: ${err.message}`);
      scheduleInvalidate();
    },
  });

  // 按 A/B 班過濾學生（訓練日期兩班共用，不按 scheduleTime 過濾）
  const classTimeA = '12:00-2:00pm';
  const classTimeB = '4:30-6:30pm';
  const currentClassTime = activeClass === 'A' ? classTimeA : classTimeB;

  const classStudents = students.filter((s: any) => s.status === 'active' && s.scheduleTime === currentClassTime);
  // 訓練日期兩班共用（DB 中為 '12:00-6:30pm'），不按 scheduleTime 過濾
  const classSchedules = schedules;
  const activeSchedules = classSchedules.filter((s: any) => s.status === 'active');
  const cancelledCount = classSchedules.filter((s: any) => s.status === 'cancelled').length;

  // 建立出席記錄 map (server data)
  const serverAttendanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    allAttendance.forEach((a: any) => {
      map[`${a.scheduleId}-${a.studentId}`] = a.status;
    });
    return map;
  }, [allAttendance]);

  // Merged: optimistic overrides server
  const attendanceMap = useMemo(() => {
    return { ...serverAttendanceMap, ...optimisticUpdates };
  }, [serverAttendanceMap, optimisticUpdates]);

  // 建立循環資訊 map
  const cycleMap = useMemo(() => {
    const map: Record<number, any> = {};
    cycleInfoList.forEach((c: any) => {
      map[c.studentId] = c;
    });
    return map;
  }, [cycleInfoList]);

  // 統計需要繳費提醒的學生數
  const needPaymentStudents = classStudents.filter((s: any) => {
    const cycle = cycleMap[s.id];
    return cycle && cycle.needPaymentReminder;
  });

  function handleMonthChange(direction: "prev" | "next") {
    if (direction === "prev") {
      if (currentMonth === 1) { setCurrentYear(y => y - 1); setCurrentMonth(12); }
      else setCurrentMonth(m => m - 1);
    } else {
      if (currentMonth === 12) { setCurrentYear(y => y + 1); setCurrentMonth(1); }
      else setCurrentMonth(m => m + 1);
    }
  }

  function toggleAttendance(scheduleId: number, studentId: number) {
    const key = `${scheduleId}-${studentId}`;
    const current = attendanceMap[key];
    const next = !current ? "present" : current === "present" ? "absent" : current === "absent" ? "late" : "present";
    // Optimistic update: immediately update UI
    setOptimisticUpdates(prev => ({ ...prev, [key]: next }));
    upsertAttendanceMutation.mutate({ scheduleId, studentId, status: next });
  }

  const statusEmoji: Record<string, string> = { present: "✅", absent: "❌", late: "⏰", excused: "🗕" };

  return (
    <div className="space-y-4">
      {/* A/B 班切換 */}
      <div className="flex gap-2">
        <Button
          variant={activeClass === 'A' ? 'default' : 'outline'}
          onClick={() => setActiveClass('A')}
          className={activeClass === 'A' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          A班（12:00-2:00pm）
        </Button>
        <Button
          variant={activeClass === 'B' ? 'default' : 'outline'}
          onClick={() => setActiveClass('B')}
          className={activeClass === 'B' ? 'bg-orange-600 hover:bg-orange-700' : ''}
        >
          B班（4:30-6:30pm）
        </Button>
      </div>

      {/* 繳費提醒卡片 */}
      {needPaymentStudents.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <span className="font-semibold text-orange-800">繳費提醒：{needPaymentStudents.length} 位學生即將完成 12 堂循環</span>
            </div>
            <p className="text-sm text-orange-700 mb-2">每 12 堂費用：<span className="font-bold">$2,400</span></p>
            <div className="flex flex-wrap gap-2">
              {needPaymentStudents.map((s: any) => {
                const cycle = cycleMap[s.id];
                return (
                  <Badge key={s.id} variant="outline" className="border-orange-400 text-orange-800 bg-orange-100">
                    {s.name}（第{cycle?.cycleNumber}堂）
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 月份導航 */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => handleMonthChange("prev")}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <h3 className="text-lg font-semibold">{currentYear}年{currentMonth}月 - 精英班{activeClass}班</h3>
          <p className="text-sm text-muted-foreground">
            學生: {classStudents.length} 人 · 訓練日: {activeSchedules.length} 天
            {cancelledCount > 0 && <span className="text-red-500"> · 已取消 {cancelledCount} 天</span>}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => handleMonthChange("next")}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* 點名表格 */}
      {classSchedules.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">學生</TableHead>
                {classSchedules.map((s: any) => {
                  const isCancelled = s.status === "cancelled";
                  const date = new Date(s.trainingDate);
                  return (
                    <TableHead key={s.id} className={`text-center min-w-[60px] ${isCancelled ? "bg-red-50" : ""}`}>
                      <div className="flex flex-col items-center gap-1">
                        <span className={isCancelled ? "line-through text-gray-400" : "font-medium"}>
                          {date.getUTCDate()}/{currentMonth}
                        </span>
                        {isCancelled ? (
                          <button onClick={() => activateScheduleMutation.mutate({ id: s.id })} className="text-green-600 hover:text-green-800 text-[10px] font-bold px-1 py-0.5 rounded hover:bg-green-50 border border-green-300" title="恢復課堂">
                            【恢復】
                          </button>
                        ) : (
                          <button onClick={() => cancelScheduleMutation.mutate({ id: s.id })} className="text-red-500 hover:text-red-700 text-[10px] font-bold px-1 py-0.5 rounded hover:bg-red-50 border border-red-300" title="取消課堂">
                            【取消】
                          </button>
                        )}
                        {isCancelled && <span className="text-[10px] text-red-400 font-medium">休息</span>}
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead className="text-center min-w-[50px]">通知</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classStudents.map((student: any) => {
                const cycle = cycleMap[student.id];
                const cycleNum = cycle?.cycleNumber || 0;
                const needReminder = cycle?.needPaymentReminder || false;

                // 計算每個日期格子的累計堂數：按日期順序，出席/遲到 +1
                let runningCount = 0;
                const cellNumbers: Record<number, number> = {};
                // 按日期排序的活躍課堂（排除已取消的）
                const sortedSchedules = [...classSchedules].sort((a: any, b: any) => 
                  new Date(a.trainingDate).getTime() - new Date(b.trainingDate).getTime()
                );
                for (const s of sortedSchedules) {
                  if (s.status === 'cancelled') continue;
                  const status = attendanceMap[`${s.id}-${student.id}`];
                  if (status === 'present' || status === 'late') {
                    runningCount++;
                    cellNumbers[s.id] = runningCount;
                  }
                }

                return (
                  <TableRow key={student.id} className={needReminder ? "bg-orange-50/60" : ""}>
                    <TableCell className={`sticky left-0 z-10 font-medium ${needReminder ? "bg-orange-50" : "bg-background"}`}>
                      <div className="flex items-center gap-1">
                        {student.name}
                        {needReminder && <span className="text-orange-500 text-xs">💰</span>}
                      </div>
                    </TableCell>
                    {classSchedules.map((s: any) => {
                      const isCancelled = s.status === "cancelled";
                      const key = `${s.id}-${student.id}`;
                      const status = attendanceMap[key];
                      if (isCancelled) {
                        return (
                          <TableCell key={s.id} className="text-center bg-red-50/50">
                            <span className="text-gray-300">—</span>
                          </TableCell>
                        );
                      }
                      const num = cellNumbers[s.id];
                      return (
                        <TableCell
                          key={s.id}
                          className={`text-center cursor-pointer transition-colors ${
                            status === 'present' ? 'bg-green-100 hover:bg-green-200'
                              : status === 'absent' ? 'bg-red-100 hover:bg-red-200'
                              : status === 'late' ? 'bg-yellow-100 hover:bg-yellow-200'
                              : 'hover:bg-gray-100'}`}
                          onClick={() => toggleAttendance(s.id, student.id)}
                        >
                          {num ? (
                            <span className={`font-bold text-sm ${
                              num >= 10 ? 'text-orange-600' : num >= 7 ? 'text-yellow-700' : 'text-green-700'
                            }`}>{num}</span>
                          ) : status === 'absent' ? (
                            <span className="text-red-400 text-sm">✗</span>
                          ) : (
                            <span className="text-gray-300 text-lg">·</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <EliteAttendanceWhatsAppButton
                        studentId={student.id}
                        studentName={student.name}
                        studentPhone={cycle?.phone || student.phone || ''}
                        cycleNumber={cycleNum}
                        totalAttended={cycle?.totalAttended || 0}
                        lastAttendedDate={cycle?.lastAttendedDate}
                        amountDue={needReminder ? 2400 : 0}
                        cycleDetails={cycle?.cycleDetails || []}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {classStudents.length === 0 && (
                <TableRow><TableCell colSpan={classSchedules.length + 2} className="text-center py-8 text-muted-foreground">此班暫無學生</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">本月尚無訓練日期</p>
          </CardContent>
        </Card>
      )}

      {/* 圖例 */}
      <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
        <span><span className="font-bold text-green-700">1,2,3...</span> 累計出席堂數</span>
        <span><span className="text-red-400">✗</span> 缺席</span>
        <span className="text-gray-400">· 未記錄（點擊切換）</span>
        <span className="text-red-500 font-bold">【取消】</span><span className="text-sm"> 取消課堂</span>
        <span className="text-green-600 font-bold">【恢復】</span><span className="text-sm"> 恢復課堂</span>
      </div>
      <div className="flex gap-4 text-sm flex-wrap">
        <span className="text-muted-foreground">堂數顏色：</span>
        <span><span className="font-bold text-green-700">1-6</span> 正常</span>
        <span><span className="font-bold text-yellow-700">7-9</span> 接近完成</span>
        <span><span className="font-bold text-orange-600">10-12</span> 請通知家長繳下期費用 $2,400</span>
        <span>💰 需繳費</span>
      </div>
    </div>
  );
}

// ============ 財務管理 Tab ============
function EliteFinanceTab() {
  const utils = trpc.useUtils();
  const { data: students = [] } = trpc.elite.getStudents.useQuery();
  const { data: balances = [], isLoading } = trpc.elite.getAllBalances.useQuery();
  const { data: allPayments = [] } = trpc.elite.getPayments.useQuery({});
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ studentId: 0, classCount: "10", amount: "", notes: "" });
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const sendRemindersMutation = trpc.students.sendElitePaymentReminders.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePaymentMutation = trpc.elite.deletePayment.useMutation({
    onSuccess: () => {
      utils.elite.getPayments.invalidate();
      utils.elite.getAllBalances.invalidate();
      utils.elite.getAllCycleInfo.invalidate();
      setDeletePaymentTarget(null);
      setDeletePassword("");
      toast.success("繳費記錄已刪除");
    },
    onError: (e) => toast.error(e.message),
  });

  const createPaymentMutation = trpc.elite.createPayment.useMutation({
    onSuccess: () => {
      utils.elite.getPayments.invalidate();
      utils.elite.getAllBalances.invalidate();
      utils.elite.getStudents.invalidate();
      setShowAddPayment(false);
      toast.success("繳費記錄已新增");
    },
    onError: (e) => toast.error(e.message),
  });

  // 自動計算金額
  function handleStudentChange(studentId: string) {
    const sid = parseInt(studentId);
    const student = students.find((s: any) => s.id === sid);
    const classCount = parseInt(paymentForm.classCount) || 0;
    const feePerClass = student ? parseFloat(student.feePerClass) : 0;
    setPaymentForm(p => ({ ...p, studentId: sid, amount: String(feePerClass * classCount) }));
  }

  function handleClassCountChange(value: string) {
    const classCount = parseInt(value) || 0;
    const student = students.find((s: any) => s.id === paymentForm.studentId);
    const feePerClass = student ? parseFloat(student.feePerClass) : 0;
    setPaymentForm(p => ({ ...p, classCount: value, amount: String(feePerClass * classCount) }));
  }

  const totalRemaining = balances.reduce((sum: number, b: any) => sum + (b?.remainingClasses || 0), 0);
  const lowBalanceStudents = balances.filter((b: any) => b && b.remainingClasses <= 2);
  const totalAmountDue = balances.reduce((sum: number, b: any) => sum + (b?.amountDue || 0), 0);
  const studentsWithDue = balances.filter((b: any) => b && b.amountDue > 0);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">活躍學生</p>
            <p className="text-2xl font-bold">{balances.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">總剩餘堂數</p>
            <p className="text-2xl font-bold">{totalRemaining}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">應繳費用</p>
            <p className={`text-2xl font-bold ${totalAmountDue > 0 ? 'text-orange-600' : ''}`}>${totalAmountDue.toLocaleString()}</p>
            {studentsWithDue.length > 0 && <p className="text-xs text-muted-foreground">{studentsWithDue.length} 位學生</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">總收入</p>
            <p className="text-2xl font-bold">${balances.reduce((sum: number, b: any) => sum + (b?.totalPaid || 0), 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 操作按鈕 */}
      <div className="flex justify-end gap-2">
        {lowBalanceStudents.length > 0 && (
          <Button
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={() => sendRemindersMutation.mutate()}
            disabled={sendRemindersMutation.isPending}
          >
            {sendRemindersMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />發送中...</>
            ) : (
              <><WhatsAppIcon className="h-4 w-4 mr-1" />批量通知繳費 ({lowBalanceStudents.length}人)</>
            )}
          </Button>
        )}
        <Button onClick={() => { setPaymentForm({ studentId: 0, classCount: "10", amount: "", notes: "" }); setShowAddPayment(true); }}>
          <Plus className="h-4 w-4 mr-1" />新增繳費
        </Button>
      </div>

      {/* 學生堂數餘額表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">學生堂數餘額</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead className="text-center">已繳堂數</TableHead>
                  <TableHead className="text-center">已上堂數</TableHead>
                  <TableHead className="text-center">剩餘堂數</TableHead>
                  <TableHead className="text-right">應繳費用</TableHead>
                  <TableHead className="text-right">累計繳費</TableHead>
                  <TableHead className="text-center">通知</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...balances].sort((a: any, b: any) => (b?.amountDue || 0) - (a?.amountDue || 0) || (a?.remainingClasses || 0) - (b?.remainingClasses || 0)).map((b: any) => b && (
                  <TableRow key={b.studentId} className={b.amountDue > 0 ? "bg-orange-50" : b.remainingClasses <= 0 ? "bg-red-50" : b.remainingClasses <= 2 ? "bg-yellow-50" : ""}>
                    <TableCell className="font-medium">{b.studentName}</TableCell>
                    <TableCell className="text-center">{b.paidClasses}</TableCell>
                    <TableCell className="text-center">{b.attendedClasses}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={b.remainingClasses > 4 ? "default" : b.remainingClasses > 0 ? "secondary" : "destructive"}>
                        {b.remainingClasses} 堂
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {b.amountDue > 0 ? (
                        <span className="font-semibold text-orange-600">
                          ${b.amountDue.toLocaleString()}
                          {b.owedPeriods > 1 && <span className="text-xs ml-1">({b.owedPeriods}期)</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">${b.totalPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const student = students.find((s: any) => s.id === b.studentId);
                        return (
                          <EliteWhatsAppButton
                            studentId={b.studentId}
                            studentName={b.studentName}
                            studentPhone={student?.phone || ''}
                            remainingClasses={b.remainingClasses}
                            paidClasses={b.paidClasses}
                            attendedClasses={b.attendedClasses}
                            feePerClass={student?.feePerClass || '200'}
                            size="sm"
                            variant="ghost"
                            showLabel={true}
                          />
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {balances.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暫無資料</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 最近繳費記錄 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">最近繳費記錄</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>學生</TableHead>
                  <TableHead className="text-center">堂數</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>來源</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-[60px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.slice(0, 20).map((p: any) => {
                  const student = students.find((s: any) => s.id === p.studentId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDayMonthYear(p.paymentDate)}</TableCell>
                      <TableCell className="font-medium">{student?.name || `#${p.studentId}`}</TableCell>
                      <TableCell className="text-center">{p.classCount} 堂</TableCell>
                      <TableCell className="text-right">${Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.confirmedBy === "parent_upload" ? "家長上傳" : "管理員批准"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.notes || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletePaymentTarget({ id: p.id, studentName: student?.name || `#${p.studentId}`, amount: p.amount, classCount: p.classCount })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {allPayments.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暫無繳費記錄</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新增繳費對話框 */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增繳費記錄</DialogTitle>
            <DialogDescription>記錄精英班學生的繳費</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>學生 *</Label>
              <Select value={paymentForm.studentId ? String(paymentForm.studentId) : ""} onValueChange={handleStudentChange}>
                <SelectTrigger><SelectValue placeholder="選擇學生" /></SelectTrigger>
                <SelectContent>
                  {students.filter((s: any) => s.status === "active").map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} (${s.feePerClass}/堂)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>購買堂數 *</Label><Input type="number" value={paymentForm.classCount} onChange={(e) => handleClassCountChange(e.target.value)} /></div>
              <div><Label>金額 ($)</Label><Input value={paymentForm.amount} onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
            </div>
            <div><Label>備註</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPayment(false)}>取消</Button>
            <Button
              disabled={!paymentForm.studentId || !paymentForm.classCount || createPaymentMutation.isPending}
              onClick={() => {
                createPaymentMutation.mutate({
                  studentId: paymentForm.studentId,
                  classCount: parseInt(paymentForm.classCount),
                  amount: paymentForm.amount || "0",
                  paymentDate: new Date(),
                  confirmedBy: "admin_approved",
                  notes: paymentForm.notes || undefined,
                });
              }}
            >
              {createPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}確認繳費
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除繳費確認對話框 */}
      <AlertDialog open={!!deletePaymentTarget} onOpenChange={(open) => { if (!open) { setDeletePaymentTarget(null); setDeletePassword(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除繳費記錄</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除 <strong>{deletePaymentTarget?.studentName}</strong> 的繳費記錄嗎？
              <br />金額：<strong>${Number(deletePaymentTarget?.amount || 0).toLocaleString()}</strong>，堂數：<strong>{deletePaymentTarget?.classCount}</strong> 堂
              <br />關聯的會計記錄和日記帳分錄也會一併刪除。此操作無法恢復。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label>管理員密碼 *</Label>
            <Input
              type="password"
              placeholder="輸入管理員密碼確認"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deletePassword && deletePaymentTarget) {
                  deletePaymentMutation.mutate({ paymentId: deletePaymentTarget.id, adminPassword: deletePassword });
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletePaymentTarget(null); setDeletePassword(""); }}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deletePassword || deletePaymentMutation.isPending}
              onClick={() => {
                if (deletePaymentTarget && deletePassword) {
                  deletePaymentMutation.mutate({ paymentId: deletePaymentTarget.id, adminPassword: deletePassword });
                }
              }}
            >
              {deletePaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ 主頁面 ============
export default function EliteManagement() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="mb-4">請先以管理員身份登入</p>
            <Button onClick={() => window.location.href = getLoginUrl()}>登入</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">🥋 精英班管理</h1>
              <p className="text-xs text-muted-foreground">Elite Class Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)}>修改密碼</Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container px-4 md:px-8 py-6">
        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="students" className="flex items-center gap-1"><Users className="h-4 w-4" />學生管理</TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1"><Calendar className="h-4 w-4" />點名表</TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-1"><DollarSign className="h-4 w-4" />財務管理</TabsTrigger>
          </TabsList>

          <TabsContent value="students"><EliteStudentsTab /></TabsContent>
          <TabsContent value="attendance"><EliteHistory /></TabsContent>
          <TabsContent value="finance"><EliteFinanceTab /></TabsContent>
        </Tabs>
      </div>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        userType="admin"
        phone={user.phone || ""}
      />
    </div>
  );
}
