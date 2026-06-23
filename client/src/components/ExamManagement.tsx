import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Mail, Send, ChevronRight, BarChart3, Zap, ListChecks, Phone,
  Menu, X
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

function getBeltShort(key: string) {
  const name = BELT_LEVELS[key]?.name || key;
  return name.replace('帶', '');
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
type NavPage = 'overview' | 'candidates' | 'checkin' | 'scoring' | 'scoreview' | 'timetable' | 'results';
const NAV_ITEMS: { key: NavPage; label: string; icon: any }[] = [
  { key: 'overview', label: '考試概覽', icon: LayoutDashboard },
  { key: 'candidates', label: '考生管理', icon: Users },
  { key: 'checkin', label: '點名', icon: ListChecks },
  { key: 'scoring', label: '評分', icon: ClipboardCheck },
  { key: 'scoreview', label: '成績記錄', icon: Eye },
  { key: 'timetable', label: '時間表', icon: Calendar },
  { key: 'results', label: '合格名單', icon: Trophy },
];

// ==================== 主組件 ====================
export default function ExamManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [navPage, setNavPage] = useState<NavPage>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (activeTab === 'list' || !selectedExamId) {
    return <ExamList onSelectExam={(id) => { setSelectedExamId(id); setActiveTab('detail'); setNavPage('overview'); }} />;
  }

  const currentNavItem = NAV_ITEMS.find(item => item.key === navPage);

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-64px)]">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b px-3 py-2 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
            {currentNavItem && <currentNavItem.icon className="w-4 h-4 text-blue-600" />}
            {currentNavItem?.label || '考試管理'}
          </div>
        </div>
        <button onClick={() => { setActiveTab('list'); setSelectedExamId(null); }}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Award className="w-4 h-4 text-red-600" />
                <span>創武考試管理</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <button onClick={() => { setActiveTab('list'); setSelectedExamId(null); setSidebarOpen(false); }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-b">
              <ArrowLeft className="w-4 h-4" /> 返回儀表板
            </button>
            <nav className="flex-1 py-2">
              {NAV_ITEMS.map(item => (
                <button key={item.key}
                  onClick={() => { setNavPage(item.key); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                    navPage === item.key ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex w-48 bg-white border-r flex-col shrink-0">
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
      <div className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 md:p-6">
        {navPage === 'overview' && <OverviewPage examId={selectedExamId} />}
        {navPage === 'candidates' && <CandidatesPage examId={selectedExamId} />}
        {navPage === 'checkin' && <CheckInPage examId={selectedExamId} />}
        {navPage === 'scoring' && <ScoringPage examId={selectedExamId} />}
        {navPage === 'scoreview' && <ScoreViewPage examId={selectedExamId} />}
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

  // Build group navigation info for BatchScoringTable
  const groupCodes = groups.map(g => g.code);
  const groupInfoMap = useMemo(() => {
    const m = new Map<string, { belts: string[] }>();
    for (const g of groups) {
      m.set(g.code, { belts: Array.from(g.belts) });
    }
    return m;
  }, [groups]);

  if (selectedGroup) {
    return <BatchScoringTable
      examId={examId}
      groupCode={selectedGroup}
      onBack={() => setSelectedGroup(null)}
      groupCodes={groupCodes}
      groupInfoMap={groupInfoMap}
      onNavigate={(code: string) => setSelectedGroup(code)}
    />;
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
function BatchScoringTable({ examId, groupCode, onBack, groupCodes, groupInfoMap, onNavigate }: {
  examId: number; groupCode: string; onBack: () => void;
  groupCodes: string[]; groupInfoMap: Map<string, { belts: string[] }>; onNavigate: (code: string) => void;
}) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
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

  const clearScore = trpc.exam.scores.clearScore.useMutation({
    onSuccess: () => { refetchScores(); refetchCandidates(); toast.success('已取消該項評分'); },
    onError: (err) => toast.error(err.message),
  });
  const clearAllScores = trpc.exam.scores.clearAllScores.useMutation({
    onSuccess: () => { refetchScores(); refetchCandidates(); toast.success('已取消該考生全部評分'); },
    onError: (err) => toast.error(err.message),
  });

  const handleClearScore = (candidateId: number, scoringItemId: number, itemName: string) => {
    const pw = prompt(`取消「${itemName}」的評分\n\n請輸入您的登入密碼以確認：`);
    if (!pw) return;
    clearScore.mutate({ candidateId, scoringItemId, password: pw });
  };

  const handleClearAllScores = (candidateId: number, candidateName: string) => {
    const pw = prompt(`⚠️ 取消「${candidateName}」的全部評分\n\n此操作會清除所有項目的評分並重置狀態為「已報名」。\n\n請輸入您的登入密碼以確認：`);
    if (!pw) return;
    clearAllScores.mutate({ candidateId, password: pw });
  };

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

  // Group navigation
  const currentGroupIdx = groupCodes.indexOf(groupCode);
  const prevGroup = currentGroupIdx > 0 ? groupCodes[currentGroupIdx - 1] : null;
  const nextGroup = currentGroupIdx < groupCodes.length - 1 ? groupCodes[currentGroupIdx + 1] : null;

  function getGroupLabel(code: string) {
    const info = groupInfoMap.get(code);
    const beltNames = info?.belts?.map(b => getBeltName(b)).join('・') || '';
    return `${code.toUpperCase()} 組${beltNames ? ` (${beltNames})` : ''}`;
  }

  function GroupNavBar() {
    return (
      <div className="flex items-center justify-between bg-gray-50 rounded-lg border px-3 py-2">
        {prevGroup ? (
          <button onClick={() => onNavigate(prevGroup)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 上一組：{getGroupLabel(prevGroup)}
          </button>
        ) : <div />}
        <span className="text-sm text-gray-500 font-medium">
          {currentGroupIdx + 1} / {groupCodes.length}
        </span>
        {nextGroup ? (
          <button onClick={() => onNavigate(nextGroup)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            下一組：{getGroupLabel(nextGroup)} <ChevronRight className="w-4 h-4" />
          </button>
        ) : <div />}
      </div>
    );
  }

  // --- WhatsApp 成績通知 ---
  const examData = exam as any;
  const examName = examData?.name || '升級試';

  function getFailedItemsForCandidate(candidateId: number): string[] {
    if (!allScores) return [];
    const failedItems: string[] = [];
    for (const entry of allScores as any[]) {
      const s = entry.score || entry;
      if (s.candidateId !== candidateId) continue;
      const score = s.score;
      if (score === 'fail' || score === 'false' || score === 'F') {
        const item = entry.item;
        if (item) {
          const category = CATEGORY_NAMES[item.category] || item.category || '';
          failedItems.push(category ? `${category} - ${item.name}` : item.name);
        }
      }
    }
    return failedItems;
  }

  function generateScoringResultMessage(candidate: any) {
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
      const failedItems = getFailedItemsForCandidate(candidate.id);
      const failedSection = failedItems.length > 0
        ? `\n\n不合格項目:\n${failedItems.map(item => `  ❌ ${item}`).join('\n')}\n`
        : '';
      return `📋 ${examName} 成績通知\n\n` +
        `${candidate.name} 同學\n` +
        `報考: ${beltFrom} → ${beltTo}\n` +
        `結果: 未通過${failedSection}\n` +
        `請針對以上項目加強練習，下次再接再厲！加油！💪\n\n` +
        `— 創武跆拳道`;
    }
    return '';
  }

  function sendWhatsAppScoringResult(candidate: any) {
    if (!candidate.phone) {
      toast.error(`${candidate.name} 沒有電話號碼`);
      return;
    }
    const msg = generateScoringResultMessage(candidate);
    if (!msg) {
      toast.error(`${candidate.name} 尚未評分完成`);
      return;
    }
    const phone = candidate.phone.startsWith('852') ? candidate.phone : `852${candidate.phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function sendBulkScoringResults() {
    const scoredCandidates = beltCandidates.filter(c => ['passed', 'failed'].includes(c.status) && c.phone);
    if (scoredCandidates.length === 0) {
      toast.error('沒有已評分且有電話號碼的考生');
      return;
    }
    if (scoredCandidates.length > 5) {
      const msgs = scoredCandidates.map(c => {
        const result = c.status === 'passed' ? '✅合格' : '❌未通過';
        const lakLak = c.hasLakLakAward ? ' 🌟叻叻獎' : '';
        return `${c.name} (${c.phone}) | ${getBeltName(c.currentBelt)}→${getBeltName(c.targetBelt)} | ${result}${lakLak}`;
      }).join('\n');
      const header = `📋 ${examName} — ${groupCode.toUpperCase()}組 成績\n${'─'.repeat(20)}\n`;
      navigator.clipboard.writeText(header + msgs);
      toast.success(`已複製 ${scoredCandidates.length} 位考生成績到剪貼板`);
    } else {
      scoredCandidates.forEach((c, i) => {
        setTimeout(() => sendWhatsAppScoringResult(c), i * 500);
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Top navigation */}
      <GroupNavBar />

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
          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={sendBulkScoringResults}>
            <Send className="w-4 h-4 mr-1" /> WhatsApp 通知成績
          </Button>
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
                <th className="px-1 py-1 border-r bg-red-50 min-w-[32px]" rowSpan={2} title="清除全部評分">
                  <Trash2 className="w-3 h-3 text-red-400 mx-auto" />
                </th>
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
                        {['passed', 'failed'].includes(c.status) && (
                          <button
                            onClick={() => sendWhatsAppScoringResult(c)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-0.5"
                            title={`WhatsApp 通知 ${c.name} 家長成績`}
                          >
                            <Send className="w-2.5 h-2.5" /> 通知
                          </button>
                        )}
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
                    <td className="px-1 py-1 border-r text-center">
                      {!isAbsent && candidateScores.size > 0 && (
                        <button
                          onClick={() => handleClearAllScores(c.id, c.name)}
                          disabled={clearAllScores.isPending}
                          className="p-0.5 rounded text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={`清除 ${c.name} 全部評分`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                        <td key={item.id} className="px-1 py-1 border-r text-center relative group/cell">
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
                          {currentScore && (
                            <button
                              onClick={() => handleClearScore(c.id, item.id, item.name)}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center text-[8px] leading-none shadow-sm"
                              title={`取消「${item.name}」評分`}
                            >✕</button>
                          )}
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

      {/* Bottom navigation */}
      <GroupNavBar />
    </div>
  );
}

// ==================== 時間表頁 ====================
function TimetablePage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: schedules, refetch } = trpc.exam.schedules.list.useQuery({ examId });
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const [viewMode, setViewMode] = useState<'timetable' | 'groups'>('timetable');

  const createSchedule = trpc.exam.schedules.create.useMutation({ onSuccess: () => { refetch(); toast.success('已新增'); } });
  const deleteSchedule = trpc.exam.schedules.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });
  const autoGroup = trpc.exam.candidates.autoGroup.useMutation({
    onSuccess: (data: any) => { refetch(); refetchCandidates(); toast.success(`已自動分為 ${data.groupCount} 組（${data.candidateCount} 人）`); setShowAutoGroup(false); },
    onError: (err) => toast.error(err.message),
  });
  const moveCandidate = trpc.exam.candidates.moveCandidate.useMutation({
    onSuccess: (data: any) => {
      refetch(); refetchCandidates();
      toast.success(`已移動到 ${data.newGroup} 組`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Tap-to-move state (works on both mobile & desktop)
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: number; name: string; groupCode: string } | null>(null);

  // Click a student to select; click again to deselect
  const handleSelectCandidate = useCallback((candidate: { id: number; name: string; groupCode: string }) => {
    setSelectedCandidate(prev => prev?.id === candidate.id ? null : candidate);
  }, []);

  // Click a cell to place the selected student there
  const handlePlaceCandidate = useCallback((targetGroupCode: string, targetPosition: number) => {
    if (!selectedCandidate) return;
    // Don't move to same position
    const cands = (candidates as any[] || []).filter((c: any) => c.groupCode === targetGroupCode).sort((a: any, b: any) => (a.orderNumber || 0) - (b.orderNumber || 0));
    const existingAtPos = cands[targetPosition - 1];
    if (existingAtPos?.id === selectedCandidate.id) {
      setSelectedCandidate(null);
      return;
    }
    moveCandidate.mutate({ candidateId: selectedCandidate.id, targetGroupCode, targetPosition });
    setSelectedCandidate(null);
  }, [selectedCandidate, moveCandidate, candidates]);

  const [showCreate, setShowCreate] = useState(false);
  const [showAutoGroup, setShowAutoGroup] = useState(false);
  const [agStartTime, setAgStartTime] = useState('10:00');
  const [agMinutes, setAgMinutes] = useState(30);
  const [agMaxPerGroup, setAgMaxPerGroup] = useState(10);
  const [agBreakAfter, setAgBreakAfter] = useState(4);
  const [agBreakMins, setAgBreakMins] = useState(15);
  const [agVenue, setAgVenue] = useState('');
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
      
      // Collect all unique target belts in this group
      const targetBelts = [...new Set(groupCandidates.map(c => c.targetBelt))]
        .sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99));

      return {
        ...sch,
        beltName: getBeltName(sch.beltLevel),
        candidateCount: groupCandidates.length,
        candidates: groupCandidates,
        targetBelts,
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

  // WhatsApp 通知考試時間
  function sendScheduleWhatsApp(candidate: any) {
    if (!candidate.phone) {
      toast.error(`${candidate.name} 沒有電話號碼`);
      return;
    }
    // Find the schedule for this candidate's group
    const sch = sortedSchedules.find((s: any) => s.groupCode === candidate.groupCode);
    const timeStr = sch?.timeSlot || (sch?.startTime && sch?.endTime ? `${sch.startTime}-${sch.endTime}` : '待定');
    const dateStr = examData?.examDate
      ? new Date(examData.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
      : '待定';
    const location = examData?.location || '';
    const beltFrom = getBeltName(candidate.currentBelt);
    const beltTo = getBeltName(candidate.targetBelt);

    let msg = `📋 ${examData?.name || '升級試'} — 考試通知\n\n`;
    msg += `👤 ${candidate.name} 同學\n`;
    msg += `🥋 報考: ${beltFrom} → ${beltTo}\n`;
    msg += `📅 日期: ${dateStr}\n`;
    msg += `⏰ 時間: ${timeStr}\n`;
    if (location) msg += `📍 地點: ${location}\n`;
    msg += `📌 組別: ${(candidate.groupCode || '').toUpperCase()} 組 第${candidate.orderNumber || '-'}位\n`;
    msg += `\n請準時到場，遲到者可能會被安排到較後組別。\n`;
    msg += `如有任何查詢，請聯絡我們。\n\n`;
    msg += `— 創武跆拳道`;

    const phone = candidate.phone.startsWith('852') ? candidate.phone : `852${candidate.phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

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
          <Button size="sm" onClick={() => { setShowAutoGroup(!showAutoGroup); setShowCreate(false); }} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Zap className="w-4 h-4 mr-1" /> 自動分組
          </Button>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setShowAutoGroup(false); }} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> 新增時間表
          </Button>
        </div>
      </div>

      {/* Auto-group configuration form */}
      {showAutoGroup && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">自動分組設定</h3>
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">根據帶級自動分組並產生時間表</span>
          </div>
          <p className="text-xs text-amber-700">系統會將考生依帶級排序，每組最多指定人數。同一帶級超過上限時自動拆分。分組後自動產生對應的時間表。</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">開始時間</label>
              <Input type="time" value={agStartTime} onChange={e => setAgStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">每組時間（分鐘）</label>
              <Input type="number" min={15} max={60} value={agMinutes} onChange={e => setAgMinutes(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">每組最多人數</label>
              <Input type="number" min={4} max={20} value={agMaxPerGroup} onChange={e => setAgMaxPerGroup(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">每幾組休息</label>
              <Input type="number" min={0} max={10} value={agBreakAfter} onChange={e => setAgBreakAfter(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">休息時間（分鐘）</label>
              <Input type="number" min={0} max={30} value={agBreakMins} onChange={e => setAgBreakMins(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">場地（選填）</label>
              <Input placeholder="如：A道場" value={agVenue} onChange={e => setAgVenue(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={() => autoGroup.mutate({
                examId,
                startTime: agStartTime,
                minutesPerGroup: agMinutes,
                maxPerGroup: agMaxPerGroup,
                breakAfterGroups: agBreakAfter,
                breakMinutes: agBreakMins,
                venue: agVenue || undefined,
              })}
              disabled={autoGroup.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {autoGroup.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              {autoGroup.isPending ? '分組中...' : '執行自動分組'}
            </Button>
            <Button variant="outline" onClick={() => setShowAutoGroup(false)}>取消</Button>
            {sortedSchedules.length > 0 && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> 執行後將清除現有分組和時間表
              </span>
            )}
          </div>
        </div>
      )}

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

      {/* Move indicator */}
      {selectedCandidate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between text-sm text-blue-700 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            正在移動 <strong>{selectedCandidate.name}</strong>（從 {selectedCandidate.groupCode.toUpperCase()} 組） — 點擊目標位置放置
          </div>
          <button onClick={() => setSelectedCandidate(null)} className="text-blue-500 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100">✕ 取消</button>
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
                    {row.targetBelts && row.targetBelts.length > 1 ? (
                      <div className="flex flex-col gap-0.5">
                        {row.targetBelts.map((b: string) => (
                          <span key={b} className={`inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium border ${BELT_LEVELS[b]?.color || 'bg-gray-100 border-gray-300'} ${BELT_LEVELS[b]?.textColor || 'text-gray-700'}`}>
                            考{getBeltShort(b)}
                          </span>
                        ))}
                      </div>
                    ) : getBeltBadge(row.beltLevel)}
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
                  {Array.from({ length: Math.min(maxPositions, 9) }, (_, i) => {
                    const c = row.candidates[i];
                    const isSelected = selectedCandidate && c && selectedCandidate.id === c.id;
                    const isPlaceTarget = selectedCandidate && !isSelected;
                    return (
                      <td key={i}
                        className={`px-1 py-1 border-r text-center transition-colors min-h-[40px] cursor-pointer
                          ${isPlaceTarget ? 'hover:bg-blue-100 hover:ring-2 hover:ring-blue-400 hover:ring-inset' : ''}`}
                        onClick={() => {
                          if (selectedCandidate && !(c && c.id === selectedCandidate.id)) {
                            handlePlaceCandidate(row.groupCode, i + 1);
                          }
                        }}
                      >
                        {c ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedCandidate && selectedCandidate.id !== c.id) {
                                // Place the selected student at this position (insert before this student)
                                handlePlaceCandidate(row.groupCode, i + 1);
                              } else {
                                // Select or deselect this student
                                handleSelectCandidate({ id: c.id, name: c.name, groupCode: row.groupCode });
                              }
                            }}
                            className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded text-xs cursor-pointer select-none transition-all
                              ${isSelected
                                ? 'bg-blue-500 text-white shadow-lg scale-105 ring-2 ring-blue-300'
                                : selectedCandidate
                                  ? 'bg-green-50 hover:bg-green-100 border border-green-300 hover:border-green-500'
                                  : 'bg-gray-50 hover:bg-blue-50 hover:shadow border border-transparent hover:border-blue-300'}`}
                            title={isSelected ? `點擊取消選擇` : selectedCandidate ? `點擊此處：將 ${selectedCandidate.name} 插入到 ${c.name} 前面` : `點擊選擇 ${c.name} 進行移動`}
                          >
                            <span>{c.name}</span>
                            <span className={`text-[9px] leading-tight ${isSelected ? 'text-blue-100' : BELT_LEVELS[c.targetBelt]?.textColor || 'text-gray-500'}`}>(考{getBeltShort(c.targetBelt)})</span>
                            {!selectedCandidate && (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); sendScheduleWhatsApp(c); }}
                                className="mt-0.5 px-1 py-0 rounded text-[8px] bg-green-100 text-green-700 hover:bg-green-300 transition-colors leading-tight"
                                title={`WhatsApp 通知 ${c.name} 考試時間`}
                              >📨通知</button>
                            )}
                          </div>
                        ) : selectedCandidate ? (
                          <div className="w-full h-8 rounded border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-500 flex items-center justify-center text-[10px] text-green-600 transition-colors">
                            放這裡
                          </div>
                        ) : (
                          <div className="w-full h-8 rounded" />
                        )}
                      </td>
                    );
                  })}
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
            const groupCandidates = candidates
              ? (candidates as any[]).filter(c => c.groupCode === sch.groupCode).sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0))
              : [];
            const grpTargetBelts = [...new Set(groupCandidates.map(c => c.targetBelt))]
              .sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99));
            return (
              <div key={sch.id}
                className={`bg-white rounded-lg border p-4 transition-colors ${selectedCandidate && selectedCandidate.groupCode !== sch.groupCode ? 'border-green-300 bg-green-50/30' : ''}`}
              >
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-lg font-bold">{sch.groupCode?.toUpperCase() || '-'} 組</span>
                  {grpTargetBelts.length > 1
                    ? grpTargetBelts.map(b => (
                        <span key={b} className={`inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium border ${BELT_LEVELS[b]?.color || 'bg-gray-100 border-gray-300'} ${BELT_LEVELS[b]?.textColor || 'text-gray-700'}`}>
                          考{getBeltShort(b)}
                        </span>
                      ))
                    : getBeltBadge(sch.beltLevel)
                  }
                  <span className="text-sm text-gray-500">{groupCandidates.length} 人</span>
                  {sch.timeSlot && <span className={`px-2 py-0.5 rounded text-xs ${getTimeSlotColor(sch.beltLevel)}`}>{sch.timeSlot}</span>}
                  {/* Add-to-group button when a student is selected */}
                  {selectedCandidate && (
                    <button
                      onClick={() => handlePlaceCandidate(sch.groupCode, groupCandidates.length + 1)}
                      className="ml-auto inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs rounded-full hover:bg-green-600 transition-colors shadow-sm"
                    >
                      <Plus className="w-3 h-3" /> 放到此組末尾
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {groupCandidates.map((c: any, idx: number) => {
                    const isSelected = selectedCandidate?.id === c.id;
                    return (
                      <div key={c.id}
                        onClick={() => {
                          if (selectedCandidate && selectedCandidate.id !== c.id) {
                            // Place before this student
                            handlePlaceCandidate(sch.groupCode, idx + 1);
                          } else {
                            handleSelectCandidate({ id: c.id, name: c.name, groupCode: sch.groupCode });
                          }
                        }}
                        className={`inline-flex flex-col items-center border rounded px-2 py-1 text-sm cursor-pointer select-none transition-all
                          ${isSelected
                            ? 'bg-blue-500 text-white border-blue-600 shadow-lg scale-105 ring-2 ring-blue-300'
                            : selectedCandidate
                              ? 'bg-green-50 hover:bg-green-100 border-green-300 hover:border-green-500 hover:shadow-sm'
                              : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm'}`}
                        title={isSelected ? '點擊取消選擇' : selectedCandidate ? `點擊此處：將 ${selectedCandidate.name} 放到 ${c.name} 前面` : `點擊選擇 ${c.name} 進行移動`}
                      >
                        <span>{c.name}</span>
                        <span className={`text-[9px] leading-tight ${isSelected ? 'text-blue-100' : BELT_LEVELS[c.targetBelt]?.textColor || 'text-gray-500'}`}>(考{getBeltShort(c.targetBelt)})</span>
                        {!selectedCandidate && (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); sendScheduleWhatsApp(c); }}
                            className="mt-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 hover:bg-green-300 transition-colors flex items-center gap-0.5"
                            title={`WhatsApp 通知 ${c.name} 考試時間`}
                          >
                            <Send className="w-2.5 h-2.5" /> 通知
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {groupCandidates.length === 0 && !selectedCandidate && <span className="text-sm text-gray-400">尚無考生</span>}
                  {groupCandidates.length === 0 && selectedCandidate && (
                    <div
                      onClick={() => handlePlaceCandidate(sch.groupCode, 1)}
                      className="inline-flex items-center bg-green-50 border-2 border-dashed border-green-400 rounded px-3 py-1.5 text-sm text-green-600 cursor-pointer hover:bg-green-100 hover:border-green-500 transition-colors"
                    >
                      放置 {selectedCandidate.name} 到此組
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== 成績記錄頁（唯讀） ====================
function ScoreViewPage({ examId }: { examId: number }) {
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: allScores } = trpc.exam.scores.listByExam.useQuery({ examId });
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });

  // SSE: real-time score updates auto-invalidate queries
  useExamSSE({ examId, enabled: true, autoInvalidate: true });

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [activeBelt, setActiveBelt] = useState<string>('');

  const allCandidates = (candidates || []) as any[];

  // Get unique groups
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    allCandidates.forEach(c => { if (c.groupCode) groupSet.add(c.groupCode); });
    return Array.from(groupSet).sort();
  }, [allCandidates]);

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0]);
    }
  }, [groups, selectedGroup]);

  // Filter candidates by group
  const groupCandidates = useMemo(() => {
    if (!selectedGroup) return [];
    return allCandidates.filter(c => c.groupCode === selectedGroup);
  }, [allCandidates, selectedGroup]);

  // Get belts in this group
  const belts = useMemo(() => {
    const beltSet = new Set(groupCandidates.map(c => c.currentBelt));
    return Array.from(beltSet).sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99));
  }, [groupCandidates]);

  const currentBelt = activeBelt || belts[0] || '';
  const beltCandidates = groupCandidates.filter(c => c.currentBelt === currentBelt);

  // Reset belt when group changes
  useEffect(() => { setActiveBelt(''); }, [selectedGroup]);

  // Scoring items for current belt
  const { data: scoringItems } = trpc.exam.scoringItems.listByBelt.useQuery(
    { beltLevel: currentBelt },
    { enabled: !!currentBelt }
  );

  // Score map: candidateId -> { scoringItemId -> score }
  const scoreMap = useMemo(() => {
    if (!allScores) return new Map<number, Map<number, string>>();
    const map = new Map<number, Map<number, string>>();
    (allScores as any[]).forEach((entry: any) => {
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

  // Stats
  const scoredCount = beltCandidates.filter(c => ['passed', 'failed'].includes(c.status)).length;
  const totalItems = items.length;

  // Score display helper
  function renderScore(score: string, type: string) {
    if (!score) return <span className="text-gray-300">—</span>;
    if (type === 'grade') {
      const colors: Record<string, string> = {
        'A': 'bg-green-500 text-white',
        'B': 'bg-yellow-400 text-yellow-900',
        'C': 'bg-orange-400 text-white',
        'F': 'bg-red-500 text-white',
      };
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${colors[score] || 'bg-gray-200'}`}>
          {score}
        </span>
      );
    }
    if (type === 'pass_fail') {
      return score === 'pass' 
        ? <span className="text-green-600 font-bold text-[11px]">✓</span>
        : <span className="text-red-500 font-bold text-[11px]">✗</span>;
    }
    if (type === 'yes_no') {
      return score === 'true' || score === 'yes'
        ? <span className="text-green-600 font-bold text-[11px]">✓</span>
        : <span className="text-red-500 font-bold text-[11px]">✗</span>;
    }
    return <span className="text-xs">{score}</span>;
  }

  if (!candidates) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            成績記錄（唯讀）
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(exam as any)?.name || ''} — 即時同步主考官評分，供記錄人員填寫實體成績單
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            即時同步中
          </span>
        </div>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap gap-1.5">
        {groups.map(g => {
          const gCandidates = allCandidates.filter(c => c.groupCode === g);
          const gScored = gCandidates.filter(c => ['passed', 'failed'].includes(c.status)).length;
          return (
            <button key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedGroup === g
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}>
              {g.toUpperCase()} 組
              <span className={`ml-1 text-xs ${selectedGroup === g ? 'text-purple-200' : 'text-gray-400'}`}>
                ({gScored}/{gCandidates.length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Belt tabs */}
      {belts.length > 1 && (
        <div className="flex gap-1">
          {belts.map(b => (
            <button key={b}
              onClick={() => setActiveBelt(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentBelt === b ? 'bg-white shadow border text-gray-900' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {getBeltName(b)} ({groupCandidates.filter(c => c.currentBelt === b).length}人)
            </button>
          ))}
        </div>
      )}

      {/* Info bar */}
      {selectedGroup && currentBelt && (
        <div className="flex items-center gap-4 text-sm text-gray-600 bg-white rounded-lg border px-4 py-2">
          <span>組別：<strong>{selectedGroup.toUpperCase()}</strong></span>
          <span>帶級：<strong>{getBeltName(currentBelt)}</strong></span>
          <span>人數：<strong>{beltCandidates.length}</strong></span>
          <span>已評分：<strong className="text-green-600">{scoredCount}</strong>/{beltCandidates.length}</span>
          <span>項目：<strong>{totalItems}</strong> 項</span>
        </div>
      )}

      {/* Scoring Matrix - READ ONLY */}
      {items.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {/* Category header row */}
              <tr className="border-b">
                <th className="px-2 py-1.5 border-r bg-gray-50 min-w-[40px] sticky left-0 z-10" rowSpan={2}>編號</th>
                <th className="px-2 py-1.5 border-r bg-gray-50 min-w-[70px] sticky left-[40px] z-10" rowSpan={2}>姓名</th>
                <th className="px-2 py-1.5 border-r bg-gray-50 min-w-[50px]" rowSpan={2}>狀態</th>
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
                <th className="px-2 py-1.5 border-l bg-gray-50 min-w-[50px]" rowSpan={2}>結果</th>
              </tr>
              {/* Item name row */}
              <tr className="border-b bg-gray-50">
                {categorizedItems.flatMap(cat => cat.items.map(item => (
                  <th key={item.id} className="px-1 py-1 text-center border-r min-w-[70px]">
                    <div className="font-medium text-[10px] leading-tight">{item.name}</div>
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
                const scoredItems = candidateScores.size;
                const allScored = scoredItems >= totalItems && totalItems > 0;

                return (
                  <tr key={c.id} className={`${
                    isAbsent ? 'bg-red-50/60 opacity-60' : 
                    allScored ? 'bg-green-50/40' : 
                    scoredItems > 0 ? 'bg-yellow-50/30' : ''
                  }`}>
                    <td className="px-2 py-2 border-r font-mono font-bold text-center text-sm sticky left-0 bg-inherit z-10">{code}</td>
                    <td className="px-2 py-2 border-r sticky left-[40px] bg-inherit z-10">
                      <div className={`font-medium text-sm ${isAbsent ? 'line-through text-gray-400' : ''}`}>{c.name}</div>
                      <div className="text-[10px] text-gray-400">{c.dojoName || ''}</div>
                    </td>
                    <td className="px-2 py-2 border-r text-center">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                        <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
                      </span>
                      {c.hasLakLakAward && <div className="text-[10px] text-amber-500 font-medium mt-0.5">⭐叻叻獎</div>}
                    </td>
                    {categorizedItems.flatMap(cat => cat.items.map(item => {
                      const currentScore = candidateScores.get(item.id) || '';
                      if (isAbsent) {
                        return (
                          <td key={item.id} className="px-1 py-2 border-r text-center">
                            <span className="text-gray-300">—</span>
                          </td>
                        );
                      }
                      return (
                        <td key={item.id} className="px-1 py-2 border-r text-center">
                          {currentScore ? renderScore(currentScore, item.type) : <span className="text-gray-200">⋯</span>}
                        </td>
                      );
                    }))}
                    <td className="px-2 py-2 border-l text-center font-medium">
                      {c.status === 'passed' && <span className="text-green-600 font-bold">合格 ✓</span>}
                      {c.status === 'failed' && <span className="text-red-600 font-bold">不合格</span>}
                      {!['passed', 'failed', 'absent'].includes(c.status) && (
                        <span className="text-gray-300 text-[10px]">
                          {scoredItems > 0 ? `${scoredItems}/${totalItems}` : '—'}
                        </span>
                      )}
                      {isAbsent && <span className="text-gray-400">缺席</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : selectedGroup && currentBelt ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">此帶級尚未設定評分項目</p>
          <p className="text-xs text-gray-400 mt-1">請在「評分」頁面初始化評分項目</p>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Eye className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">請選擇組別查看成績</p>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg border px-4 py-3">
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
          <span className="font-medium text-gray-700">圖例：</span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[9px] font-bold">A</span> 優秀
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-yellow-900 text-[9px] font-bold">B</span> 良好
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-400 text-white text-[9px] font-bold">C</span> 及格
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold">F</span> 不合格
          </span>
          <span className="flex items-center gap-1">
            <span className="text-green-600 font-bold">✓</span> 通過
          </span>
          <span className="flex items-center gap-1">
            <span className="text-red-500 font-bold">✗</span> 未通過
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-300">⋯</span> 未評分
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== 點名頁 ====================
function CheckInPage({ examId }: { examId: number }) {
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const checkIn = trpc.exam.attendance.checkIn.useMutation({
    onSuccess: () => { refetchCandidates(); },
    onError: (err) => { toast.error(err.message || '報到失敗'); },
  });
  const undoCheckIn = trpc.exam.attendance.undoCheckIn.useMutation({
    onSuccess: () => { refetchCandidates(); },
    onError: (err) => { toast.error(err.message || '撤銷失敗'); },
  });
  const markAbsent = trpc.exam.attendance.markAbsent.useMutation({
    onSuccess: () => { refetchCandidates(); },
    onError: (err) => { toast.error(err.message || '操作失敗'); },
  });
  const bulkCheckIn = trpc.exam.attendance.bulkCheckIn.useMutation({
    onSuccess: (data) => { refetchCandidates(); toast.success(`已批量報到 ${(data as any).count} 位考生`); },
    onError: (err) => { toast.error(err.message || '批量報到失敗'); },
  });

  useExamSSE({ examId, enabled: true, autoInvalidate: true });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'checked_in' | 'absent'>('all');

  const allCandidates = (candidates || []) as any[];
  
  // Stats
  const totalCount = allCandidates.length;
  const checkedInCount = allCandidates.filter(c => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
  const registeredCount = allCandidates.filter(c => c.status === 'registered').length;
  const absentCount = allCandidates.filter(c => c.status === 'absent').length;

  // Group by groupCode
  const grouped = useMemo(() => {
    let filtered = allCandidates;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.dojoName?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'checked_in') {
        filtered = filtered.filter(c => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status));
      } else {
        filtered = filtered.filter(c => c.status === filterStatus);
      }
    }
    const groups: Record<string, any[]> = {};
    filtered.forEach(c => {
      const key = c.groupCode || '未分組';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    // Sort groups alphabetically
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === '未分組') return 1;
      if (b === '未分組') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [allCandidates, searchQuery, filterStatus]);

  const getStatusDisplay = (status: string) => {
    if (['checked_in', 'examining', 'passed', 'failed'].includes(status)) {
      return { label: '已到', color: 'bg-green-100 text-green-700 border-green-300' };
    }
    if (status === 'absent') {
      return { label: '缺席', color: 'bg-red-100 text-red-700 border-red-300' };
    }
    return { label: '未到', color: 'bg-gray-100 text-gray-600 border-gray-300' };
  };

  const handleBulkCheckInAll = () => {
    const notCheckedIn = allCandidates.filter(c => c.status === 'registered').map(c => c.id);
    if (notCheckedIn.length === 0) {
      toast.info('所有考生已報到');
      return;
    }
    if (confirm(`確定要將 ${notCheckedIn.length} 位未報到考生全部標記為已報到？`)) {
      bulkCheckIn.mutate({ candidateIds: notCheckedIn });
    }
  };

  if (!candidates) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            點名
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(exam as any)?.name || ''}
          </p>
        </div>
        <Button onClick={handleBulkCheckInAll} disabled={bulkCheckIn.isPending || registeredCount === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white">
          <UserCheck className="w-4 h-4 mr-1" />
          全部報到 ({registeredCount})
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{totalCount}</div>
          <div className="text-xs text-gray-500">總人數</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{checkedInCount}</div>
          <div className="text-xs text-green-600">已到</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-600">{registeredCount}</div>
          <div className="text-xs text-gray-500">未到</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-red-200 bg-red-50">
          <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          <div className="text-xs text-red-500">缺席</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg border p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">報到進度</span>
          <span className="text-sm font-bold text-blue-700">
            {totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (checkedInCount / totalCount) * 100 : 0}%` }}></div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="搜尋考生姓名、電話、道場..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {([
            { key: 'all', label: '全部' },
            { key: 'registered', label: '未到' },
            { key: 'checked_in', label: '已到' },
            { key: 'absent', label: '缺席' },
          ] as const).map(f => (
            <button key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                filterStatus === f.key 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candidate List by Group */}
      <div className="space-y-3">
        {grouped.map(([groupCode, members]) => {
          const groupCheckedIn = members.filter(c => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
          return (
            <div key={groupCode} className="bg-white rounded-lg border overflow-hidden">
              {/* Group Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-blue-700">
                    {groupCode === '未分組' ? '未分組' : `${groupCode.toUpperCase()} 組`}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({groupCheckedIn}/{members.length} 已到)
                  </span>
                  {members.length > 0 && members[0].currentBelt && (
                    <span className="ml-1">{getBeltBadge(members[0].currentBelt)}</span>
                  )}
                </div>
                {/* Bulk check-in for this group */}
                {members.some(c => c.status === 'registered') && (
                  <button
                    onClick={() => {
                      const ids = members.filter(c => c.status === 'registered').map(c => c.id);
                      bulkCheckIn.mutate({ candidateIds: ids });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    disabled={bulkCheckIn.isPending}
                  >
                    全組報到
                  </button>
                )}
              </div>
              {/* Students */}
              <div className="divide-y">
                {members.map(c => {
                  const statusDisplay = getStatusDisplay(c.status);
                  const code = c.groupCode && c.orderNumber ? `${c.groupCode.toUpperCase()}${c.orderNumber}` : '';
                  const isNotArrived = c.status === 'registered';
                  const isCheckedIn = ['checked_in', 'examining', 'passed', 'failed'].includes(c.status);
                  const isAbsent = c.status === 'absent';

                  return (
                    <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${
                      isCheckedIn ? 'bg-green-50/50' : isAbsent ? 'bg-red-50/30' : ''
                    }`}>
                      {/* Left: Student info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs text-gray-400 w-6 text-center font-mono">{code}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{c.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            {c.dojoName && <span>{c.dojoName}</span>}
                            {c.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.phone}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Right: Status + Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${statusDisplay.color}`}>
                          {statusDisplay.label}
                        </span>
                        {isNotArrived && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => checkIn.mutate({ candidateId: c.id })}
                              disabled={checkIn.isPending}
                              className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 shadow-sm"
                            >
                              <UserCheck className="w-4 h-4 inline mr-1" />
                              報到
                            </button>
                            <button
                              onClick={() => markAbsent.mutate({ candidateId: c.id, absent: true })}
                              disabled={markAbsent.isPending}
                              className="px-2 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
                              title="標記缺席"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isCheckedIn && (
                          <button
                            onClick={() => {
                              if (confirm(`確定撤銷 ${c.name} 的報到？`)) {
                                undoCheckIn.mutate({ candidateId: c.id });
                              }
                            }}
                            disabled={undoCheckIn.isPending}
                            className="px-2 py-1.5 text-xs rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                            title="撤銷報到"
                          >
                            撤銷
                          </button>
                        )}
                        {isAbsent && (
                          <button
                            onClick={() => markAbsent.mutate({ candidateId: c.id, absent: false })}
                            disabled={markAbsent.isPending}
                            className="px-2 py-1.5 text-xs rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="取消缺席"
                          >
                            取消缺席
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ListChecks className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>沒有符合條件的考生</p>
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
