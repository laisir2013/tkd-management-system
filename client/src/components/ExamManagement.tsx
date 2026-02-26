import { useState, useEffect, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Award, Plus, Trash2, Users, ClipboardCheck, Trophy, 
  ChevronDown, ChevronUp, ArrowUpCircle, Loader2, CheckCircle2,
  XCircle, AlertCircle, FileText, Upload, UserPlus, Calendar,
  Download, Search, ExternalLink, Copy, UserCheck, ArrowLeft,
  Eye, Clock, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// ==================== 帶級定義 ====================
const BELT_LEVELS: Record<string, { name: string; color: string; textColor: string; order: number }> = {
  white: { name: '白帶', color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700', order: 1 },
  yellow: { name: '黃帶', color: 'bg-yellow-100 border-yellow-400', textColor: 'text-yellow-700', order: 2 },
  yellow_green: { name: '黃綠帶', color: 'bg-lime-100 border-lime-400', textColor: 'text-lime-700', order: 3 },
  green: { name: '綠帶', color: 'bg-green-100 border-green-400', textColor: 'text-green-700', order: 4 },
  green_blue: { name: '綠藍帶', color: 'bg-teal-100 border-teal-400', textColor: 'text-teal-700', order: 5 },
  blue: { name: '藍帶', color: 'bg-blue-100 border-blue-400', textColor: 'text-blue-700', order: 6 },
  blue_red: { name: '藍紅帶', color: 'bg-purple-100 border-purple-400', textColor: 'text-purple-700', order: 7 },
  red: { name: '紅帶', color: 'bg-red-100 border-red-400', textColor: 'text-red-700', order: 8 },
  red_black: { name: '紅黑帶', color: 'bg-rose-100 border-rose-800', textColor: 'text-rose-800', order: 9 },
  black: { name: '黑帶', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', order: 10 },
  black_2dan: { name: '黑帶二段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', order: 11 },
  black_3dan: { name: '黑帶三段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', order: 12 },
};

const BELT_ORDER_KEYS = ['white','yellow','yellow_green','green','green_blue','blue','blue_red','red','red_black','black','black_2dan','black_3dan'];
const GENDER_MAP: Record<string, string> = { male: '男', female: '女' };

function getBeltBadge(belt: string) {
  const info = BELT_LEVELS[belt];
  if (!info) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-700">{belt}</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${info.color} ${info.textColor}`}>
      {info.name}
    </span>
  );
}

function getBeltName(key: string) {
  return BELT_LEVELS[key]?.name || key;
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

const GRADE_OPTIONS = ['A', 'B', 'C', '不合格'] as const;
const PASS_FAIL_OPTIONS = ['合格', '不合格'] as const;
const YES_NO_OPTIONS = ['有', '沒有'] as const;

const CATEGORY_NAMES: Record<string, string> = {
  fitness: '💪 體能', poomsae: '🥋 品勢', technique: '🦵 手把動作',
  board: '🪵 踢木板', split: '🧘 一字馬', side_split: '🧘 大字馬',
  sparring: '🥊 搏擊', competition: '🏆 外出比賽', other: '📋 其他',
};

// ==================== 主組件 ====================
export default function ExamManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'candidates' | 'scoring' | 'schedule' | 'results'>('overview');

  return (
    <div className="space-y-4">
      {activeTab === 'list' ? (
        <ExamList onSelectExam={(id) => { setSelectedExamId(id); setActiveTab('detail'); setDetailTab('overview'); }} />
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
function ExamList({ onSelectExam }: { onSelectExam: (id: number) => void }) {
  const { data: exams, refetch } = trpc.exam.list.useQuery();
  const createExam = trpc.exam.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); toast.success('考試已建立'); } });
  const deleteExam = trpc.exam.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [location, setLocation] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-red-600" /> 考試管理
        </h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> 新增考試
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">建立新考試</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="考試名稱" value={name} onChange={e => setName(e.target.value)} />
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
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(!exams || exams.length === 0) ? (
          <div className="text-center text-gray-400 py-8">
            <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>尚無考試記錄</p>
          </div>
        ) : (exams as any[]).map((exam) => {
          const statusInfo = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
          return (
            <div key={exam.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectExam(exam.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center border border-red-200">
                    <Award className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{exam.name}</h3>
                    <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                      <span>📅 {new Date(exam.examDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
                      {exam.location && <span>📍 {exam.location}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                  <Button size="sm" variant="outline">管理 →</Button>
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
  detailTab: 'overview' | 'candidates' | 'scoring' | 'schedule' | 'results';
  setDetailTab: (t: any) => void;
}) {
  const { data: exam, refetch: refetchExam } = trpc.exam.get.useQuery({ id: examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const updateExam = trpc.exam.update.useMutation({ onSuccess: () => { refetchExam(); toast.success('已更新'); } });

  if (!exam) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const examData = exam as any;
  const statusInfo = EXAM_STATUS_CONFIG[examData.status] || EXAM_STATUS_CONFIG.draft;

  // 計算帶級分佈
  const beltCounts = candidates ? BELT_ORDER_KEYS.map(key => ({
    key, name: getBeltName(key),
    count: (candidates as any[]).filter(c => c.currentBelt === key).length,
  })).filter(b => b.count > 0) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> 返回</Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{examData.name}</h2>
          <div className="text-sm text-gray-500 flex items-center gap-3">
            <span>📅 {new Date(examData.examDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
            {examData.location && <span>📍 {examData.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          {examData.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => updateExam.mutate({ id: examId, status: 'scheduled' })}>排程</Button>
          )}
          {examData.status === 'scheduled' && (
            <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => updateExam.mutate({ id: examId, status: 'in_progress' })}>開始考試</Button>
          )}
          {examData.status === 'in_progress' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateExam.mutate({ id: examId, status: 'completed' })}>完成考試</Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <SmallStat label="總人數" value={(stats as any).total || 0} color="text-gray-700" />
          <SmallStat label="合格" value={(stats as any).passed || 0} color="text-green-600" />
          <SmallStat label="不合格" value={(stats as any).failed || 0} color="text-red-600" />
          <SmallStat label="評分中" value={(stats as any).examining || 0} color="text-yellow-600" />
          <SmallStat label="缺席" value={(stats as any).absent || 0} color="text-gray-400" />
          <SmallStat label="叻叻獎" value={(stats as any).lakLakCount || 0} color="text-amber-500" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {[
          { key: 'overview' as const, label: '概覽', icon: Eye },
          { key: 'candidates' as const, label: '考生', icon: Users },
          { key: 'scoring' as const, label: '評分', icon: ClipboardCheck },
          { key: 'schedule' as const, label: '時間表', icon: Calendar },
          { key: 'results' as const, label: '成績', icon: Trophy },
        ].map(tab => (
          <button key={tab.key}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              detailTab === tab.key ? 'bg-white shadow text-red-700' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setDetailTab(tab.key)}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {detailTab === 'overview' && <OverviewPanel examId={examId} examData={examData} beltCounts={beltCounts} stats={stats} />}
      {detailTab === 'candidates' && <CandidateManagement examId={examId} />}
      {detailTab === 'scoring' && <ScoringPanel examId={examId} />}
      {detailTab === 'schedule' && <SchedulePanel examId={examId} />}
      {detailTab === 'results' && <ResultsPanel examId={examId} />}
    </div>
  );
}

function SmallStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ==================== 概覽 ====================
function OverviewPanel({ examId, examData, beltCounts, stats }: any) {
  return (
    <div className="space-y-4">
      {/* 帶級分佈 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3">級別分佈</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {beltCounts.map((belt: any) => (
            <div key={belt.key} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              {getBeltBadge(belt.key)}
              <span className="font-semibold text-slate-900">{belt.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 點名頁面入口 */}
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">點名頁面</h3>
              <p className="text-xs text-slate-500">獨立頁面，工作人員無需密碼即可使用</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-100"
              onClick={() => {
                const url = `${window.location.origin}/exam/${examId}/attendance`;
                navigator.clipboard.writeText(url);
                toast.success("已複製點名頁面連結");
              }}>
              <Copy className="w-3.5 h-3.5 mr-1" /> 複製連結
            </Button>
            <a href={`/exam/${examId}/attendance`} target="_blank" rel="noopener noreferrer">
              <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> 開啟點名
              </Button>
            </a>
          </div>
        </div>

        {/* 合格率統計 */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">考試統計</h3>
              <p className="text-xs text-slate-500">合格率與成績分析</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{stats?.passed || 0}</div>
              <div className="text-xs text-gray-500">合格</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
              <div className="text-xs text-gray-500">不合格</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {stats && (stats as any).total > 0 ? `${(((stats as any).passed / ((stats as any).passed + (stats as any).failed)) * 100 || 0).toFixed(1)}%` : '-'}
              </div>
              <div className="text-xs text-gray-500">合格率</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 考生管理 ====================
function CandidateManagement({ examId }: { examId: number }) {
  const { data: candidates, refetch } = trpc.exam.candidates.list.useQuery({ examId });
  const createCandidate = trpc.exam.candidates.create.useMutation({ onSuccess: () => { refetch(); toast.success('已新增考生'); } });
  const deleteCandidate = trpc.exam.candidates.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });
  const importFromEvent = trpc.exam.candidates.importFromEvent.useMutation({ 
    onSuccess: (data: any) => { refetch(); toast.success(`已匯入 ${data.imported} 位考生`); } 
  });
  
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addGender, setAddGender] = useState<'male' | 'female'>('male');
  const [addAge, setAddAge] = useState('');
  const [addDojoName, setAddDojoName] = useState('');
  const [addCurrentBelt, setAddCurrentBelt] = useState('white');
  const [addTargetBelt, setAddTargetBelt] = useState('yellow');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImport, setShowImport] = useState(false);

  const { data: allEvents } = trpc.events.getAll.useQuery({ type: 'exam' });

  // 搜尋過濾
  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    if (!searchQuery) return candidates as any[];
    const q = searchQuery.toLowerCase();
    return (candidates as any[]).filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.phone && c.phone.includes(q)) ||
      (c.dojoName && c.dojoName.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  // 按帶級分組
  const grouped = useMemo(() => {
    return filteredCandidates.reduce((acc: Record<string, any[]>, c: any) => {
      const belt = c.currentBelt || 'unknown';
      if (!acc[belt]) acc[belt] = [];
      acc[belt].push(c);
      return acc;
    }, {});
  }, [filteredCandidates]);

  const sortedBelts = Object.keys(grouped).sort((a, b) => {
    const ia = BELT_ORDER_KEYS.indexOf(a);
    const ib = BELT_ORDER_KEYS.indexOf(b);
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
        <div className="flex-1 min-w-[200px] max-w-xs">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="搜尋考生..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9" />
          </div>
        </div>
        <span className="text-sm text-gray-500">共 {candidates?.length || 0} 位考生</span>
      </div>

      {showImport && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
          <p className="text-sm font-medium text-blue-700">選擇考試活動匯入報名學生：</p>
          {allEvents && (allEvents as any[]).length > 0 ? (
            <div className="space-y-1">
              {(allEvents as any[]).map((ev) => (
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
          ) : <p className="text-sm text-gray-500">沒有考試類型的活動</p>}
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input placeholder="姓名 *" value={addName} onChange={e => setAddName(e.target.value)} />
            <Input placeholder="電話" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            <Input placeholder="道場" value={addDojoName} onChange={e => setAddDojoName(e.target.value)} />
            <div className="flex gap-1">
              <select value={addGender} onChange={e => setAddGender(e.target.value as any)} className="border rounded-md px-2 py-1 text-sm w-16">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
              <Input placeholder="年齡" type="number" value={addAge} onChange={e => setAddAge(e.target.value)} className="w-20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={addCurrentBelt} onChange={e => {
              setAddCurrentBelt(e.target.value);
              const idx = BELT_ORDER_KEYS.indexOf(e.target.value);
              setAddTargetBelt(BELT_ORDER_KEYS[idx + 1] || e.target.value);
            }} className="border rounded-md px-2 py-1 text-sm">
              {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
            </select>
            <select value={addTargetBelt} onChange={e => setAddTargetBelt(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
              {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!addName) { toast.error('請填寫姓名'); return; }
              createCandidate.mutate({
                examId, name: addName, phone: addPhone || undefined,
                gender: addGender, age: addAge ? parseInt(addAge) : undefined,
                currentBelt: addCurrentBelt, targetBelt: addTargetBelt,
              });
              setAddName(''); setAddPhone(''); setAddAge(''); setAddDojoName('');
            }} disabled={createCandidate.isPending}>新增</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 考生列表 */}
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
                <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${statusCfg.color} flex-shrink-0`} />
                    <span className="text-sm font-medium">{c.groupCode ? `${c.groupCode.toUpperCase()}${c.orderNumber || ''} ` : ''}{c.name}</span>
                    {c.gender && <span className="text-xs text-gray-400">{GENDER_MAP[c.gender] || ''}</span>}
                    {c.age && <span className="text-xs text-gray-400">{c.age}歲</span>}
                    {c.dojoName && <span className="text-xs text-gray-400">{c.dojoName}</span>}
                    {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                    <span className="text-xs text-gray-400">→</span>
                    {getBeltBadge(c.targetBelt)}
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

  const initForBelt = trpc.exam.scoringItems.initForBelt.useMutation({
    onSuccess: (data: any) => toast.success(`已初始化 ${data.count} 個評分項目`),
  });

  const grouped = (candidates as any[])?.reduce((acc: Record<string, any[]>, c: any) => {
    const belt = c.currentBelt || '未知';
    if (!acc[belt]) acc[belt] = [];
    acc[belt].push(c);
    return acc;
  }, {}) || {};

  const sortedBelts = Object.keys(grouped).sort((a, b) => {
    const ia = BELT_ORDER_KEYS.indexOf(a);
    const ib = BELT_ORDER_KEYS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const filteredCandidates = selectedBelt ? (grouped[selectedBelt] || []) : ((candidates as any[]) || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={selectedBelt} onChange={e => { setSelectedBelt(e.target.value); setSelectedCandidateId(null); }}
          className="border rounded-md px-2 py-1 text-sm">
          <option value="">全部帶級</option>
          {sortedBelts.map(b => <option key={b} value={b}>{getBeltName(b)} ({grouped[b].length})</option>)}
        </select>
        {selectedBelt && (
          <Button size="sm" variant="outline" onClick={() => initForBelt.mutate({ beltLevel: selectedBelt })}
            disabled={initForBelt.isPending}>
            {initForBelt.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '初始化評分項目'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <div className="text-xs text-gray-400">{getBeltName(c.currentBelt)} → {getBeltName(c.targetBelt)}</div>
                </div>
                {c.hasLakLakAward && <span className="text-amber-500 text-xs">⭐</span>}
              </div>
            );
          })}
        </div>

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
    { beltLevel: (candidate as any)?.currentBelt || '' },
    { enabled: !!candidate }
  );
  const { data: existingScores, refetch: refetchScores } = trpc.exam.scores.getByCandidate.useQuery({ candidateId });
  const bulkUpsert = trpc.exam.scores.bulkUpsert.useMutation({
    onSuccess: () => { refetchScores(); onScored(); toast.success('評分已保存'); },
  });

  const [scores, setScores] = useState<Record<number, string>>({});

  useEffect(() => {
    if (existingScores) {
      const existing: Record<number, string> = {};
      (existingScores as any[]).forEach((s: any) => {
        if (s.score?.score) existing[s.score.scoringItemId] = s.score.score;
      });
      setScores(existing);
    }
  }, [existingScores]);

  if (!candidate || !scoringItems) {
    return <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  const cand = candidate as any;
  const items = scoringItems as any[];

  const handleSave = () => {
    const scoreList = Object.entries(scores)
      .filter(([_, v]) => v)
      .map(([itemId, score]) => ({ scoringItemId: parseInt(itemId), score }));
    if (scoreList.length === 0) { toast.error('請至少評一個項目'); return; }
    bulkUpsert.mutate({ candidateId, scores: scoreList });
  };

  const statusCfg = STATUS_CONFIG[cand.status] || STATUS_CONFIG.registered;
  const categorizedItems = items.reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">{cand.name}</h3>
          {getBeltBadge(cand.currentBelt)}
          <span className="text-gray-400">→</span>
          {getBeltBadge(cand.targetBelt)}
        </div>
        <div className="flex items-center gap-2">
          <statusCfg.icon className={`w-5 h-5 ${statusCfg.color}`} />
          <span className={`text-sm font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          {cand.hasLakLakAward && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">⭐ 叻叻獎</span>}
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(categorizedItems).map(([cat, catItems]) => (
          <div key={cat} className="rounded-lg border p-3 bg-gray-50">
            <h4 className="text-sm font-semibold mb-2">{CATEGORY_NAMES[cat] || cat}</h4>
            <div className="space-y-2">
              {(catItems as any[]).map((item: any) => (
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

// ==================== 時間表 ====================
function SchedulePanel({ examId }: { examId: number }) {
  const { data: schedules, refetch } = trpc.exam.schedules.list.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });

  const sortedSchedules = useMemo(() => {
    if (!schedules) return [];
    return [...(schedules as any[])].sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }, [schedules]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">考試時間表</h3>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> 重新整理
        </Button>
      </div>

      {sortedSchedules.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>尚無時間表</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">組別</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">級別</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">時間</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">地點</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">考生數</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">考生名單</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedSchedules.map((schedule: any) => {
                const groupCandidates = (candidates as any[])?.filter(c => c.groupCode === schedule.groupCode) || [];
                return (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-lg">{schedule.groupCode?.toUpperCase() || '-'}</td>
                    <td className="px-3 py-2">{getBeltBadge(schedule.beltLevel)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {String(schedule.startTime || '')} - {String(schedule.endTime || '')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{schedule.venue || '-'}</td>
                    <td className="px-3 py-2 text-center font-medium">{groupCandidates.length}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {groupCandidates.map((c: any) => c.name).join('、') || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== 成績/升帶 ====================
function ResultsPanel({ examId }: { examId: number }) {
  const { data: candidates, refetch } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const promoteAll = trpc.exam.promoteAll.useMutation({
    onSuccess: (data: any) => {
      refetch();
      toast.success(`已升帶 ${data.promoted} 人${data.failed > 0 ? `，${data.failed} 人無法升帶` : ''}`);
    },
  });
  const promoteSingle = trpc.exam.promote.useMutation({
    onSuccess: (data: any) => {
      refetch();
      if (data.success) toast.success(`已升帶至 ${data.newBelt}`);
      else toast.error('升帶失敗');
    },
  });

  const [activeTab, setActiveTab] = useState<'passed' | 'failed' | 'absent'>('passed');
  const [selectedBelt, setSelectedBelt] = useState('all');

  const filterByBelt = (list: any[]) => {
    if (selectedBelt === 'all') return list;
    return list.filter(c => c.currentBelt === selectedBelt);
  };

  const passed = filterByBelt((candidates as any[])?.filter(c => c.status === 'passed') || []);
  const failed = filterByBelt((candidates as any[])?.filter(c => c.status === 'failed') || []);
  const absent = filterByBelt((candidates as any[])?.filter(c => c.status === 'absent') || []);

  const handleExport = () => {
    const dataToExport = activeTab === 'passed' ? passed : activeTab === 'failed' ? failed : absent;
    if (!dataToExport || dataToExport.length === 0) { toast.error('沒有資料可匯出'); return; }

    const headers = ["姓名", "性別", "年齡", "道場", "現時級別", "報考級別", "組別"];
    const rows = dataToExport.map((c: any) => [
      c.name, GENDER_MAP[c.gender] || '', c.age?.toString() ?? '',
      c.dojoName ?? '', getBeltName(c.currentBelt), getBeltName(c.targetBelt),
      c.groupCode ? `${c.groupCode.toUpperCase()}${c.orderNumber ?? ''}` : '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const examName = (exam as any)?.name || '考試';
    link.download = `${examName}_${activeTab === 'passed' ? '合格' : activeTab === 'failed' ? '不合格' : '缺席'}名單.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("名單已匯出");
  };

  return (
    <div className="space-y-4">
      {/* 統計 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SmallStat label="總考生數" value={(candidates as any[])?.length || 0} color="text-gray-700" />
        <SmallStat label="合格人數" value={passed.length} color="text-green-600" />
        <SmallStat label="不合格人數" value={failed.length} color="text-red-600" />
        <SmallStat label="缺席人數" value={absent.length} color="text-orange-600" />
        <SmallStat label="合格率" value={0} color="text-amber-600" />
      </div>

      {/* 一鍵升帶 */}
      {passed.length > 0 && activeTab === 'passed' && (
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

      {/* Tabs + Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'passed' as const, label: `✅ 合格 (${passed.length})` },
            { key: 'failed' as const, label: `❌ 不合格 (${failed.length})` },
            { key: 'absent' as const, label: `🚫 缺席 (${absent.length})` },
          ].map(tab => (
            <button key={tab.key}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedBelt} onChange={e => setSelectedBelt(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
            <option value="all">全部級別</option>
            {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> 匯出
          </Button>
        </div>
      </div>

      {/* 結果表格 */}
      <ResultTable 
        candidates={activeTab === 'passed' ? passed : activeTab === 'failed' ? failed : absent}
        onPromote={activeTab === 'passed' ? (id) => promoteSingle.mutate({ candidateId: id }) : undefined}
        promoteLoading={promoteSingle.isPending}
      />
    </div>
  );
}

function ResultTable({ candidates, onPromote, promoteLoading }: { 
  candidates: any[];
  onPromote?: (candidateId: number) => void;
  promoteLoading?: boolean;
}) {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>沒有符合條件的考生</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-700">組別</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">姓名</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">性別</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">年齡</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">道場</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">現時級別</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">報考級別</th>
            {onPromote && <th className="px-3 py-2 text-center font-medium text-gray-700">操作</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {candidates.map((c: any) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">
                {c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : '-'}
              </td>
              <td className="px-3 py-2 font-medium">
                {c.name}
                {c.hasLakLakAward && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">⭐</span>}
              </td>
              <td className="px-3 py-2 text-gray-500">{GENDER_MAP[c.gender] || '-'}</td>
              <td className="px-3 py-2 text-gray-500">{c.age ?? '-'}</td>
              <td className="px-3 py-2 text-gray-500">{c.dojoName ?? '-'}</td>
              <td className="px-3 py-2">{getBeltBadge(c.currentBelt)}</td>
              <td className="px-3 py-2">{getBeltBadge(c.targetBelt)}</td>
              {onPromote && (
                <td className="px-3 py-2 text-center">
                  <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => onPromote(c.id)} disabled={promoteLoading}>
                    <ArrowUpCircle className="w-3 h-3 mr-1" /> 升帶
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
