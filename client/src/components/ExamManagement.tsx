import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { useExamSSE } from "../lib/useExamSSE";
import type { SSEEvent } from "../lib/useExamSSE";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Award, Plus, Trash2, Users, ClipboardCheck, Trophy, 
  ChevronDown, ChevronUp, ArrowUpCircle, Loader2, CheckCircle2,
  XCircle, AlertCircle, FileText, Upload, UserPlus, Calendar,
  Download, Search, ExternalLink, Copy, UserCheck, ArrowLeft,
  Eye, Clock, RefreshCw, LayoutDashboard, MessageSquare, Printer,
  Mail, Send, ChevronRight, BarChart3
} from "lucide-react";
import { toast } from "sonner";

// ==================== 帶級定義 ====================
const BELT_LEVELS: Record<string, { name: string; color: string; textColor: string; bgColor: string; order: number }> = {
  white: { name: '白帶', color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700', bgColor: 'bg-yellow-50', order: 1 },
  yellow: { name: '黃帶', color: 'bg-yellow-100 border-yellow-400', textColor: 'text-yellow-700', bgColor: 'bg-green-50', order: 2 },
  yellow_green: { name: '黃綠帶', color: 'bg-lime-100 border-lime-400', textColor: 'text-lime-700', bgColor: 'bg-lime-50', order: 3 },
  green: { name: '綠帶', color: 'bg-green-100 border-green-400', textColor: 'text-green-700', bgColor: 'bg-green-50', order: 4 },
  green_blue: { name: '綠藍帶', color: 'bg-teal-100 border-teal-400', textColor: 'text-teal-700', bgColor: 'bg-teal-50', order: 5 },
  blue: { name: '藍帶', color: 'bg-blue-100 border-blue-400', textColor: 'text-blue-700', bgColor: 'bg-blue-50', order: 6 },
  blue_red: { name: '藍紅帶', color: 'bg-purple-100 border-purple-400', textColor: 'text-purple-700', bgColor: 'bg-purple-50', order: 7 },
  red: { name: '紅帶', color: 'bg-red-100 border-red-400', textColor: 'text-red-700', bgColor: 'bg-red-50', order: 8 },
  red_black: { name: '紅黑帶', color: 'bg-rose-100 border-rose-800', textColor: 'text-rose-800', bgColor: 'bg-rose-50', order: 9 },
  black: { name: '黑帶', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', bgColor: 'bg-gray-100', order: 10 },
  black_2dan: { name: '黑帶二段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', bgColor: 'bg-gray-100', order: 11 },
  black_3dan: { name: '黑帶三段', color: 'bg-gray-800 border-gray-900', textColor: 'text-white', bgColor: 'bg-gray-100', order: 12 },
};

const BELT_ORDER_KEYS = ['white','yellow','yellow_green','green','green_blue','blue','blue_red','red','red_black','black','black_2dan','black_3dan'];
const GENDER_MAP: Record<string, string> = { male: '男', female: '女' };

const CATEGORY_NAMES: Record<string, string> = {
  fitness: '體能', technique: '手把動作', poomsae: '品勢', board: '木板',
  sparring: '搏擊', split: '劈叉', side_split: '大字馬', competition: '比賽',
};

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
  confirmed: { label: '已確認', color: 'text-green-600', icon: CheckCircle2 },
  checked_in: { label: '已報到', color: 'text-blue-600', icon: UserCheck },
  examining: { label: '評分中', color: 'text-yellow-600', icon: ClipboardCheck },
  passed: { label: '合格', color: 'text-green-600', icon: Trophy },
  failed: { label: '不合格', color: 'text-red-600', icon: XCircle },
  absent: { label: '缺席', color: 'text-gray-400', icon: AlertCircle },
};

const EXAM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: '已排程', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '進行中', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
};

// ==================== NAV ITEMS ====================
type NavPage = 'overview' | 'candidates' | 'scoring' | 'timetable' | 'results';
const NAV_ITEMS: { key: NavPage; label: string; icon: any }[] = [
  { key: 'overview', label: '考試概覽', icon: LayoutDashboard },
  { key: 'candidates', label: '考生管理', icon: Users },
  { key: 'scoring', label: '評分', icon: ClipboardCheck },
  { key: 'timetable', label: '時間表', icon: Calendar },
  { key: 'results', label: '合格名單', icon: Trophy },
];

