import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit, Users, Award, ClipboardCheck,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  ArrowUpCircle, FileText, Loader2, BarChart3, Star
} from "lucide-react";

// 帶級定義
const BELT_LEVELS = [
  { key: "白帶", name: "白帶", color: "#FFFFFF", border: "#ccc" },
  { key: "黃帶", name: "黃帶", color: "#FFD700", border: "#DAA520" },
  { key: "黃綠帶", name: "黃綠帶", color: "#9ACD32", border: "#6B8E23" },
  { key: "綠帶", name: "綠帶", color: "#228B22", border: "#006400" },
  { key: "綠藍帶", name: "綠藍帶", color: "#20B2AA", border: "#008B8B" },
  { key: "藍帶", name: "藍帶", color: "#4169E1", border: "#1E3A8A" },
  { key: "藍紅帶", name: "藍紅帶", color: "#8B008B", border: "#4B0082" },
  { key: "紅帶", name: "紅帶", color: "#DC143C", border: "#8B0000" },
  { key: "紅黑帶", name: "紅黑帶", color: "#8B0000", border: "#000" },
  { key: "黑帶", name: "黑帶", color: "#000000", border: "#333" },
  { key: "黑帶二段", name: "黑帶二段", color: "#000000", border: "#333" },
  { key: "黑帶三段", name: "黑帶三段", color: "#000000", border: "#333" },
];

// 評分類別顏色
const CATEGORY_COLORS: Record<string, string> = {
  fitness: "bg-blue-100 text-blue-700",
  poomsae: "bg-purple-100 text-purple-700",
  technique: "bg-green-100 text-green-700",
  board: "bg-amber-100 text-amber-700",
  split: "bg-pink-100 text-pink-700",
  side_split: "bg-pink-50 text-pink-600",
  sparring: "bg-red-100 text-red-700",
  competition: "bg-indigo-100 text-indigo-700",
};

