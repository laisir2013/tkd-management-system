import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Award, Plus, Trash2, Edit3, Users, ClipboardCheck, Trophy, 
  ChevronDown, ChevronUp, ArrowUpCircle, Loader2, CheckCircle2,
  XCircle, AlertCircle, FileText, Upload, UserPlus
} from "lucide-react";
import { toast } from "sonner";

// 帶級定義
const BELT_LEVELS: Record<string, { name: string; color: string; textColor: string }> = {
  '白帶': { name: '白帶', color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700' },
  '黃帶': { name: '黃帶', color: 'bg-yellow-100 border-yellow-400', textColor: 'text-yellow-700' },
  '黃綠帶': { name: '黃綠帶', color: 'bg-lime-100 border-lime-400', textColor: 'text-lime-700' },
  '綠帶': { name: '綠帶', color: 'bg-green-100 border-green-400', textColor: 'text-green-700' },
  '綠藍帶': { name: '綠藍帶', color: 'bg-teal-100 border-teal-400', textColor: 'text-teal-700' },
  '藍帶': { name: '藍帶', color: 'bg-blue-100 border-blue-400', textColor: 'text-blue-700' },
  '藍紅帶': { name: '藍紅帶', color: 'bg-purple-100 border-purple-400', textColor: 'text-purple-700' },
  '紅帶': { name: '紅帶', color: 'bg-red-100 border-red-400', textColor: 'text-red-700' },
  '紅黑帶': { name: '紅黑帶', color: 'bg-rose-100 border-rose-800', textColor: 'text-rose-800' },
  '黑帶': { name: '黑帶', color: 'bg-gray-800 border-gray-900', textColor: 'text-white' },
  '黑帶二段': { name: '黑帶二段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white' },
  '黑帶三段': { name: '黑帶三段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white' },
};

const BELT_ORDER = ['白帶','黃帶','黃綠帶','綠帶','綠藍帶','藍帶','藍紅帶','紅帶','紅黑帶','黑帶','黑帶二段','黑帶三段'];

function getBeltBadge(belt: string) {
  const info = BELT_LEVELS[belt] || { color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${info.color} ${info.textColor}`}>
      {belt}
    </span>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  registered: { label: '已報名', color: 'text-gray-500', icon: FileText },
  checked_in: { label: '已報到', color: 'text-blue-500', icon: CheckCircle2 },
  examining: { label: '評分中', color: 'text-yellow-600', icon: ClipboardCheck },
  passed: { label: '合格', color: 'text-green-600', icon: Trophy },
  failed: { label: '不合格', color: 'text-red-600', icon: XCircle },
  absent: { label: '缺席', color: 'text-gray-400', icon: AlertCircle },
};

const EXAM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  scheduled: { label: '已排程', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '進行中', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
};

// 評分等級
const GRADE_OPTIONS = ['A', 'B', 'C', '不合格'] as const;
const PASS_FAIL_OPTIONS = ['合格', '不合格'] as const;
const YES_NO_OPTIONS = ['有', '沒有'] as const;

export default function ExamManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [detailTab, setDetailTab] = useState<'candidates' | 'scoring' | 'results'>('candidates');

  return (
    <div className="space-y-4">
      {activeTab === 'list' ? (
        <ExamList 
          onSelectExam={(id) => { setSelectedExamId(id); setActiveTab('detail'); }}
          showCreateForm={showCreateForm}
          setShowCreateForm={setShowCreateForm}
        />
      ) : selectedExamId ? (
        <ExamDetail 
          examId={selectedExamId} 
          onBack={() => setActiveTab('list')}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
        />
      ) : null}
    </div>
  );
}

// ==================== 考試列表 ====================
function ExamList({ onSelectExam, showCreateForm, setShowCreateForm }: {
  onSelectExam: (id: number) => void;
  showCreateForm: boolean;
  setShowCreateForm: (v: boolean) => void;
}) {
  const { data: exams, refetch } = trpc.exam.list.useQuery();
  const createExam = trpc.exam.create.useMutation({ onSuccess: () => { refetch(); setShowCreateForm(false); toast.success('考試已建立'); } });
  const deleteExam = trpc.exam.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });

  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [location, setLocation] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-red-600" />
          考試管理
        </h2>
        <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> 新增考試
        </Button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">建立新考試</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="考試名稱（如：2025年3月升帶考試）" value={name} onChange={e => setName(e.target.value)} />
            <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
            <Input placeholder="地點" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!name || !examDate) { toast.error('請填寫名稱和日期'); return; }
              createExam.mutate({ name, examDate: new Date(examDate), location: location || undefined });
            }} disabled={createExam.isPending}>
              {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '建立'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(!exams || exams.length === 0) ? (
          <div className="text-center text-gray-400 py-8">
            <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>尚無考試記錄</p>
          </div>
        ) : exams.map((exam: any) => {
          const statusInfo = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
          return (
            <div key={exam.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectExam(exam.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base">{exam.name}</h3>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                    <span>📅 {new Date(exam.examDate).toLocaleDateString('zh-TW')}</span>
                    {exam.location && <span>📍 {exam.location}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                    onClick={(e) => { e.stopPropagation(); if (confirm('確定刪除此考試？')) deleteExam.mutate({ id: exam.id }); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 考試詳情 ====================
function ExamDetail({ examId, onBack, detailTab, setDetailTab }: {
  examId: number;
  onBack: () => void;
  detailTab: 'candidates' | 'scoring' | 'results';
  setDetailTab: (t: 'candidates' | 'scoring' | 'results') => void;
}) {
  const { data: exam, refetch: refetchExam } = trpc.exam.get.useQuery({ id: examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const updateExam = trpc.exam.update.useMutation({ onSuccess: () => { refetchExam(); toast.success('已更新'); } });

  if (!exam) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const statusInfo = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>← 返回</Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{exam.name}</h2>
          <div className="text-sm text-gray-500 flex items-center gap-3">
            <span>📅 {new Date(exam.examDate).toLocaleDateString('zh-TW')}</span>
            {exam.location && <span>📍 {exam.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          {/* Status change buttons */}
          {exam.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => updateExam.mutate({ id: examId, status: 'scheduled' })}>
              排程
            </Button>
          )}
          {exam.status === 'scheduled' && (
            <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" 
              onClick={() => updateExam.mutate({ id: examId, status: 'in_progress' })}>
              開始考試
            </Button>
          )}
          {exam.status === 'in_progress' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => updateExam.mutate({ id: examId, status: 'completed' })}>
              完成考試
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCard label="總人數" value={stats.total} color="text-gray-700" />
          <StatCard label="合格" value={stats.passed} color="text-green-600" />
          <StatCard label="不合格" value={stats.failed} color="text-red-600" />
          <StatCard label="評分中" value={stats.examining} color="text-yellow-600" />
          <StatCard label="缺席" value={stats.absent} color="text-gray-400" />
          <StatCard label="叻叻獎" value={stats.lakLakCount} color="text-amber-500" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'candidates' as const, label: '考生管理', icon: Users },
          { key: 'scoring' as const, label: '評分', icon: ClipboardCheck },
          { key: 'results' as const, label: '成績/升帶', icon: Trophy },
        ].map(tab => (
          <button key={tab.key}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              detailTab === tab.key ? 'bg-white shadow text-red-700' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setDetailTab(tab.key)}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {detailTab === 'candidates' && <CandidateManagement examId={examId} />}
      {detailTab === 'scoring' && <ScoringPanel examId={examId} />}
      {detailTab === 'results' && <ResultsPanel examId={examId} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ==================== 考生管理 ====================
function CandidateManagement({ examId }: { examId: number }) {
  const { data: candidates, refetch } = trpc.exam.candidates.list.useQuery({ examId });
  const createCandidate = trpc.exam.candidates.create.useMutation({ onSuccess: () => { refetch(); toast.success('已新增考生'); } });
  const deleteCandidate = trpc.exam.candidates.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });
  const importFromEvent = trpc.exam.candidates.importFromEvent.useMutation({ 
    onSuccess: (data) => { refetch(); toast.success(`已匯入 ${data.imported} 位考生`); } 
  });
  
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addCurrentBelt, setAddCurrentBelt] = useState('白帶');
  const [addTargetBelt, setAddTargetBelt] = useState('黃帶');
  const [showImport, setShowImport] = useState(false);

  // 從活動匯入 - 取得所有考試類型活動
  const { data: allEvents } = trpc.events.getAll.useQuery({ type: 'exam' });

  // 按帶級分組
  const grouped = candidates ? candidates.reduce((acc: Record<string, any[]>, c: any) => {
    const belt = c.currentBelt || '未知';
    if (!acc[belt]) acc[belt] = [];
    acc[belt].push(c);
    return acc;
  }, {}) : {};

  const sortedBelts = Object.keys(grouped).sort((a, b) => {
    const ia = BELT_ORDER.indexOf(a);
    const ib = BELT_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="w-4 h-4 mr-1" /> 新增考生
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}>
          <Upload className="w-4 h-4 mr-1" /> 從活動匯入
        </Button>
        <span className="text-sm text-gray-500">共 {candidates?.length || 0} 位考生</span>
      </div>

      {/* 從活動匯入 */}
      {showImport && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
          <p className="text-sm font-medium text-blue-700">選擇考試活動匯入報名學生：</p>
          {allEvents && allEvents.length > 0 ? (
            <div className="space-y-1">
              {allEvents.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between bg-white rounded p-2">
                  <span className="text-sm">{ev.title} ({new Date(ev.eventDate).toLocaleDateString('zh-TW')})</span>
                  <Button size="sm" variant="outline" 
                    onClick={() => importFromEvent.mutate({ examId, eventId: ev.id })}
                    disabled={importFromEvent.isPending}>
                    {importFromEvent.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '匯入'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">沒有考試類型的活動</p>
          )}
        </div>
      )}

      {/* 新增表單 */}
      {showAdd && (
        <div className="bg-white rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input placeholder="姓名" value={addName} onChange={e => setAddName(e.target.value)} />
            <Input placeholder="電話" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            <select value={addCurrentBelt} onChange={e => {
              setAddCurrentBelt(e.target.value);
              const nextIdx = BELT_ORDER.indexOf(e.target.value) + 1;
              setAddTargetBelt(BELT_ORDER[nextIdx] || e.target.value);
            }} className="border rounded-md px-2 py-1 text-sm">
              {BELT_ORDER.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={addTargetBelt} onChange={e => setAddTargetBelt(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
              {BELT_ORDER.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!addName) { toast.error('請填寫姓名'); return; }
              createCandidate.mutate({ examId, name: addName, phone: addPhone || undefined, currentBelt: addCurrentBelt, targetBelt: addTargetBelt });
              setAddName(''); setAddPhone('');
            }} disabled={createCandidate.isPending}>
              新增
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 考生列表（按帶級分組） */}
      {sortedBelts.map(belt => (
        <div key={belt} className="space-y-1">
          <div className="flex items-center gap-2 py-1">
            {getBeltBadge(belt)}
            <span className="text-xs text-gray-500">({grouped[belt].length}人)</span>
          </div>
          <div className="bg-white rounded-lg border divide-y">
            {grouped[belt].map((c: any) => {
              const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.registered;
              const StatusIcon = statusCfg.icon;
              return (
                <div key={c.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                    <span className="text-xs text-gray-400">→ {c.targetBelt}</span>
                    {c.hasLakLakAward && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">⭐ 叻叻獎</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</span>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => { if (confirm(`刪除 ${c.name}？`)) deleteCandidate.mutate({ id: c.id }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== 評分面板 ====================
function ScoringPanel({ examId }: { examId: number }) {
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [selectedBelt, setSelectedBelt] = useState<string>('');

  // 初始化評分項目
  const initForBelt = trpc.exam.scoringItems.initForBelt.useMutation({
    onSuccess: (data) => toast.success(`已初始化 ${data.count} 個評分項目`),
  });

  // 按帶級分組
  const grouped = candidates ? candidates.reduce((acc: Record<string, any[]>, c: any) => {
    const belt = c.currentBelt || '未知';
    if (!acc[belt]) acc[belt] = [];
    acc[belt].push(c);
    return acc;
  }, {}) : {};

  const sortedBelts = Object.keys(grouped).sort((a, b) => {
    const ia = BELT_ORDER.indexOf(a);
    const ib = BELT_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // 篩選
  const filteredCandidates = selectedBelt
    ? (grouped[selectedBelt] || [])
    : (candidates || []);

  return (
    <div className="space-y-4">
      {/* 帶級篩選 + 初始化評分項目 */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={selectedBelt} onChange={e => { setSelectedBelt(e.target.value); setSelectedCandidateId(null); }}
          className="border rounded-md px-2 py-1 text-sm">
          <option value="">全部帶級</option>
          {sortedBelts.map(b => <option key={b} value={b}>{b} ({grouped[b].length})</option>)}
        </select>
        {selectedBelt && (
          <Button size="sm" variant="outline" onClick={() => {
            // 使用預設的評分項目（根據帶級）
            const items = getDefaultScoringItems(selectedBelt);
            if (items.length === 0) { toast.error('無可用評分項目'); return; }
            initForBelt.mutate({ beltLevel: selectedBelt, items });
          }} disabled={initForBelt.isPending}>
            {initForBelt.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '初始化評分項目'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左側：考生列表 */}
        <div className="lg:col-span-1 space-y-1 max-h-[600px] overflow-y-auto">
          {filteredCandidates.map((c: any) => {
            const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.registered;
            const isSelected = selectedCandidateId === c.id;
            return (
              <div key={c.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'bg-red-50 border border-red-300' : 'bg-white border hover:bg-gray-50'
                }`}
                onClick={() => setSelectedCandidateId(c.id)}>
                <statusCfg.icon className={`w-4 h-4 ${statusCfg.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.currentBelt} → {c.targetBelt}</div>
                </div>
                {c.hasLakLakAward && <span className="text-amber-500 text-xs">⭐</span>}
              </div>
            );
          })}
        </div>

        {/* 右側：評分表單 */}
        <div className="lg:col-span-2">
          {selectedCandidateId ? (
            <ScoringForm candidateId={selectedCandidateId} onScored={() => refetchCandidates()} />
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>請從左側選擇考生進行評分</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 評分表單 ====================
function ScoringForm({ candidateId, onScored }: { candidateId: number; onScored: () => void }) {
  const { data: candidate } = trpc.exam.candidates.get.useQuery({ id: candidateId });
  const { data: scoringItems } = trpc.exam.scoringItems.listByBelt.useQuery(
    { beltLevel: candidate?.currentBelt || '' },
    { enabled: !!candidate }
  );
  const { data: existingScores, refetch: refetchScores } = trpc.exam.scores.getByCandidate.useQuery({ candidateId });
  const bulkUpsert = trpc.exam.scores.bulkUpsert.useMutation({
    onSuccess: () => { refetchScores(); onScored(); toast.success('評分已保存'); },
  });

  const [scores, setScores] = useState<Record<number, string>>({});

  // 載入已有評分
  useEffect(() => {
    if (existingScores) {
      const existing: Record<number, string> = {};
      existingScores.forEach((s: any) => {
        if (s.score?.score) existing[s.score.scoringItemId] = s.score.score;
      });
      setScores(existing);
    }
  }, [existingScores]);

  if (!candidate || !scoringItems) {
    return <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  const handleSave = () => {
    const scoreList = Object.entries(scores)
      .filter(([_, v]) => v)
      .map(([itemId, score]) => ({
        scoringItemId: parseInt(itemId),
        score,
      }));
    if (scoreList.length === 0) { toast.error('請至少評一個項目'); return; }
    bulkUpsert.mutate({ candidateId, scores: scoreList });
  };

  const statusCfg = STATUS_CONFIG[candidate.status] || STATUS_CONFIG.registered;

  // 按分類分組
  const categorizedItems = scoringItems.reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const CATEGORY_NAMES: Record<string, string> = {
    fitness: '體能',
    poomsae: '品勢',
    technique: '手把動作',
    board: '踢木板',
    split: '一字馬',
    side_split: '大字馬',
    sparring: '搏擊',
    competition: '外出比賽',
    other: '其他',
  };

  const CATEGORY_COLORS: Record<string, string> = {
    fitness: 'bg-blue-50 border-blue-200',
    poomsae: 'bg-purple-50 border-purple-200',
    technique: 'bg-green-50 border-green-200',
    board: 'bg-orange-50 border-orange-200',
    split: 'bg-pink-50 border-pink-200',
    side_split: 'bg-pink-50 border-pink-200',
    sparring: 'bg-red-50 border-red-200',
    competition: 'bg-indigo-50 border-indigo-200',
    other: 'bg-gray-50 border-gray-200',
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      {/* 考生資訊 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">{candidate.name}</h3>
          {getBeltBadge(candidate.currentBelt)}
          <span className="text-gray-400">→</span>
          {getBeltBadge(candidate.targetBelt)}
        </div>
        <div className="flex items-center gap-2">
          <statusCfg.icon className={`w-5 h-5 ${statusCfg.color}`} />
          <span className={`text-sm font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          {candidate.hasLakLakAward && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">⭐ 叻叻獎</span>
          )}
        </div>
      </div>

      {/* 評分項目（按分類） */}
      <div className="space-y-3">
        {Object.entries(categorizedItems).map(([cat, items]) => (
          <div key={cat} className={`rounded-lg border p-3 ${CATEGORY_COLORS[cat] || 'bg-gray-50 border-gray-200'}`}>
            <h4 className="text-sm font-semibold mb-2">{CATEGORY_NAMES[cat] || cat}</h4>
            <div className="space-y-2">
              {(items as any[]).map((item: any) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500 truncate">{item.description}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {item.type === 'grade' && GRADE_OPTIONS.map(opt => (
                      <button key={opt}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          scores[item.id] === opt 
                            ? opt === '不合格' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                            : 'bg-white border hover:bg-gray-100'
                        }`}
                        onClick={() => setScores(prev => ({ ...prev, [item.id]: opt }))}>
                        {opt}
                      </button>
                    ))}
                    {item.type === 'pass_fail' && PASS_FAIL_OPTIONS.map(opt => (
                      <button key={opt}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          scores[item.id] === opt
                            ? opt === '不合格' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                            : 'bg-white border hover:bg-gray-100'
                        }`}
                        onClick={() => setScores(prev => ({ ...prev, [item.id]: opt }))}>
                        {opt}
                      </button>
                    ))}
                    {item.type === 'yes_no' && YES_NO_OPTIONS.map(opt => (
                      <button key={opt}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          scores[item.id] === opt
                            ? opt === '沒有' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                            : 'bg-white border hover:bg-gray-100'
                        }`}
                        onClick={() => setScores(prev => ({ ...prev, [item.id]: opt }))}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 保存按鈕 */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button size="sm" onClick={handleSave} disabled={bulkUpsert.isPending}
          className="bg-red-600 hover:bg-red-700 text-white">
          {bulkUpsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          保存評分
        </Button>
      </div>
    </div>
  );
}

// ==================== 成績/升帶 ====================
function ResultsPanel({ examId }: { examId: number }) {
  const { data: candidates, refetch } = trpc.exam.candidates.list.useQuery({ examId });
  const promoteAll = trpc.exam.promoteAll.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`已升帶 ${data.promoted} 人${data.failed > 0 ? `，${data.failed} 人無法升帶` : ''}`);
    },
  });
  const promoteSingle = trpc.exam.promote.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.success) toast.success(`已升帶至 ${data.newBelt}`);
      else toast.error('升帶失敗（可能未關聯學生）');
    },
  });

  const passed = candidates?.filter((c: any) => c.status === 'passed') || [];
  const failed = candidates?.filter((c: any) => c.status === 'failed') || [];
  const examining = candidates?.filter((c: any) => c.status === 'examining') || [];
  const other = candidates?.filter((c: any) => ['registered', 'checked_in', 'absent'].includes(c.status)) || [];

  return (
    <div className="space-y-4">
      {/* 一鍵升帶 */}
      {passed.length > 0 && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-green-700">🎉 {passed.length} 位考生合格</h3>
            <p className="text-sm text-green-600">可一鍵升帶，自動更新學生系統的帶級記錄</p>
          </div>
          <Button className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { if (confirm(`確定將 ${passed.length} 位合格考生全部升帶？`)) promoteAll.mutate({ examId }); }}
            disabled={promoteAll.isPending}>
            {promoteAll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowUpCircle className="w-4 h-4 mr-1" />}
            全部升帶
          </Button>
        </div>
      )}

      {/* 合格考生 */}
      {passed.length > 0 && (
        <ResultGroup title="✅ 合格" candidates={passed} color="green" 
          onPromote={(id) => promoteSingle.mutate({ candidateId: id })}
          promoteLoading={promoteSingle.isPending} />
      )}

      {/* 不合格 */}
      {failed.length > 0 && (
        <ResultGroup title="❌ 不合格" candidates={failed} color="red" />
      )}

      {/* 評分中 */}
      {examining.length > 0 && (
        <ResultGroup title="⏳ 評分中" candidates={examining} color="yellow" />
      )}

      {/* 其他 */}
      {other.length > 0 && (
        <ResultGroup title="📋 待處理" candidates={other} color="gray" />
      )}

      {(!candidates || candidates.length === 0) && (
        <div className="text-center text-gray-400 py-8">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>尚無考生</p>
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, candidates, color, onPromote, promoteLoading }: {
  title: string;
  candidates: any[];
  color: string;
  onPromote?: (candidateId: number) => void;
  promoteLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="space-y-1">
      <button className="flex items-center gap-2 w-full text-left py-1"
        onClick={() => setExpanded(!expanded)}>
        <span className="font-semibold text-sm">{title} ({candidates.length})</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="bg-white rounded-lg border divide-y">
          {candidates.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                {getBeltBadge(c.currentBelt)}
                <span className="text-gray-400">→</span>
                {getBeltBadge(c.targetBelt)}
                {c.hasLakLakAward && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">⭐ 叻叻獎</span>}
              </div>
              {onPromote && (
                <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => onPromote(c.id)} disabled={promoteLoading}>
                  <ArrowUpCircle className="w-3 h-3 mr-1" /> 升帶
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 預設評分項目（與考試系統一致） ====================
function getDefaultScoringItems(belt: string): Array<{ name: string; description?: string; type: 'grade' | 'pass_fail' | 'yes_no'; category?: string; weight?: string }> {
  const ITEMS: Record<string, Array<{ name: string; description?: string; type: 'grade' | 'pass_fail' | 'yes_no'; category?: string; weight?: string }>> = {
    '白帶': [
      { name: '掌上壓', description: '幼稚園5次/小學8次/中學或以上12次', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', description: '幼稚園5次/小學8次/中學或以上12次', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', description: '幼稚園5次/小學8次/中學或以上12次', type: 'grade', category: 'fitness' },
      { name: '直拳', description: '直拳10次', type: 'grade', category: 'technique' },
      { name: '前踢', description: '前踢5次左5次右', type: 'grade', category: 'technique' },
      { name: 'cutdown', description: 'cutdown 5次左5次右', type: 'grade', category: 'technique' },
      { name: '旋踢', description: '旋踢（小學以上）5次左5次右', type: 'grade', category: 'technique' },
    ],
    '黃帶': [
      { name: '掌上壓', description: '幼稚園8次/小學12次/中學或以上16次', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', description: '幼稚園8次/小學12次/中學或以上16次', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', description: '幼稚園8次/小學12次/中學或以上16次', type: 'grade', category: 'fitness' },
      { name: '太極一章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '旋踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '上馬cut down', description: '5次左5次右', type: 'grade', category: 'technique' },
    ],
    '黃綠帶': [
      { name: '掌上壓', description: '幼稚園10次/小學15次/中學或以上20次', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', description: '幼稚園10次/小學15次/中學或以上20次', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', description: '幼稚園10次/小學15次/中學或以上20次', type: 'grade', category: 'fitness' },
      { name: '太極二章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '跳躍旋踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '跳躍前踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '上中雙前踢', description: '10組', type: 'grade', category: 'technique' },
    ],
    '綠帶': [
      { name: '掌上壓', description: '幼稚園10次/小學20次/中學或以上25次', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '太極三章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '後踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '跳躍cutdown', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '旋踢+旋踢+空中雙旋踢', description: '3次左3次右', type: 'grade', category: 'technique' },
      { name: '旋踢(木板)', type: 'grade', category: 'board' },
      { name: '前踢(木板)', type: 'grade', category: 'board' },
      { name: 'cutdown(木板)', type: 'grade', category: 'board' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
    ],
    '綠藍帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '太極四章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '側踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '旋踢+後踢', description: '5次左5次右', type: 'grade', category: 'technique' },
      { name: '後踢(木板)', type: 'grade', category: 'board' },
      { name: '跳躍cutdown(木板)', type: 'grade', category: 'board' },
      { name: '跳躍旋踢(木板)', type: 'grade', category: 'board' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
    ],
    '藍帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '太極五章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '跳躍側踢', type: 'grade', category: 'technique' },
      { name: '跳躍後踢', type: 'grade', category: 'technique' },
      { name: '360', type: 'grade', category: 'technique' },
      { name: '肘擊(木板)', type: 'grade', category: 'board' },
      { name: '側踢(木板)', type: 'grade', category: 'board' },
      { name: '上馬後踢(木板)', type: 'grade', category: 'board' },
      { name: '一字馬', type: 'pass_fail', category: 'split' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
    ],
    '藍紅帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '雙膝跳', type: 'grade', category: 'fitness' },
      { name: '太極六章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '太極一至五抽籤', type: 'grade', category: 'poomsae' },
      { name: '跳躍側踢(木板)', type: 'grade', category: 'board' },
      { name: '跳躍後踢(木板)', type: 'grade', category: 'board' },
      { name: '360(木板)', type: 'grade', category: 'board' },
      { name: '一字馬', type: 'pass_fail', category: 'split' },
      { name: '大字馬', type: 'pass_fail', category: 'side_split' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
    ],
    '紅帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '雙膝跳', type: 'grade', category: 'fitness' },
      { name: '太極七章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '太極一至六抽籤', type: 'grade', category: 'poomsae' },
      { name: '原地空中雙旋踢', type: 'grade', category: 'technique' },
      { name: '跳躍空中側踢', type: 'grade', category: 'technique' },
      { name: '後旋踢', type: 'grade', category: 'technique' },
      { name: '跳躍雙前踢(木板)', type: 'grade', category: 'board' },
      { name: '空中雙旋踢(木板)', type: 'grade', category: 'board' },
      { name: '一字馬', type: 'pass_fail', category: 'split' },
      { name: '大字馬', type: 'pass_fail', category: 'side_split' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
      { name: '外出比賽一次', type: 'yes_no', category: 'competition' },
    ],
    '紅黑帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '雙膝跳', type: 'grade', category: 'fitness' },
      { name: '太極一至八章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '一字馬', type: 'pass_fail', category: 'split' },
      { name: '大字馬', type: 'pass_fail', category: 'side_split' },
    ],
    '黑帶': [
      { name: '掌上壓', type: 'grade', category: 'fitness' },
      { name: '仰臥起坐', type: 'grade', category: 'fitness' },
      { name: '蹲坐跳', type: 'grade', category: 'fitness' },
      { name: '雙膝跳', type: 'grade', category: 'fitness' },
      { name: '太極一至八章', type: 'grade', category: 'poomsae', weight: '1.50' },
      { name: '一字馬', type: 'pass_fail', category: 'split' },
      { name: '大字馬', type: 'pass_fail', category: 'side_split' },
      { name: '搏擊', type: 'pass_fail', category: 'sparring' },
      { name: '外出比賽一次(搏擊)', type: 'yes_no', category: 'competition' },
      { name: '外出比賽一次(套拳)', type: 'yes_no', category: 'competition' },
    ],
  };
  return ITEMS[belt] || [];
}