// ==================== 主組件 ====================
export default function ExamManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [navPage, setNavPage] = useState<NavPage>('overview');

  if (activeTab === 'list' || !selectedExamId) {
    return <ExamList onSelectExam={(id) => { setSelectedExamId(id); setActiveTab('detail'); setNavPage('overview'); }} />;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)]">
      {/* Left Sidebar */}
      <div className="w-48 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Award className="w-4 h-4 text-red-600" />
            <span>創武考試管理</span>
          </div>
        </div>
        <button onClick={() => { setActiveTab('list'); setSelectedExamId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-b">
          <ArrowLeft className="w-4 h-4" /> 返回儀表板
        </button>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(item => (
            <button key={item.key}
              onClick={() => setNavPage(item.key)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                navPage === item.key ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6">
        {navPage === 'overview' && <OverviewPage examId={selectedExamId} />}
        {navPage === 'candidates' && <CandidatesPage examId={selectedExamId} />}
        {navPage === 'scoring' && <ScoringPage examId={selectedExamId} />}
        {navPage === 'timetable' && <TimetablePage examId={selectedExamId} />}
        {navPage === 'results' && <ResultsPage examId={selectedExamId} />}
      </div>
    </div>
  );
}

// ==================== 考試列表 ====================
function ExamList({ onSelectExam }: { onSelectExam: (id: number) => void }) {
  const { data: exams, refetch } = trpc.exam.list.useQuery();
  const createExam = trpc.exam.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); setName(''); setExamDate(''); setLocation(''); toast.success('考試已建立'); }, onError: (err) => { toast.error(err.message || '建立失敗'); } });
  const deleteExam = trpc.exam.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [location, setLocation] = useState('');

  const handleCreate = () => {
    if (!name || !examDate) { toast.error('請填寫名稱和日期'); return; }
    createExam.mutate({ name, examDate: new Date(examDate + 'T00:00:00'), location: location || undefined });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">考試管理</h2>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> 新增考試
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">建立新考試</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="考試名稱" value={name} onChange={e => setName(e.target.value)} />
            <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
            <Input placeholder="地點 (選填)" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={createExam.isPending} className="bg-blue-600 text-white">
              {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '建立'}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {exams?.map((exam: any) => {
          const status = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
          return (
            <div key={exam.id} className="bg-white rounded-lg border p-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => onSelectExam(exam.id)}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{exam.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  📅 {new Date(exam.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {exam.location && <span className="ml-2">📍 {exam.location}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5 text-gray-400" />
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); if (confirm('確定刪除？')) deleteExam.mutate({ id: exam.id }); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {(!exams || exams.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>尚未建立考試</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 考試概覽頁 ====================
function OverviewPage({ examId }: { examId: number }) {
  const { data: exam, refetch: refetchExam } = trpc.exam.get.useQuery({ id: examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: allScores } = trpc.exam.scores.listByExam.useQuery({ examId });
  const updateExam = trpc.exam.update.useMutation({ onSuccess: () => { refetchExam(); toast.success('已更新'); } });

  const [sseConnected, setSseConnected] = useState(false);
  useExamSSE({ examId, enabled: true, autoInvalidate: true, onConnected: () => setSseConnected(true) });

  if (!exam) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const examData = exam as any;
  const s = stats as any;
  const statusInfo = EXAM_STATUS_CONFIG[examData.status] || EXAM_STATUS_CONFIG.draft;
  const passRate = s && (s.passed + s.failed) > 0 ? ((s.passed / (s.passed + s.failed)) * 100).toFixed(1) : '-';
  const checkedInCount = candidates ? (candidates as any[]).filter((c: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length : 0;

  const beltCounts = candidates ? BELT_ORDER_KEYS.map(key => ({
    key, name: getBeltName(key),
    count: (candidates as any[]).filter(c => c.currentBelt === key).length,
  })).filter(b => b.count > 0) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{examData.name}</h1>
          <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
            <span>📅 {new Date(examData.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
            {examData.location && <span>📍 {examData.location}</span>}
            {sseConnected && <span className="text-green-500 text-xs">🟢 即時連線</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          {examData.status === 'draft' && <Button size="sm" variant="outline" onClick={() => updateExam.mutate({ id: examId, status: 'scheduled' })}>排程</Button>}
          {examData.status === 'scheduled' && <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => updateExam.mutate({ id: examId, status: 'in_progress' })}>開始考試</Button>}
          {examData.status === 'in_progress' && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateExam.mutate({ id: examId, status: 'completed' })}>完成考試</Button>}
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard icon="👥" label="總人數" value={s?.total || 0} color="blue" />
        <StatCard icon="✅" label="已報到" value={checkedInCount} color="green" />
        <StatCard icon="🏆" label="合格" value={s?.passed || 0} color="emerald" />
        <StatCard icon="❌" label="不合格" value={s?.failed || 0} color="red" />
        <StatCard icon="📝" label="評分中" value={s?.examining || 0} color="yellow" />
        <StatCard icon="🚫" label="缺席" value={s?.absent || 0} color="gray" />
        <StatCard icon="📊" label="合格率" value={0} color="indigo" suffix={passRate !== '-' ? `${passRate}%` : '-'} />
        <StatCard icon="⭐" label="叻叻獎" value={s?.lakLakCount || 0} color="amber" />
      </div>

      {/* 帶級分佈 */}
      {beltCounts.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">帶級分佈</h3>
          <div className="flex flex-wrap gap-2">
            {beltCounts.map(b => (
              <div key={b.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                {getBeltBadge(b.key)}
                <span className="text-sm font-medium">{b.count} 人</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 詳細統計分析 */}
      {candidates && (candidates as any[]).some(c => c.status === 'passed' || c.status === 'failed') && (
        <ExamDetailedStats candidates={candidates as any[]} allScores={allScores as any[] || []} />
      )}
    </div>
  );
}

// ==================== 詳細統計分析組件 ====================
function ExamDetailedStats({ candidates, allScores }: { candidates: any[]; allScores: any[] }) {
  const judged = candidates.filter(c => c.status === 'passed' || c.status === 'failed');
  const passed = judged.filter(c => c.status === 'passed');
  const failed = judged.filter(c => c.status === 'failed');

  if (judged.length === 0) return null;

  // 1. 各帶級合格率
  const beltStats = BELT_ORDER_KEYS.map(key => {
    const beltCandidates = judged.filter(c => c.currentBelt === key);
    const beltPassed = beltCandidates.filter(c => c.status === 'passed').length;
    const beltFailed = beltCandidates.filter(c => c.status === 'failed').length;
    return { key, name: getBeltName(key), total: beltCandidates.length, passed: beltPassed, failed: beltFailed };
  }).filter(b => b.total > 0);

  // 2. 各評分項目分析 — 找出最多人不合格的項目
  const itemStats: Record<number, { name: string; category: string; total: number; fail: number; gradeA: number; gradeB: number; gradeC: number }> = {};
  for (const s of allScores) {
    const itemId = s.item.id;
    if (!itemStats[itemId]) {
      itemStats[itemId] = { name: s.item.name, category: s.item.category || '', total: 0, fail: 0, gradeA: 0, gradeB: 0, gradeC: 0 };
    }
    itemStats[itemId].total++;
    const score = s.score.score;
    if (score === 'fail' || score === 'false' || score === 'F') itemStats[itemId].fail++;
    else if (score === 'A') itemStats[itemId].gradeA++;
    else if (score === 'B') itemStats[itemId].gradeB++;
    else if (score === 'C') itemStats[itemId].gradeC++;
  }
  const itemStatsArr = Object.values(itemStats).sort((a, b) => (b.fail / b.total) - (a.fail / a.total));
  const problemItems = itemStatsArr.filter(i => i.fail > 0);

  // 3. 道場分析
  const dojoStats: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const c of judged) {
    const dojo = c.dojoName || '未知道場';
    if (!dojoStats[dojo]) dojoStats[dojo] = { total: 0, passed: 0, failed: 0 };
    dojoStats[dojo].total++;
    if (c.status === 'passed') dojoStats[dojo].passed++;
    else dojoStats[dojo].failed++;
  }
  const dojoArr = Object.entries(dojoStats).map(([name, d]) => ({ name, ...d, rate: Math.round((d.passed / d.total) * 100) })).sort((a, b) => b.total - a.total);

  // 4. 整體成績分佈
  const totalScores = allScores.length;
  const gradeDistribution = { A: 0, B: 0, C: 0, pass: 0, fail: 0 };
  for (const s of allScores) {
    const score = s.score.score;
    if (score === 'A') gradeDistribution.A++;
    else if (score === 'B') gradeDistribution.B++;
    else if (score === 'C') gradeDistribution.C++;
    else if (score === 'pass' || score === 'true') gradeDistribution.pass++;
    else if (score === 'fail' || score === 'false' || score === 'F') gradeDistribution.fail++;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-indigo-600" /> 詳細統計分析
      </h3>

      {/* 整體成績分佈 */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium mb-3 text-gray-700">📊 整體成績分佈</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <GradeCard label="A（優秀）" count={gradeDistribution.A} total={totalScores} color="bg-green-500" />
          <GradeCard label="B（良好）" count={gradeDistribution.B} total={totalScores} color="bg-blue-500" />
          <GradeCard label="C（合格）" count={gradeDistribution.C} total={totalScores} color="bg-yellow-500" />
          <GradeCard label="Pass" count={gradeDistribution.pass} total={totalScores} color="bg-emerald-500" />
          <GradeCard label="Fail" count={gradeDistribution.fail} total={totalScores} color="bg-red-500" />
        </div>
      </div>

      {/* 各帶級合格率 */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium mb-3 text-gray-700">🥋 各帶級合格率</h4>
        <div className="space-y-2">
          {beltStats.map(b => (
            <div key={b.key} className="flex items-center gap-3">
              <div className="w-20 shrink-0">{getBeltBadge(b.key)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${(b.passed / b.total) * 100}%` }} />
                    <div className="h-full bg-red-400 transition-all" style={{ width: `${(b.failed / b.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {b.passed}/{b.total} ({Math.round((b.passed / b.total) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 最多人不合格的項目 */}
      {problemItems.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-3 text-gray-700">⚠️ 不合格項目排名（需加強訓練）</h4>
          <div className="space-y-2">
            {problemItems.slice(0, 10).map((item, idx) => {
              const failRate = Math.round((item.fail / item.total) * 100);
              const categoryLabel = CATEGORY_NAMES[item.category] || item.category;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-red-500">#{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {categoryLabel && <span className="text-gray-400 mr-1">[{categoryLabel}]</span>}
                        {item.name}
                      </span>
                      <span className="text-xs text-red-600 font-medium">{item.fail}/{item.total} 人不合格 ({failRate}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${failRate}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 道場分析 */}
      {dojoArr.length > 1 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-3 text-gray-700">🏠 道場表現</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">道場</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">應考</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">不合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格率</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 w-40">比較</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dojoArr.map(d => (
                  <tr key={d.name} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{d.name}</td>
                    <td className="px-3 py-2 text-center">{d.total}</td>
                    <td className="px-3 py-2 text-center text-green-600 font-medium">{d.passed}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{d.failed}</td>
                    <td className="px-3 py-2 text-center font-bold">{d.rate}%</td>
                    <td className="px-3 py-2">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${d.rate}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${100 - d.rate}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 叻叻獎名單 */}
      {passed.filter(c => c.hasLakLakAward).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-3 text-gray-700">⭐ 叻叻獎名單（全 A 考生）</h4>
          <div className="flex flex-wrap gap-2">
            {passed.filter(c => c.hasLakLakAward).map(c => (
              <div key={c.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-amber-800">{c.name}</span>
                {getBeltBadge(c.currentBelt)}
                <span className="text-xs text-amber-600">→</span>
                {getBeltBadge(c.targetBelt)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GradeCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold">{count}</div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix }: { icon: string; label: string; value: number; color: string; suffix?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    red: 'bg-red-50 border-red-200 text-red-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    gray: 'bg-gray-50 border-gray-200 text-gray-500',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    coral: 'bg-red-50 border-red-200 text-red-500',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colorMap[color] || colorMap.blue}`}>
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-2xl font-bold">{suffix || value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

// ==================== 考生管理頁 ====================
function CandidatesPage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
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
  const [beltFilter, setBeltFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);

  const { data: allEvents } = trpc.events.getAll.useQuery({ type: 'exam' });

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    let list = candidates as any[];
    if (beltFilter !== 'all') list = list.filter(c => c.currentBelt === beltFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
    }
    return list;
  }, [candidates, searchQuery, beltFilter]);

  const examData = exam as any;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">考生管理</h1>
          {examData && <p className="text-sm text-gray-500">{examData.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}>
            <Upload className="w-4 h-4 mr-1" /> 匯入考生
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> 新增考生
          </Button>
        </div>
      </div>

      {/* Import from event */}
      {showImport && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
          <p className="text-sm font-medium text-blue-700">選擇考試活動匯入報名學生：</p>
          {allEvents && (allEvents as any[]).length > 0 ? (
            <div className="space-y-1">
              {(allEvents as any[]).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between bg-white rounded p-2">
                  <span className="text-sm">{ev.title} ({new Date(ev.eventDate).toLocaleDateString('zh-TW')})</span>
                  <Button size="sm" variant="outline" onClick={() => importFromEvent.mutate({ examId, eventId: ev.id })} disabled={importFromEvent.isPending}>
                    {importFromEvent.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '匯入'}
                  </Button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">沒有考試類型的活動</p>}
        </div>
      )}

      {/* Add candidate form */}
      {showAdd && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">新增考生</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input placeholder="姓名*" value={addName} onChange={e => setAddName(e.target.value)} />
            <Input placeholder="電話" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            <select value={addGender} onChange={e => setAddGender(e.target.value as any)} className="border rounded-md px-3 py-2 text-sm">
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
            <Input placeholder="年齡" type="number" value={addAge} onChange={e => setAddAge(e.target.value)} />
            <Input placeholder="道場" value={addDojoName} onChange={e => setAddDojoName(e.target.value)} />
            <select value={addCurrentBelt} onChange={e => setAddCurrentBelt(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
            </select>
            <select value={addTargetBelt} onChange={e => setAddTargetBelt(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => {
              if (!addName) { toast.error('請填寫姓名'); return; }
              createCandidate.mutate({ examId, name: addName, phone: addPhone || undefined, gender: addGender, age: addAge ? parseInt(addAge) : undefined, dojoName: addDojoName || undefined, currentBelt: addCurrentBelt, targetBelt: addTargetBelt });
              setAddName(''); setAddPhone(''); setAddAge(''); setAddDojoName('');
            }} className="bg-blue-600 text-white" disabled={createCandidate.isPending}>
              {createCandidate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '新增'}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input placeholder="搜尋考生姓名..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={beltFilter} onChange={e => setBeltFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="all">全部級別</option>
          {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
        </select>
      </div>

      {/* Candidate Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium">考生列表</h3>
          <p className="text-sm text-gray-500">共 {candidates?.length || 0} 位考生</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 w-12">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">編號</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">姓名</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">電話</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">性別</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">年齡</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">道場</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">現時級別</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">繳交級別</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">狀態</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCandidates.map((c: any, idx: number) => {
                const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.registered;
                const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : `${idx + 1}`;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
                    <td className="px-3 py-2 font-medium text-gray-700">{code}</td>
                    <td className="px-3 py-2 font-medium text-blue-700">{c.name}</td>
                    <td className="px-3 py-2 text-gray-600">{c.phone || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{GENDER_MAP[c.gender] || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.age ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.dojoName || '-'}</td>
                    <td className="px-3 py-2">{getBeltBadge(c.currentBelt)}</td>
                    <td className="px-3 py-2">{getBeltBadge(c.targetBelt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
                        <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1 text-gray-400 hover:text-blue-500"><MessageSquare className="w-4 h-4" /></button>
                        <button className="p-1 text-gray-400 hover:text-red-500"
                          onClick={() => { if (confirm(`確定刪除 ${c.name}？`)) deleteCandidate.mutate({ id: c.id }); }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCandidates.length === 0 && (
            <div className="text-center py-8 text-gray-400">沒有符合條件的考生</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 批量評分頁 ====================
function ScoringPage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: schedules } = trpc.exam.schedules.list.useQuery({ examId });
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const initForBelt = trpc.exam.scoringItems.initForBelt.useMutation({
    onSuccess: (data: any) => toast.success(`已初始化 ${data.count} 個評分項目`),
  });

  const groups = useMemo(() => {
    if (!candidates || !schedules) return [];
    const allCandidates = candidates as any[];
    const allSchedules = (schedules as any[]).sort((a: any, b: any) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    // Group candidates by groupCode
    const groupMap = new Map<string, { code: string; belts: Set<string>; candidates: any[]; scored: number; pending: number; absent: number }>();
    
    for (const c of allCandidates) {
      const code = c.groupCode || 'ungrouped';
      if (!groupMap.has(code)) groupMap.set(code, { code, belts: new Set(), candidates: [], scored: 0, pending: 0, absent: 0 });
      const g = groupMap.get(code)!;
      g.candidates.push(c);
      g.belts.add(c.currentBelt);
      if (c.status === 'absent') g.absent++;
      else if (['passed', 'failed'].includes(c.status)) g.scored++;
      else g.pending++;
    }

    return Array.from(groupMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [candidates, schedules]);

  const examData = exam as any;

  if (selectedGroup) {
    return <BatchScoringTable examId={examId} groupCode={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">批量評分</h1>
          {examData && <p className="text-sm text-gray-500">{examData.name}</p>}
        </div>
        <select className="border rounded-md px-3 py-2 text-sm">
          <option>全部組別</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-bold mb-1">請選擇組別進行評分</h3>
        <p className="text-sm text-gray-500 mb-4">選擇一個組別以檢示該組的所有考生評分表（同一組可能包含不同級別的考生）</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {groups.map(g => (
            <div key={g.code}
              onClick={() => setSelectedGroup(g.code)}
              className="border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300">
              <h4 className="text-lg font-bold mb-2">{g.code === 'ungrouped' ? '未分組' : `${g.code.toUpperCase()} 組`}</h4>
              <div className="flex flex-wrap gap-1 mb-2">
                {Array.from(g.belts).sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99)).map(belt => (
                  <span key={belt} className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${BELT_LEVELS[belt]?.color || 'bg-gray-100'} ${BELT_LEVELS[belt]?.textColor || 'text-gray-700'}`}>
                    {getBeltName(belt)}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-600">共 {g.candidates.length} 位考生</p>
              {g.scored > 0 && <p className="text-xs text-green-600">{g.scored} 位已評分</p>}
              {g.pending > 0 && <p className="text-xs text-amber-600">{g.pending} 位待評分</p>}
              {g.absent > 0 && <p className="text-xs text-red-500">{g.absent} 位缺席</p>}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400">
              <p>尚未建立分組</p>
              <p className="text-sm mt-1">請先在時間表頁面進行分組</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 匯出/列印工具函數 ====================
function exportScoringToCSV(
  beltCandidates: any[],
  categorizedItems: { category: string; name: string; items: any[] }[],
  scoreMap: Map<number, Map<number, string>>,
  groupCode: string,
  beltName: string,
) {
  const headers = ['編號', '姓名', '色帶', '狀態', ...categorizedItems.flatMap(cat => cat.items.map(item => item.name))];
  const rows = beltCandidates.map((c: any, idx: number) => {
    const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : `${idx + 1}`;
    const candidateScores = scoreMap.get(c.id) || new Map<number, string>();
    const STATUS_LABELS: Record<string, string> = { passed: '合格', failed: '不合格', absent: '缺席', checked_in: '已報到', registered: '已報名' };
    return [
      code, c.name, beltName, STATUS_LABELS[c.status] || c.status,
      ...categorizedItems.flatMap(cat => cat.items.map(item => candidateScores.get(item.id) || ''))
    ];
  });
  
  // BOM for Chinese characters in Excel
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `評分表_${groupCode.toUpperCase()}組_${beltName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printScoringTable(
  beltCandidates: any[],
  categorizedItems: { category: string; name: string; items: any[] }[],
  scoreMap: Map<number, Map<number, string>>,
  groupCode: string,
  beltName: string,
) {
  const headerCells = categorizedItems.flatMap(cat => cat.items.map(item => `<th style="border:1px solid #ccc;padding:4px;font-size:10px;">${item.name}</th>`)).join('');
  const bodyRows = beltCandidates.map((c: any, idx: number) => {
    const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : `${idx + 1}`;
    const candidateScores = scoreMap.get(c.id) || new Map<number, string>();
    const STATUS_LABELS: Record<string, string> = { passed: '合格', failed: '不合格', absent: '缺席', checked_in: '已報到', registered: '已報名' };
    const scoreCells = categorizedItems.flatMap(cat => cat.items.map(item => {
      const score = candidateScores.get(item.id) || '';
      const color = score === 'A' ? '#16a34a' : score === 'B' ? '#2563eb' : score === 'C' ? '#ea580c' : score === 'pass' ? '#16a34a' : score === 'fail' ? '#dc2626' : '#000';
      return `<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:11px;color:${color};font-weight:bold;">${score}</td>`;
    })).join('');
    return `<tr><td style="border:1px solid #ccc;padding:4px;text-align:center;">${code}</td><td style="border:1px solid #ccc;padding:4px;">${c.name}</td><td style="border:1px solid #ccc;padding:4px;text-align:center;">${STATUS_LABELS[c.status] || c.status}</td>${scoreCells}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>評分表 ${groupCode.toUpperCase()}組 ${beltName}</title><style>@media print{body{margin:0;}table{width:100%;border-collapse:collapse;}}</style></head><body>
    <h2 style="text-align:center;margin-bottom:8px;">${groupCode.toUpperCase()} 組 評分表 - ${beltName}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#f3f4f6;"><th style="border:1px solid #ccc;padding:4px;">編號</th><th style="border:1px solid #ccc;padding:4px;">姓名</th><th style="border:1px solid #ccc;padding:4px;">狀態</th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

function exportCandidateListToCSV(candidates: any[], examName: string, filterLabel: string) {
  const GENDER_MAP: Record<string, string> = { male: '男', female: '女' };
  const headers = ['編號', '姓名', '性別', '年齡', '道場', '現時級別', '報考級別', '狀態'];
  const rows = candidates.map((c: any) => {
    const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : '-';
    const STATUS_LABELS: Record<string, string> = { passed: '合格', failed: '不合格', absent: '缺席', checked_in: '已報到', registered: '已報名' };
    return [code, c.name, GENDER_MAP[c.gender] || '-', c.age ?? '-', c.dojoName || '-', getBeltName(c.currentBelt), getBeltName(c.targetBelt), STATUS_LABELS[c.status] || c.status];
  });
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${examName}_${filterLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function generateTimetableWhatsAppMessage(exam: any, schedules: any[], candidates: any[]) {
  let msg = `📋 ${exam.name}\n`;
  msg += `📅 ${new Date(exam.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}\n`;
  if (exam.location) msg += `📍 ${exam.location}\n`;
  msg += `\n`;
  
  const sorted = [...schedules].sort((a: any, b: any) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  for (const sch of sorted) {
    const groupCandidates = candidates.filter((c: any) => c.groupCode === sch.groupCode);
    if (groupCandidates.length === 0) continue;
    msg += `【${sch.groupCode?.toUpperCase() || '-'} 組】${getBeltName(sch.beltLevel)} | ${sch.timeSlot || `${sch.startTime}-${sch.endTime}`}\n`;
    msg += groupCandidates.map((c: any) => `  ${c.orderNumber || '-'}. ${c.name}`).join('\n');
    msg += '\n\n';
  }
  return msg;
}

// ==================== 批量評分表格 (A/B/C 矩陣) ====================
function BatchScoringTable({ examId, groupCode, onBack }: { examId: number; groupCode: string; onBack: () => void }) {
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const [activeBelt, setActiveBelt] = useState<string>('');

  const groupCandidates = useMemo(() => {
    if (!candidates) return [];
    return (candidates as any[]).filter(c => c.groupCode === groupCode);
  }, [candidates, groupCode]);

  const belts = useMemo(() => {
    const beltSet = new Set(groupCandidates.map(c => c.currentBelt));
    const sorted = Array.from(beltSet).sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99));
    return sorted;
  }, [groupCandidates]);

  const currentBelt = activeBelt || belts[0] || '';
  const beltCandidates = groupCandidates.filter(c => c.currentBelt === currentBelt);

  // scoring items for this belt
  const { data: scoringItems } = trpc.exam.scoringItems.listByBelt.useQuery(
    { beltLevel: currentBelt },
    { enabled: !!currentBelt }
  );

  const initForBelt = trpc.exam.scoringItems.initForBelt.useMutation({
    onSuccess: (data: any) => toast.success(`已初始化 ${data.count} 個評分項目`),
  });

  // Get all scores for this exam
  const { data: allScores, refetch: refetchScores } = trpc.exam.scores.listByExam.useQuery({ examId });

  const bulkUpsert = trpc.exam.scores.bulkUpsert.useMutation({
    onSuccess: () => { refetchScores(); refetchCandidates(); toast.success('評分已保存'); },
  });

  const markAbsent = trpc.exam.attendance.markAbsent.useMutation({
    onSuccess: (_data, variables) => {
      refetchCandidates();
      toast.success(variables.absent ? '已標記缺席' : '已取消缺席');
    },
  });

  // Organize scores by candidate
  const scoreMap = useMemo(() => {
    if (!allScores) return new Map<number, Map<number, string>>();
    const map = new Map<number, Map<number, string>>();
    (allScores as any[]).forEach((entry: any) => {
      // API returns { score: { candidateId, scoringItemId, score }, candidate, item }
      const s = entry.score || entry;
      const cid = s.candidateId;
      const itemId = s.scoringItemId;
      const scoreVal = s.score;
      if (cid && itemId && scoreVal) {
        if (!map.has(cid)) map.set(cid, new Map());
        map.get(cid)!.set(itemId, scoreVal);
      }
    });
    return map;
  }, [allScores]);

  const items = (scoringItems as any[]) || [];

  // Group items by category
  const categorizedItems = useMemo(() => {
    const cats: { category: string; name: string; items: any[] }[] = [];
    const catMap = new Map<string, any[]>();
    for (const item of items) {
      const cat = item.category || 'other';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(item);
    }
    catMap.forEach((items, cat) => {
      cats.push({ category: cat, name: CATEGORY_NAMES[cat] || cat, items });
    });
    return cats;
  }, [items]);

  const handleScoreClick = (candidateId: number, scoringItemId: number, score: string) => {
    bulkUpsert.mutate({ candidateId, scores: [{ scoringItemId, score }] });
  };

  const scoredCount = beltCandidates.filter(c => ['passed', 'failed'].includes(c.status)).length;
  const absentCount = beltCandidates.filter(c => c.status === 'absent').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> 返回</Button>
          <div>
            <h2 className="text-lg font-bold">{groupCode === 'ungrouped' ? '未分組' : `${groupCode.toUpperCase()} 組`} 批量評分表</h2>
            <p className="text-sm text-gray-500">
              共 {beltCandidates.length} 位考生（{scoredCount} 位已評分{absentCount > 0 ? `，${absentCount} 位缺席` : ''}）級別：{getBeltName(currentBelt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportScoringToCSV(beltCandidates, categorizedItems, scoreMap, groupCode, getBeltName(currentBelt))}><Download className="w-4 h-4 mr-1" /> 匯出 Excel</Button>
          <Button size="sm" variant="outline" onClick={() => printScoringTable(beltCandidates, categorizedItems, scoreMap, groupCode, getBeltName(currentBelt))}><Printer className="w-4 h-4 mr-1" /> 列印評分表</Button>
          {currentBelt && items.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => initForBelt.mutate({ beltLevel: currentBelt })} disabled={initForBelt.isPending}>
              {initForBelt.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} 初始化評分項目
            </Button>
          )}
        </div>
      </div>

      {/* Belt tabs */}
      {belts.length > 1 && (
        <div className="flex gap-1">
          {belts.map(b => (
            <button key={b}
              onClick={() => setActiveBelt(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (activeBelt || belts[0]) === b ? 'bg-white shadow border text-gray-900' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {getBeltName(b)} ({groupCandidates.filter(c => c.currentBelt === b).length}人)
            </button>
          ))}
        </div>
      )}

      {/* Scoring Matrix Table */}
      {items.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {/* Category header row */}
              <tr className="border-b">
                <th className="px-2 py-1 border-r bg-gray-50 min-w-[40px]" rowSpan={2}>編號</th>
                <th className="px-2 py-1 border-r bg-gray-50 min-w-[60px]" rowSpan={2}>姓名</th>
                <th className="px-2 py-1 border-r bg-gray-50 min-w-[50px]" rowSpan={2}>色帶</th>
                <th className="px-2 py-1 border-r bg-gray-50 min-w-[60px]" rowSpan={2}>狀態</th>
                {categorizedItems.map(cat => (
                  <th key={cat.category} colSpan={cat.items.length}
                    className={`px-2 py-1.5 text-center text-white text-xs font-bold ${
                      cat.category === 'fitness' ? 'bg-green-600' :
                      cat.category === 'technique' ? 'bg-blue-600' :
                      cat.category === 'poomsae' ? 'bg-purple-600' :
                      cat.category === 'board' ? 'bg-amber-600' :
                      cat.category === 'sparring' ? 'bg-red-600' :
                      cat.category === 'split' || cat.category === 'side_split' ? 'bg-pink-600' :
                      cat.category === 'competition' ? 'bg-teal-600' :
                      'bg-gray-600'
                    }`}>
                    {cat.name}
                  </th>
                ))}
              </tr>
              {/* Item name row */}
              <tr className="border-b bg-gray-50">
                {categorizedItems.flatMap(cat => cat.items.map(item => (
                  <th key={item.id} className="px-1 py-1 text-center border-r min-w-[80px]">
                    <div className="font-medium text-[10px] leading-tight">{item.name}</div>
                    {item.description && <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{item.description}</div>}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {beltCandidates.map((c: any, idx: number) => {
                const isAbsent = c.status === 'absent';
                const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.registered;
                const candidateScores = scoreMap.get(c.id) || new Map<number, string>();
                const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : `${idx + 1}`;
                return (
                  <tr key={c.id} className={isAbsent ? 'bg-red-50/60 opacity-70' : 'hover:bg-gray-50'}>
                    <td className="px-2 py-2 border-r font-medium text-center">{code}</td>
                    <td className="px-2 py-2 border-r">
                      <div className={`font-medium ${isAbsent ? 'line-through text-gray-400' : ''}`}>{c.name}</div>
                      <div className="text-[10px] text-gray-400">{c.dojoName || ''}</div>
                    </td>
                    <td className="px-2 py-2 border-r text-center">{getBeltBadge(c.currentBelt)}</td>
                    <td className="px-2 py-2 border-r text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                          <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
                        </span>
                        {c.hasLakLakAward && <div className="text-[10px] text-amber-500 font-medium">⭐叻叻獎</div>}
                        {isAbsent ? (
                          <button
                            onClick={() => markAbsent.mutate({ candidateId: c.id, absent: false })}
                            disabled={markAbsent.isPending}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                            取消缺席
                          </button>
                        ) : (
                          <button
                            onClick={() => markAbsent.mutate({ candidateId: c.id, absent: true })}
                            disabled={markAbsent.isPending}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                            標記缺席
                          </button>
                        )}
                      </div>
                    </td>
                    {categorizedItems.flatMap(cat => cat.items.map(item => {
                      const currentScore = candidateScores.get(item.id) || '';
                      const isGrade = item.type === 'grade';
                      const isPassFail = item.type === 'pass_fail';
                      const isYesNo = item.type === 'yes_no';

                      if (isAbsent) {
                        return (
                          <td key={item.id} className="px-1 py-1 border-r text-center">
                            <span className="text-[10px] text-gray-300">—</span>
                          </td>
                        );
                      }

                      return (
                        <td key={item.id} className="px-1 py-1 border-r text-center">
                          {isGrade ? (
                            <div className="flex items-center justify-center gap-1">
                              {['A', 'B', 'C'].map(grade => (
                                <button key={grade}
                                  onClick={() => handleScoreClick(c.id, item.id, grade)}
                                  className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
                                    currentScore === grade
                                      ? grade === 'A' ? 'bg-green-500 text-white shadow'
                                        : grade === 'B' ? 'bg-blue-500 text-white shadow'
                                        : 'bg-orange-500 text-white shadow'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}>
                                  {grade}
                                </button>
                              ))}
                            </div>
                          ) : isPassFail ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleScoreClick(c.id, item.id, 'pass')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  currentScore === 'pass' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}>合格</button>
                              <button onClick={() => handleScoreClick(c.id, item.id, 'fail')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  currentScore === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}>不合格</button>
                            </div>
                          ) : isYesNo ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleScoreClick(c.id, item.id, 'pass')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  currentScore === 'pass' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}>是</button>
                              <button onClick={() => handleScoreClick(c.id, item.id, 'fail')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  currentScore === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}>否</button>
                            </div>
                          ) : null}
                        </td>
                      );
                    }))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>此帶級尚無評分項目</p>
          <p className="text-sm mt-1">請點擊「初始化評分項目」按鈕</p>
        </div>
      )}
    </div>
  );
}

// ==================== 時間表頁 ====================
function TimetablePage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: schedules, refetch } = trpc.exam.schedules.list.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const [viewMode, setViewMode] = useState<'timetable' | 'groups'>('timetable');

  const createSchedule = trpc.exam.schedules.create.useMutation({ onSuccess: () => { refetch(); toast.success('已新增'); } });
  const deleteSchedule = trpc.exam.schedules.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });

  const [showCreate, setShowCreate] = useState(false);
  const [newBelt, setNewBelt] = useState('white');
  const [newGroup, setNewGroup] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('');

  const sortedSchedules = useMemo(() => {
    if (!schedules) return [];
    return [...(schedules as any[])].sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }, [schedules]);

  const examData = exam as any;

  // Build timetable rows with candidate assignments
  const timetableRows = useMemo(() => {
    if (!sortedSchedules.length || !candidates) return [];
    const allCandidates = candidates as any[];
    
    return sortedSchedules.map((sch: any) => {
      const groupCandidates = allCandidates
        .filter(c => c.groupCode === sch.groupCode)
        .sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0));
      
      return {
        ...sch,
        beltName: getBeltName(sch.beltLevel),
        candidateCount: groupCandidates.length,
        candidates: groupCandidates,
      };
    });
  }, [sortedSchedules, candidates]);

  const maxPositions = Math.max(9, ...timetableRows.map(r => r.candidates.length));

  // Time slot color mapping
  const getTimeSlotColor = (belt: string) => {
    const level = BELT_LEVELS[belt];
    if (!level) return 'bg-gray-100 text-gray-700';
    if (level.order <= 2) return 'bg-red-100 text-red-700';
    if (level.order <= 4) return 'bg-green-100 text-green-700';
    if (level.order <= 6) return 'bg-amber-100 text-amber-700';
    if (level.order <= 8) return 'bg-blue-100 text-blue-700';
    return 'bg-purple-100 text-purple-700';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">分組時間表</h1>
          {examData && <p className="text-sm text-gray-500">{examData.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            if (!examData || !candidates) return;
            const msg = generateTimetableWhatsAppMessage(examData, sortedSchedules, candidates as any[]);
            navigator.clipboard.writeText(msg);
            toast.success('時間表已複製到剪貼板，可貼上 WhatsApp');
          }}><Mail className="w-4 h-4 mr-1" /> 複製通知</Button>
          <Button size="sm" variant="outline" onClick={() => {
            if (!examData || !candidates) return;
            const msg = generateTimetableWhatsAppMessage(examData, sortedSchedules, candidates as any[]);
            const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
          }}><Send className="w-4 h-4 mr-1" /> WhatsApp 通知</Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> 新增時間表
          </Button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setViewMode('timetable')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'timetable' ? 'bg-white shadow' : 'text-gray-500'}`}>
          時間表
        </button>
        <button onClick={() => setViewMode('groups')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'groups' ? 'bg-white shadow' : 'text-gray-500'}`}>
          分組表
        </button>
      </div>

      {/* Create schedule form */}
      {showCreate && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">新增時間表</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <select value={newBelt} onChange={e => setNewBelt(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
            </select>
            <Input placeholder="組別 (A/B/C...)" value={newGroup} onChange={e => setNewGroup(e.target.value)} />
            <Input placeholder="開始時間" value={newStart} onChange={e => setNewStart(e.target.value)} />
            <Input placeholder="結束時間" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            <Input placeholder="時段" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => {
              createSchedule.mutate({ examId, beltLevel: newBelt, groupCode: newGroup || undefined, startTime: newStart, endTime: newEnd || undefined, timeSlot: newTimeSlot || undefined });
              setNewGroup(''); setNewStart(''); setNewEnd(''); setNewTimeSlot('');
            }} className="bg-blue-600 text-white">新增</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Timetable view */}
      {viewMode === 'timetable' && (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-2 text-left font-medium border-r">級別</th>
                <th className="px-2 py-2 text-center font-medium border-r w-12">人數</th>
                <th className="px-2 py-2 text-center font-medium border-r">所需時間</th>
                <th className="px-2 py-2 text-center font-medium border-r">開始時間</th>
                <th className="px-2 py-2 text-center font-medium border-r">結束時間</th>
                <th className="px-2 py-2 text-center font-medium border-r">實際時間</th>
                <th className="px-2 py-2 text-center font-medium border-r w-10">組別</th>
                {Array.from({ length: Math.min(maxPositions, 9) }, (_, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium border-r min-w-[60px]">位置 {i + 1}</th>
                ))}
                <th className="px-2 py-2 text-center font-medium w-10">刪除</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {timetableRows.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 border-r">
                    {getBeltBadge(row.beltLevel)}
                  </td>
                  <td className="px-2 py-2 border-r text-center font-medium">{row.candidateCount}</td>
                  <td className="px-2 py-2 border-r text-center text-gray-600">-</td>
                  <td className="px-2 py-2 border-r text-center">{row.startTime || '-'}</td>
                  <td className="px-2 py-2 border-r text-center">{row.endTime || '-'}</td>
                  <td className="px-2 py-2 border-r text-center">
                    {row.timeSlot ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getTimeSlotColor(row.beltLevel)}`}>
                        {row.timeSlot}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-2 py-2 border-r text-center font-bold">{row.groupCode?.toUpperCase() || '-'}</td>
                  {Array.from({ length: Math.min(maxPositions, 9) }, (_, i) => (
                    <td key={i} className="px-2 py-2 border-r text-center">
                      {row.candidates[i] ? (
                        <span className="text-xs">{row.candidates[i].name}</span>
                      ) : null}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => deleteSchedule.mutate({ id: row.id })} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {timetableRows.length === 0 && (
                <tr><td colSpan={99} className="text-center py-8 text-gray-400">尚無時間表</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Groups view */}
      {viewMode === 'groups' && (
        <div className="space-y-3">
          {sortedSchedules.map((sch: any) => {
            const groupCandidates = candidates ? (candidates as any[]).filter(c => c.groupCode === sch.groupCode) : [];
            return (
              <div key={sch.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-bold">{sch.groupCode?.toUpperCase() || '-'} 組</span>
                  {getBeltBadge(sch.beltLevel)}
                  <span className="text-sm text-gray-500">{groupCandidates.length} 人</span>
                  {sch.timeSlot && <span className={`px-2 py-0.5 rounded text-xs ${getTimeSlotColor(sch.beltLevel)}`}>{sch.timeSlot}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupCandidates.map((c: any) => (
                    <span key={c.id} className="inline-flex items-center bg-gray-50 border rounded px-2 py-1 text-sm">
                      {c.name}
                    </span>
                  ))}
                  {groupCandidates.length === 0 && <span className="text-sm text-gray-400">尚無考生</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== 考試結果頁 ====================
function ResultsPage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const { data: candidates, refetch } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: allScores } = trpc.exam.scores.listByExam.useQuery({ examId });
  const promoteAll = trpc.exam.promoteAll.useMutation({
    onSuccess: (data: any) => { refetch(); toast.success(`已升帶 ${data.promoted} 人`); },
    onError: (err) => toast.error(err.message),
  });
  const promoteSingle = trpc.exam.promote.useMutation({
    onSuccess: () => { refetch(); toast.success('升帶成功'); },
    onError: (err) => toast.error(err.message),
  });

  const [activeTab, setActiveTab] = useState<'passed' | 'failed' | 'absent'>('passed');
  const [beltFilter, setBeltFilter] = useState('all');

  const allCandidates = (candidates as any[]) || [];
  const passed = allCandidates.filter(c => c.status === 'passed');
  const failed = allCandidates.filter(c => c.status === 'failed');
  const absent = allCandidates.filter(c => c.status === 'absent');
  const s = stats as any;
  const passRate = s && (s.passed + s.failed) > 0 ? ((s.passed / (s.passed + s.failed)) * 100).toFixed(1) : '0';

  const currentList = activeTab === 'passed' ? passed : activeTab === 'failed' ? failed : absent;
  const filteredList = beltFilter === 'all' ? currentList : currentList.filter(c => c.currentBelt === beltFilter);

  const examData = exam as any;

  // WhatsApp 成績通知
  function getFailedItems(candidateId: number): string[] {
    if (!allScores) return [];
    const scores = (allScores as any[]).filter(s => s.score.candidateId === candidateId);
    const failedItems: string[] = [];
    for (const s of scores) {
      const score = s.score.score;
      if (score === 'fail' || score === 'false' || score === 'F') {
        const category = CATEGORY_NAMES[s.item.category] || s.item.category || '';
        failedItems.push(category ? `${category} - ${s.item.name}` : s.item.name);
      }
    }
    return failedItems;
  }

  function generateResultMessage(candidate: any, examName: string) {
    const beltFrom = getBeltName(candidate.currentBelt);
    const beltTo = getBeltName(candidate.targetBelt);
    const isPassed = candidate.status === 'passed';
    const isFailed = candidate.status === 'failed';
    const lakLak = candidate.hasLakLakAward ? '\n🌟 恭喜獲得「叻叻獎」！' : '';

    if (isPassed) {
      return `🎉 ${examName} 成績通知\n\n` +
        `✅ ${candidate.name} 同學\n` +
        `報考: ${beltFrom} → ${beltTo}\n` +
        `結果: 合格 🎊${lakLak}\n\n` +
        `恭喜通過升級試！繼續努力練習！💪\n\n` +
        `— 創武跆拳道`;
    } else if (isFailed) {
      const failedItems = getFailedItems(candidate.id);
      const failedSection = failedItems.length > 0
        ? `\n\n不合格項目:\n${failedItems.map(item => `  ❌ ${item}`).join('\n')}\n`
        : '';
      return `📋 ${examName} 成績通知\n\n` +
        `${candidate.name} 同學\n` +
        `報考: ${beltFrom} → ${beltTo}\n` +
        `結果: 未通過${failedSection}\n` +
        `請針對以上項目加強練習，下次再接再厲！加油！💪\n\n` +
        `— 創武跆拳道`;
    } else {
      return `📋 ${examName} 成績通知\n\n` +
        `${candidate.name} 同學\n` +
        `報考: ${beltFrom} → ${beltTo}\n` +
        `狀態: ${STATUS_CONFIG[candidate.status]?.label || candidate.status}\n\n` +
        `— 創武跆拳道`;
    }
  }

  function sendWhatsAppResult(candidate: any) {
    if (!candidate.phone) {
      toast.error(`${candidate.name} 沒有電話號碼`);
      return;
    }
    const msg = generateResultMessage(candidate, examData?.name || '升級試');
    const phone = candidate.phone.startsWith('852') ? candidate.phone : `852${candidate.phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function sendBulkWhatsAppResults() {
    const withPhone = filteredList.filter(c => c.phone);
    if (withPhone.length === 0) {
      toast.error('沒有考生有電話號碼');
      return;
    }
    // 逐個開啟（瀏覽器可能會擋，建議用複製方式）
    if (withPhone.length > 5) {
      // 太多人，改為複製全部訊息
      const msgs = withPhone.map(c => {
        const beltFrom = getBeltName(c.currentBelt);
        const beltTo = getBeltName(c.targetBelt);
        const result = c.status === 'passed' ? '✅合格' : c.status === 'failed' ? '❌未通過' : c.status;
        const lakLak = c.hasLakLakAward ? ' 🌟叻叻獎' : '';
        return `${c.name} (${c.phone}) | ${beltFrom}→${beltTo} | ${result}${lakLak}`;
      }).join('\n');
      const header = `📋 ${examData?.name || '升級試'} — ${activeTab === 'passed' ? '合格' : activeTab === 'failed' ? '不合格' : '缺席'}名單\n${'─'.repeat(20)}\n`;
      navigator.clipboard.writeText(header + msgs);
      toast.success(`已複製 ${withPhone.length} 位考生成績到剪貼板`);
    } else {
      // 5人以下逐個開 WhatsApp
      withPhone.forEach((c, i) => {
        setTimeout(() => sendWhatsAppResult(c), i * 500);
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">考試結果</h1>
          {examData && <p className="text-sm text-gray-500">{examData.name}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          const TAB_LABELS: Record<string, string> = { passed: '合格名單', failed: '不合格名單', absent: '缺席名單' };
          exportCandidateListToCSV(filteredList, examData?.name || '考試', TAB_LABELS[activeTab] || activeTab);
        }}><Download className="w-4 h-4 mr-1" /> 匯出名單</Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard icon="👥" label="考生人數" value={s?.total || 0} color="blue" />
        <StatCard icon="✅" label="合格人數" value={s?.passed || 0} color="green" />
        <StatCard icon="❌" label="不合格人數" value={s?.failed || 0} color="red" />
        <StatCard icon="📊" label="合格率" value={0} color="orange" suffix={`${passRate}%`} />
        <StatCard icon="🚫" label="缺席人數" value={s?.absent || 0} color="coral" />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveTab('passed')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${activeTab === 'passed' ? 'bg-white shadow' : 'text-gray-500'}`}>
            ✓ 合格名單 ({passed.length})
          </button>
          <button onClick={() => setActiveTab('failed')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${activeTab === 'failed' ? 'bg-white shadow' : 'text-gray-500'}`}>
            ✗ 不合格名單 ({failed.length})
          </button>
          <button onClick={() => setActiveTab('absent')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${activeTab === 'absent' ? 'bg-white shadow' : 'text-gray-500'}`}>
            🔗 缺席名單 ({absent.length})
          </button>
        </div>
        <div className="flex gap-2">
          <select value={beltFilter} onChange={e => setBeltFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
            <option value="all">全部級別</option>
            {BELT_ORDER_KEYS.map(b => <option key={b} value={b}>{getBeltName(b)}</option>)}
          </select>
          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
            onClick={sendBulkWhatsAppResults}>
            <Send className="w-4 h-4 mr-1" /> WhatsApp 通知成績
          </Button>
          {activeTab === 'passed' && (
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (confirm('確定將所有合格考生升帶？')) promoteAll.mutate({ examId }); }}
              disabled={promoteAll.isPending}>
              {promoteAll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowUpCircle className="w-4 h-4 mr-1" />}
              一鍵升帶
            </Button>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">編號</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">姓名</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">性別</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">年齡</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">道場</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">現時級別</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">報考級別</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredList.map((c: any) => {
              const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : '-';
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{code}</td>
                  <td className="px-3 py-2 font-medium text-blue-700">
                    {c.name}
                    {c.hasLakLakAward && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">⭐</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{GENDER_MAP[c.gender] || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{c.age ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{c.dojoName || '-'}</td>
                  <td className="px-3 py-2">{getBeltBadge(c.currentBelt)}</td>
                  <td className="px-3 py-2">{getBeltBadge(c.targetBelt)}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {activeTab === 'passed' && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => promoteSingle.mutate({ candidateId: c.id })} disabled={promoteSingle.isPending}>
                          <ArrowUpCircle className="w-3 h-3 mr-1" /> 升帶
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50"
                        onClick={() => sendWhatsAppResult(c)} title="WhatsApp 通知家長">
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredList.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>沒有符合條件的考生</p>
          </div>
        )}
      </div>
    </div>
  );
}