const CATEGORY_NAMES: Record<string, string> = {
  fitness: "體能", poomsae: "品勢", technique: "手把動作",
  board: "踢木板", split: "一字馬", side_split: "大字馬",
  sparring: "搏擊", competition: "外出比賽",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: FileText },
  scheduled: { label: "已排程", color: "bg-blue-100 text-blue-700", icon: ClipboardCheck },
  in_progress: { label: "進行中", color: "bg-yellow-100 text-yellow-700", icon: Loader2 },
  completed: { label: "已完成", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const CANDIDATE_STATUS: Record<string, { label: string; color: string }> = {
  registered: { label: "已報名", color: "bg-gray-100 text-gray-600" },
  checked_in: { label: "已報到", color: "bg-blue-100 text-blue-600" },
  examining: { label: "評分中", color: "bg-yellow-100 text-yellow-600" },
  passed: { label: "合格 ✓", color: "bg-green-100 text-green-700" },
  failed: { label: "不合格 ✗", color: "bg-red-100 text-red-700" },
  absent: { label: "缺席", color: "bg-gray-200 text-gray-500" },
};

type View = "list" | "detail" | "scoring";

export default function ExamManagement() {
  const [view, setView] = useState<View>("list");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [showCreateExam, setShowCreateExam] = useState(false);

  return (
    <div className="space-y-4">
      {view === "list" && (
        <ExamList
          onSelectExam={(id) => { setSelectedExamId(id); setView("detail"); }}
          showCreate={showCreateExam}
          setShowCreate={setShowCreateExam}
        />
      )}
      {view === "detail" && selectedExamId && (
        <ExamDetail
          examId={selectedExamId}
          onBack={() => setView("list")}
          onStartScoring={(candidateId) => { setSelectedCandidateId(candidateId); setView("scoring"); }}
        />
      )}
      {view === "scoring" && selectedExamId && selectedCandidateId && (
        <ScoringView
          examId={selectedExamId}
          candidateId={selectedCandidateId}
          onBack={() => setView("detail")}
        />
      )}
    </div>
  );
}

// ==================== 考試列表 ====================
function ExamList({ onSelectExam, showCreate, setShowCreate }: {
  onSelectExam: (id: number) => void;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
}) {
  const { data: exams, refetch } = trpc.exam.list.useQuery();
  const createExam = trpc.exam.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); toast.success("考試已創建"); } });
  const deleteExam = trpc.exam.delete.useMutation({ onSuccess: () => { refetch(); toast.success("已刪除"); } });

  const [form, setForm] = useState({ name: "", examDate: "", location: "", description: "" });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-red-600" /> 考試管理
        </h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> 新增考試
        </Button>
      </div>

      {showCreate && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="考試名稱 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input type="date" value={form.examDate} onChange={e => setForm({ ...form, examDate: e.target.value })} />
            <Input placeholder="地點" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!form.name || !form.examDate) { toast.error("請填寫名稱和日期"); return; }
              createExam.mutate({ name: form.name, examDate: new Date(form.examDate), location: form.location || undefined, description: form.description || undefined });
            }} disabled={createExam.isPending}>
              {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} 確認
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
          </div>
        </div>
      )}

      {exams && exams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>尚無考試記錄</p>
        </div>
      )}

      <div className="space-y-2">
        {exams?.map((exam: any) => {
          const st = STATUS_CONFIG[exam.status] || STATUS_CONFIG.draft;
          const Icon = st.icon;
          return (
            <div key={exam.id} className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              onClick={() => onSelectExam(exam.id)}>
              <div className="flex items-center gap-3">
                <div className={`px-2 py-1 rounded text-xs font-medium ${st.color}`}>
                  <Icon className="w-3 h-3 inline mr-1" /> {st.label}
                </div>
                <div>
                  <div className="font-medium">{exam.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(exam.examDate).toLocaleDateString('zh-TW')}
                    {exam.location && ` · ${exam.location}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); if (confirm("確定刪除？")) deleteExam.mutate({ id: exam.id }); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 考試詳情 ====================
function ExamDetail({ examId, onBack, onStartScoring }: {
  examId: number;
  onBack: () => void;
  onStartScoring: (candidateId: number) => void;
}) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const { data: allStudents } = trpc.students.getAll.useQuery();
  const { data: allEvents } = trpc.events.getAll.useQuery();

  const updateExam = trpc.exam.update.useMutation({ onSuccess: () => toast.success("狀態已更新") });
  const createCandidate = trpc.exam.candidates.create.useMutation({ onSuccess: () => { refetchCandidates(); toast.success("已新增考生"); } });
  const deleteCandidate = trpc.exam.candidates.delete.useMutation({ onSuccess: () => { refetchCandidates(); toast.success("已刪除"); } });
  const importFromEvent = trpc.exam.candidates.importFromEvent.useMutation({ onSuccess: (d: any) => { refetchCandidates(); toast.success(`已導入 ${d.imported} 位考生`); } });
  const promoteAll = trpc.exam.promoteAll.useMutation({ onSuccess: (d: any) => { refetchCandidates(); toast.success(`已升帶 ${d.promoted} 位學生`); } });
  const initScoring = trpc.exam.scoringItems.initForBelt.useMutation({ onSuccess: (d: any) => toast.success(`已初始化 ${d.count} 個評分項目`) });

  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: "", name: "", phone: "", currentBelt: "白帶", targetBelt: "黃帶", gender: "male" as "male" | "female" });
  const [filterBelt, setFilterBelt] = useState<string>("all");
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // 過濾考生
  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    if (filterBelt === "all") return candidates;
    return candidates.filter((c: any) => c.currentBelt === filterBelt);
  }, [candidates, filterBelt]);

  // 取得帶級統計
  const beltStats = useMemo(() => {
    if (!candidates) return {};
    const map: Record<string, number> = {};
    candidates.forEach((c: any) => { map[c.currentBelt] = (map[c.currentBelt] || 0) + 1; });
    return map;
  }, [candidates]);

  // 選擇學生時自動填入
  const handleSelectStudent = (studentId: string) => {
    const student = allStudents?.find((s: any) => s.id === parseInt(studentId));
    if (student) {
      const belt = student.beltLevel || "白帶";
      const UPGRADE: Record<string, string> = { '白帶':'黃帶','黃帶':'黃綠帶','黃綠帶':'綠帶','綠帶':'綠藍帶','綠藍帶':'藍帶','藍帶':'藍紅帶','藍紅帶':'紅帶','紅帶':'紅黑帶','紅黑帶':'黑帶','黑帶':'黑帶二段','黑帶二段':'黑帶三段' };
      setAddForm({
        studentId: studentId,
        name: student.name,
        phone: student.phone || "",
        currentBelt: belt,
        targetBelt: UPGRADE[belt] || "黃帶",
        gender: "male",
      });
    }
  };

  // 考試中用到的帶級列表
  const usedBelts = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    const belts = new Set(candidates.map((c: any) => c.currentBelt));
    return BELT_LEVELS.filter(b => belts.has(b.key));
  }, [candidates]);

  // 考試相關的活動（type = exam）
  const examEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents.filter((e: any) => e.type === 'exam');
  }, [allEvents]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>← 返回</Button>
        <h2 className="text-lg font-bold">{exam?.name || "載入中..."}</h2>
        {exam && (
          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CONFIG[exam.status]?.color}`}>
            {STATUS_CONFIG[exam.status]?.label}
          </span>
        )}
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-xs text-gray-500">總人數</div>
            <div className="text-lg font-bold">{stats.total}</div>
          </div>
          <div className="bg-green-50 rounded p-2 text-center">
            <div className="text-xs text-green-600">合格</div>
            <div className="text-lg font-bold text-green-700">{stats.passed}</div>
          </div>
          <div className="bg-red-50 rounded p-2 text-center">
            <div className="text-xs text-red-600">不合格</div>
            <div className="text-lg font-bold text-red-700">{stats.failed}</div>
          </div>
          <div className="bg-yellow-50 rounded p-2 text-center">
            <div className="text-xs text-yellow-600">評分中</div>
            <div className="text-lg font-bold text-yellow-700">{stats.examining}</div>
          </div>
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-xs text-gray-500">待考</div>
            <div className="text-lg font-bold">{stats.registered}</div>
          </div>
          <div className="bg-amber-50 rounded p-2 text-center">
            <div className="text-xs text-amber-600">叻叻獎</div>
            <div className="text-lg font-bold text-amber-700">{stats.lakLakCount}</div>
          </div>
        </div>
      )}

      {/* 操作區 */}
      <div className="flex flex-wrap gap-2">
        <Select value={exam?.status || 'draft'} onValueChange={(v) => updateExam.mutate({ id: examId, status: v as any })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="scheduled">已排程</SelectItem>
            <SelectItem value="in_progress">進行中</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={() => setShowAddCandidate(!showAddCandidate)}>
          <Plus className="w-3 h-3 mr-1" /> 新增考生
        </Button>

        {examEvents.length > 0 && (
          <div className="flex items-center gap-1">
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="選擇活動..." /></SelectTrigger>
              <SelectContent>
                {examEvents.map((e: any) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs"
              disabled={!selectedEventId || importFromEvent.isPending}
              onClick={() => importFromEvent.mutate({ examId, eventId: parseInt(selectedEventId) })}>
              {importFromEvent.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "導入報名"}
            </Button>
          </div>
        )}

        {/* 初始化評分項目 */}
        {usedBelts.map(b => (
          <Button key={b.key} size="sm" variant="outline" className="h-8 text-xs"
            onClick={() => initScoring.mutate({ beltLevel: b.key })}>
            初始化 {b.name} 評分
          </Button>
        ))}

        {exam?.status === 'completed' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
            onClick={() => { if (confirm("確定要批量升帶所有合格考生？")) promoteAll.mutate({ examId }); }}>
            <ArrowUpCircle className="w-3 h-3 mr-1" /> 批量升帶
          </Button>
        )}
      </div>

      {/* 新增考生 */}
      {showAddCandidate && (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="text-sm font-medium">新增考生</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={addForm.studentId} onValueChange={handleSelectStudent}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="選擇學生（可選）" /></SelectTrigger>
              <SelectContent>
                {allStudents?.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.beltLevel || '未設定'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="h-8 text-xs" placeholder="姓名 *" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="電話" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
            <Select value={addForm.currentBelt} onValueChange={v => {
              const UPGRADE: Record<string, string> = { '白帶':'黃帶','黃帶':'黃綠帶','黃綠帶':'綠帶','綠帶':'綠藍帶','綠藍帶':'藍帶','藍帶':'藍紅帶','藍紅帶':'紅帶','紅帶':'紅黑帶','紅黑帶':'黑帶','黑帶':'黑帶二段','黑帶二段':'黑帶三段' };
              setAddForm({ ...addForm, currentBelt: v, targetBelt: UPGRADE[v] || v });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BELT_LEVELS.map(b => (<SelectItem key={b.key} value={b.key}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={addForm.targetBelt} onValueChange={v => setAddForm({ ...addForm, targetBelt: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BELT_LEVELS.map(b => (<SelectItem key={b.key} value={b.key}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={addForm.gender} onValueChange={(v: any) => setAddForm({ ...addForm, gender: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男</SelectItem>
                <SelectItem value="female">女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => {
              if (!addForm.name) { toast.error("請輸入姓名"); return; }
              createCandidate.mutate({
                examId,
                studentId: addForm.studentId ? parseInt(addForm.studentId) : undefined,
                name: addForm.name,
                phone: addForm.phone || undefined,
                gender: addForm.gender,
                currentBelt: addForm.currentBelt,
                targetBelt: addForm.targetBelt,
              });
              setAddForm({ studentId: "", name: "", phone: "", currentBelt: "白帶", targetBelt: "黃帶", gender: "male" });
            }}>確認</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddCandidate(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 帶級過濾 */}
      <div className="flex flex-wrap gap-1">
        <button className={`px-2 py-1 rounded text-xs ${filterBelt === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
          onClick={() => setFilterBelt("all")}>全部 ({candidates?.length || 0})</button>
        {Object.entries(beltStats).map(([belt, count]) => (
          <button key={belt} className={`px-2 py-1 rounded text-xs ${filterBelt === belt ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
            onClick={() => setFilterBelt(belt)}>{belt} ({count})</button>
        ))}
      </div>

      {/* 考生列表 */}
      <div className="space-y-1">
        {filteredCandidates.map((c: any) => {
          const st = CANDIDATE_STATUS[c.status] || CANDIDATE_STATUS.registered;
          const beltDef = BELT_LEVELS.find(b => b.key === c.currentBelt);
          return (
            <div key={c.id} className="border rounded-lg p-2 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                  style={{ backgroundColor: beltDef?.color || '#ccc', borderColor: beltDef?.border || '#999' }} />
                <div>
                  <div className="font-medium text-sm flex items-center gap-1">
                    {c.name}
                    {c.hasLakLakAward && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.currentBelt} → {c.targetBelt}
                    {c.groupCode && ` · ${c.groupCode}組`}
                    {c.phone && ` · ${c.phone}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs ${st.color}`}>{st.label}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => onStartScoring(c.id)}>
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                  onClick={() => { if (confirm(`刪除考生 ${c.name}？`)) deleteCandidate.mutate({ id: c.id }); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 評分頁面 ====================
function ScoringView({ examId, candidateId, onBack }: {
  examId: number;
  candidateId: number;
  onBack: () => void;
}) {
  const { data: candidate } = trpc.exam.candidates.get.useQuery({ id: candidateId });
  const { data: scoringItems } = trpc.exam.scoringItems.listByBelt.useQuery(
    { beltLevel: candidate?.currentBelt || "" },
    { enabled: !!candidate?.currentBelt }
  );
  const { data: existingScores, refetch: refetchScores } = trpc.exam.scores.getByCandidate.useQuery({ candidateId });
  const bulkUpsert = trpc.exam.scores.bulkUpsert.useMutation({
    onSuccess: () => { refetchScores(); toast.success("評分已儲存"); },
  });
  const promote = trpc.exam.promote.useMutation({
    onSuccess: (d: any) => {
      if (d.success) toast.success(`已升帶至 ${d.newBelt}`);
      else toast.error("升帶失敗（學生可能未關聯）");
    },
  });

  const [localScores, setLocalScores] = useState<Record<number, string>>({});

  // 合併已有評分
  const getScore = (itemId: number): string => {
    if (localScores[itemId] !== undefined) return localScores[itemId];
    const existing = existingScores?.find((s: any) => s.item.id === itemId);
    return existing?.score?.score || "";
  };

  const setScore = (itemId: number, value: string) => {
    setLocalScores(prev => ({ ...prev, [itemId]: value }));
  };

  const handleSaveAll = () => {
    if (!scoringItems) return;
    const scores = scoringItems.map((item: any) => ({
      scoringItemId: item.id,
      score: getScore(item.id),
    })).filter((s: any) => s.score !== "");
    if (scores.length === 0) { toast.error("請至少評一項分"); return; }
    bulkUpsert.mutate({ candidateId, scores });
  };

  // 按分類分組評分項目
  const groupedItems = useMemo(() => {
    if (!scoringItems) return {};
    const groups: Record<string, any[]> = {};
    scoringItems.forEach((item: any) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [scoringItems]);

  const beltDef = BELT_LEVELS.find(b => b.key === candidate?.currentBelt);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>← 返回</Button>
        <div className="w-5 h-5 rounded-full border-2 flex-shrink-0"
          style={{ backgroundColor: beltDef?.color || '#ccc', borderColor: beltDef?.border || '#999' }} />
        <h2 className="text-lg font-bold">{candidate?.name}</h2>
        <span className="text-sm text-gray-500">{candidate?.currentBelt} → {candidate?.targetBelt}</span>
        {candidate && (
          <span className={`px-2 py-0.5 rounded text-xs ${CANDIDATE_STATUS[candidate.status]?.color}`}>
            {CANDIDATE_STATUS[candidate.status]?.label}
          </span>
        )}
      </div>

      {/* 評分區域 */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="border rounded-lg overflow-hidden">
          <div className={`px-3 py-2 text-sm font-medium ${CATEGORY_COLORS[category] || 'bg-gray-100'}`}>
            {CATEGORY_NAMES[category] || category}
          </div>
          <div className="divide-y">
            {items.map((item: any) => (
              <div key={item.id} className="p-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                </div>
                <div className="flex items-center gap-1">
                  {item.type === 'grade' && (
                    <>
                      {["A", "B", "C", "不合格"].map(grade => (
                        <button key={grade}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                            getScore(item.id) === grade
                              ? grade === "不合格" ? "bg-red-500 text-white border-red-500" :
                                grade === "A" ? "bg-green-500 text-white border-green-500" :
                                grade === "B" ? "bg-blue-500 text-white border-blue-500" :
                                "bg-yellow-500 text-white border-yellow-500"
                              : "bg-white hover:bg-gray-100 border-gray-300"
                          }`}
                          onClick={() => setScore(item.id, grade)}>
                          {grade}
                        </button>
                      ))}
                    </>
                  )}
                  {item.type === 'pass_fail' && (
                    <>
                      <button className={`px-3 py-1 rounded text-xs font-medium border ${getScore(item.id) === '合格' ? 'bg-green-500 text-white' : 'bg-white border-gray-300'}`}
                        onClick={() => setScore(item.id, '合格')}>合格</button>
                      <button className={`px-3 py-1 rounded text-xs font-medium border ${getScore(item.id) === '不合格' ? 'bg-red-500 text-white' : 'bg-white border-gray-300'}`}
                        onClick={() => setScore(item.id, '不合格')}>不合格</button>
                    </>
                  )}
                  {item.type === 'yes_no' && (
                    <>
                      <button className={`px-3 py-1 rounded text-xs font-medium border ${getScore(item.id) === '有' ? 'bg-green-500 text-white' : 'bg-white border-gray-300'}`}
                        onClick={() => setScore(item.id, '有')}>有</button>
                      <button className={`px-3 py-1 rounded text-xs font-medium border ${getScore(item.id) === '沒有' ? 'bg-red-500 text-white' : 'bg-white border-gray-300'}`}
                        onClick={() => setScore(item.id, '沒有')}>沒有</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {scoringItems && scoringItems.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">尚未初始化此帶級的評分項目</p>
          <p className="text-xs mt-1">請返回考試詳情頁面，點擊「初始化 {candidate?.currentBelt} 評分」</p>
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex gap-2 sticky bottom-0 bg-white py-3 border-t">
        <Button onClick={handleSaveAll} disabled={bulkUpsert.isPending} className="flex-1">
          {bulkUpsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
          儲存評分
        </Button>
        {candidate?.status === 'passed' && candidate?.studentId && (
          <Button variant="outline" className="border-green-500 text-green-700"
            onClick={() => promote.mutate({ candidateId })}>
            <ArrowUpCircle className="w-4 h-4 mr-1" /> 升帶
          </Button>
        )}
      </div>
    </div>
  );
}
