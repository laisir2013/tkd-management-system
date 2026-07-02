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
  Menu, X, Package, CreditCard, DollarSign, Receipt, Ban
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
type NavPage = 'overview' | 'candidates' | 'checkin' | 'scoring' | 'scoreview' | 'timetable' | 'results' | 'statistics' | 'supplies' | 'payments';
const NAV_ITEMS: { key: NavPage; label: string; icon: any }[] = [
  { key: 'overview', label: '考試概覽', icon: LayoutDashboard },
  { key: 'candidates', label: '考生管理', icon: Users },
  { key: 'checkin', label: '點名', icon: ListChecks },
  { key: 'scoring', label: '評分', icon: ClipboardCheck },
  { key: 'scoreview', label: '成績記錄', icon: Eye },
  { key: 'timetable', label: '時間表', icon: Calendar },
  { key: 'results', label: '合格名單', icon: Trophy },
  { key: 'statistics', label: '統計分析', icon: BarChart3 },
  { key: 'supplies', label: '物資清單', icon: Package },
  { key: 'payments', label: '考試繳費', icon: CreditCard },
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
        {navPage === 'statistics' && <StatisticsPage examId={selectedExamId} />}
        {navPage === 'supplies' && <SuppliesPage examId={selectedExamId} />}
        {navPage === 'payments' && <PaymentsPage examId={selectedExamId} />}
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
  const { data: paymentStats } = trpc.exam.payments.stats.useQuery({ examId });
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

      {/* 繳費概覽 */}
      {paymentStats && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" /> 考試繳費概覽</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-700">{paymentStats.paidCount}</div>
              <div className="text-xs text-green-600">已繳費</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{paymentStats.waivedCount}</div>
              <div className="text-xs text-blue-600">免費(補考)</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-700">{paymentStats.unpaidCount}</div>
              <div className="text-xs text-red-600">未繳費</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-purple-700">${paymentStats.totalAmount}</div>
              <div className="text-xs text-purple-600">已收金額</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-gray-700">
                {paymentStats.totalCandidates > 0
                  ? Math.round(((paymentStats.paidCount + paymentStats.waivedCount) / paymentStats.totalCandidates) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-gray-600">完成率</div>
            </div>
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
  const { data: payments } = trpc.exam.payments.listByExam.useQuery({ examId });
  const createCandidate = trpc.exam.candidates.create.useMutation({ onSuccess: () => { refetch(); toast.success('已新增考生'); } });
  const deleteCandidate = trpc.exam.candidates.delete.useMutation({ onSuccess: () => { refetch(); toast.success('已刪除'); } });
  const importFromEvent = trpc.exam.candidates.importFromEvent.useMutation({ 
    onSuccess: (data: any) => { refetch(); toast.success(`已匯入 ${data.imported} 位考生`); } 
  });

  // Payment status map (candidateId -> payment)
  const paymentMap = useMemo(() => {
    const map = new Map<number, any>();
    if (payments) (payments as any[]).forEach(p => { if (p.candidateId) map.set(p.candidateId, p); });
    return map;
  }, [payments]);

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
                <th className="px-3 py-2 text-center font-medium text-gray-600">繳費</th>
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
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const pmt = paymentMap.get(c.id);
                        if (pmt) {
                          if (pmt.status === 'confirmed') return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />已繳</span>;
                          if (pmt.status === 'waived') return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">免費</span>;
                          return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" />待確認</span>;
                        }
                        if (c.isRetake) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">補考</span>;
                        return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600"><XCircle className="w-3 h-3" />未繳</span>;
                      })()}
                    </td>
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
  const { data: retakeData } = trpc.exam.candidates.retakeInfo.useQuery({ examId });
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
                const isRetake = retakeData?.retakeCandidateIds?.includes(c.id) || false;
                const prevScores = isRetake ? (retakeData?.previousScores?.[c.id]?.scores || []) : [];
                return (
                  <tr key={c.id} className={
                    isAbsent ? 'bg-red-50/60 opacity-70' :
                    c.status === 'failed' ? 'bg-red-100/60' :
                    c.hasLakLakAward ? 'bg-amber-100/60' :
                    isRetake ? 'bg-blue-50/60' :
                    'hover:bg-gray-50'
                  }>
                    <td className="px-2 py-2 border-r font-medium text-center">{code}</td>
                    <td className="px-2 py-2 border-r">
                      <div className={`font-medium ${isAbsent ? 'line-through text-gray-400' : ''}`}>
                        {c.name}
                        {isRetake && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-300">補考</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">{c.dojoName || ''}</span>
                        {['passed', 'failed'].includes(c.status) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); sendWhatsAppScoringResult(c); }}
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500 text-white text-[10px] font-medium hover:bg-green-600 active:scale-95 transition-colors shadow-sm"
                            title={`WhatsApp 通知 ${c.name} 家長成績`}
                          >
                            <Send className="w-2.5 h-2.5" />通知
                          </button>
                        )}
                      </div>
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
                      // Previous score for retake students
                      const prevScore = isRetake ? prevScores.find(ps => ps.scoringItemId === item.id)?.score || '' : '';
                      const prevFailed = prevScore && ['f', 'fail', 'false', '未達標', '否', '不合格', '沒有'].includes(prevScore.toLowerCase());
                      // 補考生已合格項目鎖定不可改
                      const isLockedByRetake = isRetake && prevScore && !prevFailed;

                      if (isAbsent) {
                        return (
                          <td key={item.id} className="px-1 py-1 border-r text-center">
                            <span className="text-[10px] text-gray-300">—</span>
                          </td>
                        );
                      }

                      // 補考生已合格項目 — 顯示鎖定狀態，不可修改
                      if (isLockedByRetake) {
                        return (
                          <td key={item.id} className="px-1 py-1 border-r text-center bg-green-50/60 relative">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="text-[10px] font-bold text-green-600">{prevScore.toUpperCase()}</span>
                              <span className="text-[8px] text-green-500">🔒已合格</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={item.id} className={`px-1 py-1 border-r text-center relative group/cell ${isRetake && prevFailed ? 'bg-red-50/30' : ''}`}>
                          {/* Previous failed score indicator for retake students */}
                          {isRetake && prevFailed && !currentScore && (
                            <div className="absolute top-0 right-0 pointer-events-none">
                              <span className="text-[8px] text-red-400 font-medium">重考</span>
                            </div>
                          )}
                          {isGrade ? (
                            <div className="flex flex-col items-center gap-0.5">
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
                              <button
                                onClick={() => handleScoreClick(c.id, item.id, 'F')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                                  currentScore === 'F' ? 'bg-red-600 text-white shadow' : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
                                }`}>
                                不合格
                              </button>
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

  // SSE: auto-refresh when check-in / score updates happen
  useExamSSE({ examId, enabled: true, autoInvalidate: true });

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

  // --- 時間表調整設定 ---
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [tsStartTime, setTsStartTime] = useState('10:00');
  const [tsMinutesPerGroup, setTsMinutesPerGroup] = useState(30);
  const [tsBreaks, setTsBreaks] = useState<Array<{ afterGroup: string; type: 'break' | 'lunch'; minutes: number }>>([]);
  const [tsNewBreakGroup, setTsNewBreakGroup] = useState('');
  const [tsNewBreakType, setTsNewBreakType] = useState<'break' | 'lunch'>('break');
  const [tsNewBreakMins, setTsNewBreakMins] = useState(15);

  // --- 拖拉小休/午餐（改為點擊放置模式） ---
  const [placingBreakType, setPlacingBreakType] = useState<'break' | 'lunch' | null>(null);

  const recalculateTimes = trpc.exam.schedules.recalculateTimes.useMutation({
    onSuccess: (data: any) => { refetch(); toast.success(`已重新計算 ${data.updatedCount} 組時間`); },
    onError: (err) => toast.error(err.message),
  });

  // 從現有數據推斷設定（初始化）
  useEffect(() => {
    if (schedules && (schedules as any[]).length > 0) {
      const sorted = [...(schedules as any[])].sort((a: any, b: any) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      // 推斷開始時間
      if (sorted[0]?.startTime) setTsStartTime(sorted[0].startTime);
      // 推斷每組時長
      if (sorted[0]?.startTime && sorted[0]?.endTime) {
        const parseT = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const mins = parseT(sorted[0].endTime) - parseT(sorted[0].startTime);
        if (mins > 0) setTsMinutesPerGroup(mins);
      }
      // 推斷已有小休（找出時間不連續的地方）
      const inferredBreaks: Array<{ afterGroup: string; type: 'break' | 'lunch'; minutes: number }> = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const endMins = (() => { const [h, m] = (sorted[i].endTime || '').split(':').map(Number); return h * 60 + m; })();
        const nextStartMins = (() => { const [h, m] = (sorted[i + 1].startTime || '').split(':').map(Number); return h * 60 + m; })();
        const gap = nextStartMins - endMins;
        if (gap > 0 && sorted[i].groupCode) {
          inferredBreaks.push({
            afterGroup: String(sorted[i].groupCode).toUpperCase(),
            type: gap >= 30 ? 'lunch' : 'break',
            minutes: gap,
          });
        }
      }
      if (inferredBreaks.length > 0) setTsBreaks(inferredBreaks);
    }
  }, [schedules]);

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

  // 在時間表中插入小休/午餐行（根據時間間隔自動偵測）
  const timetableRowsWithBreaks = useMemo(() => {
    if (timetableRows.length === 0) return [];
    const result: any[] = [];
    const parseT = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
    for (let i = 0; i < timetableRows.length; i++) {
      result.push({ ...timetableRows[i], _type: 'group' });
      if (i < timetableRows.length - 1) {
        const endMins = parseT(timetableRows[i].endTime);
        const nextStartMins = parseT(timetableRows[i + 1].startTime);
        const gap = nextStartMins - endMins;
        if (gap > 0) {
          const formatT = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
          result.push({
            _type: 'break',
            _breakType: gap >= 30 ? 'lunch' : 'break',
            _breakMinutes: gap,
            _breakStart: formatT(endMins),
            _breakEnd: formatT(nextStartMins),
            _afterGroup: String(timetableRows[i].groupCode || '').toUpperCase(),
          });
        }
      }
    }
    return result;
  }, [timetableRows]);

  // 點擊放置小休/午餐 — 加入後自動儲存
  const handlePlaceBreak = useCallback((afterGroupCode: string) => {
    if (!placingBreakType) return;
    const minutes = placingBreakType === 'lunch' ? 45 : 15;
    const type = placingBreakType;
    setTsBreaks(prev => {
      const newBreaks = [...prev.filter(b => b.afterGroup !== afterGroupCode), { afterGroup: afterGroupCode, type, minutes }]
        .sort((a, b) => a.afterGroup.localeCompare(b.afterGroup));
      // 自動觸發重新計算
      setTimeout(() => {
        recalculateTimes.mutate({
          examId,
          startTime: tsStartTime,
          minutesPerGroup: tsMinutesPerGroup,
          breaks: newBreaks,
        });
      }, 0);
      return newBreaks;
    });
    setPlacingBreakType(null);
  }, [placingBreakType, examId, tsStartTime, tsMinutesPerGroup, recalculateTimes]);

  // 移除休息並自動重新計算
  const handleRemoveBreak = useCallback((afterGroupCode: string) => {
    setTsBreaks(prev => {
      const newBreaks = prev.filter(b => b.afterGroup !== afterGroupCode);
      // 自動觸發重新計算
      setTimeout(() => {
        recalculateTimes.mutate({
          examId,
          startTime: tsStartTime,
          minutesPerGroup: tsMinutesPerGroup,
          breaks: newBreaks,
        });
      }, 0);
      return newBreaks;
    });
  }, [examId, tsStartTime, tsMinutesPerGroup, recalculateTimes]);

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
          {sortedSchedules.length > 0 && (
            <Button size="sm" onClick={() => { setShowTimeSettings(!showTimeSettings); setShowAutoGroup(false); setShowCreate(false); }} className="bg-green-600 hover:bg-green-700 text-white">
              <Clock className="w-4 h-4 mr-1" /> 時間設定
            </Button>
          )}
          <Button size="sm" onClick={() => { setShowAutoGroup(!showAutoGroup); setShowCreate(false); setShowTimeSettings(false); }} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Zap className="w-4 h-4 mr-1" /> 自動分組
          </Button>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setShowAutoGroup(false); setShowTimeSettings(false); }} className="bg-blue-600 hover:bg-blue-700 text-white">
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

      {/* Time settings panel (小休/午餐/開始時間) */}
      {showTimeSettings && sortedSchedules.length > 0 && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">時間表設定</h3>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">調整開始時間、每組時長、小休/午餐</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">開始時間</label>
              <Input type="time" value={tsStartTime} onChange={e => setTsStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">每組時間（分鐘）</label>
              <Input type="number" min={15} max={120} value={tsMinutesPerGroup} onChange={e => setTsMinutesPerGroup(Number(e.target.value))} />
            </div>
          </div>

          {/* 已設定的小休/午餐列表 */}
          {tsBreaks.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">已設定的休息時段</label>
              <div className="flex flex-wrap gap-2">
                {tsBreaks.map((b, idx) => (
                  <div key={idx} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${b.type === 'lunch' ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-blue-100 border-blue-300 text-blue-800'}`}>
                    {b.type === 'lunch' ? '🍱' : '☕'} {b.afterGroup} 組後 — {b.type === 'lunch' ? '午餐' : '小休'}
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={b.minutes}
                      onChange={(e) => {
                        const mins = Number(e.target.value);
                        if (mins >= 5 && mins <= 120) {
                          setTsBreaks(prev => prev.map((item, i) => i === idx ? { ...item, minutes: mins } : item));
                        }
                      }}
                      className="w-10 text-center bg-white/60 border rounded px-1 py-0 text-xs mx-0.5"
                    />
                    分鐘
                    <button onClick={() => setTsBreaks(prev => prev.filter((_, i) => i !== idx))} className="ml-1 text-gray-500 hover:text-red-600 font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 新增小休/午餐 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">新增休息時段</label>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-[10px] text-gray-500 block">在哪組之後</label>
                <select
                  value={tsNewBreakGroup}
                  onChange={e => setTsNewBreakGroup(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm min-w-[100px]"
                >
                  <option value="">選擇組別</option>
                  {sortedSchedules.map((sch: any) => (
                    <option key={sch.groupCode} value={String(sch.groupCode).toUpperCase()}>
                      {String(sch.groupCode).toUpperCase()} 組 ({getBeltName(sch.beltLevel)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block">類型</label>
                <select
                  value={tsNewBreakType}
                  onChange={e => setTsNewBreakType(e.target.value as 'break' | 'lunch')}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  <option value="break">☕ 小休</option>
                  <option value="lunch">🍱 午餐</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block">時長（分鐘）</label>
                <Input type="number" min={5} max={120} value={tsNewBreakMins} onChange={e => setTsNewBreakMins(Number(e.target.value))} className="w-20" />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!tsNewBreakGroup}
                onClick={() => {
                  if (!tsNewBreakGroup) return;
                  // 避免重複添加同一組的休息
                  setTsBreaks(prev => {
                    const filtered = prev.filter(b => b.afterGroup !== tsNewBreakGroup);
                    return [...filtered, { afterGroup: tsNewBreakGroup, type: tsNewBreakType, minutes: tsNewBreakMins }]
                      .sort((a, b) => a.afterGroup.localeCompare(b.afterGroup));
                  });
                  setTsNewBreakGroup('');
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> 加入
              </Button>
            </div>
          </div>

          {/* 預覽計算結果 */}
          {(() => {
            const parseT = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            const formatT = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
            const breaksMap = new Map(tsBreaks.map(b => [b.afterGroup, b]));
            let cur = parseT(tsStartTime);
            const preview: { group: string; belt: string; start: string; end: string; breakAfter?: { type: string; mins: number } }[] = [];
            for (const sch of sortedSchedules) {
              const gc = String((sch as any).groupCode || '').toUpperCase();
              const s = formatT(cur);
              cur += tsMinutesPerGroup;
              const e = formatT(cur);
              const brk = breaksMap.get(gc);
              preview.push({ group: gc, belt: (sch as any).beltLevel, start: s, end: e, breakAfter: brk ? { type: brk.type, mins: brk.minutes } : undefined });
              if (brk) cur += brk.minutes;
            }
            const lastEnd = preview[preview.length - 1]?.end || '';
            return (
              <div className="bg-white rounded border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">預覽時間</span>
                  <span className="text-xs text-gray-500">
                    {tsStartTime} ~ {lastEnd}（共 {preview.length} 組）
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {preview.map((p, idx) => (
                    <React.Fragment key={idx}>
                      <div className="inline-flex flex-col items-center px-2 py-1 bg-gray-50 rounded text-[10px] border">
                        <span className="font-bold">{p.group}</span>
                        <span className="text-gray-500">{p.start}-{p.end}</span>
                      </div>
                      {p.breakAfter && (
                        <div className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium ${p.breakAfter.type === 'lunch' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {p.breakAfter.type === 'lunch' ? '🍱' : '☕'} {p.breakAfter.mins}min
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={() => recalculateTimes.mutate({
                examId,
                startTime: tsStartTime,
                minutesPerGroup: tsMinutesPerGroup,
                breaks: tsBreaks,
              })}
              disabled={recalculateTimes.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {recalculateTimes.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              {recalculateTimes.isPending ? '計算中...' : '重新計算並儲存'}
            </Button>
            <Button variant="outline" onClick={() => setShowTimeSettings(false)}>取消</Button>
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

      {/* Break/Lunch placement buttons + indicator */}
      {viewMode === 'timetable' && sortedSchedules.length > 1 && (
        <div className="flex items-center gap-3 px-1 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">插入休息：</span>
          <button
            onClick={() => setPlacingBreakType(placingBreakType === 'break' ? null : 'break')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all select-none ${
              placingBreakType === 'break'
                ? 'border-blue-500 bg-blue-200 text-blue-800 shadow-md scale-105 ring-2 ring-blue-300'
                : 'border-dashed border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400'
            }`}
          >
            ☕ 小休 <span className="text-[10px]">(15分鐘)</span>
          </button>
          <button
            onClick={() => setPlacingBreakType(placingBreakType === 'lunch' ? null : 'lunch')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all select-none ${
              placingBreakType === 'lunch'
                ? 'border-orange-500 bg-orange-200 text-orange-800 shadow-md scale-105 ring-2 ring-orange-300'
                : 'border-dashed border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400'
            }`}
          >
            🍱 午餐 <span className="text-[10px]">(45分鐘)</span>
          </button>
          {placingBreakType && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium animate-pulse ${placingBreakType === 'lunch' ? 'text-orange-600' : 'text-blue-600'}`}>
                ← 點擊下方表格組與組之間的「放置」列
              </span>
              <button
                onClick={() => setPlacingBreakType(null)}
                className="text-xs text-gray-500 hover:text-red-500 px-2 py-0.5 rounded border hover:border-red-300"
              >取消</button>
            </div>
          )}
        </div>
      )}

      {/* Placement mode indicator bar */}
      {placingBreakType && (
        <div className={`rounded-lg px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-10 ${
          placingBreakType === 'lunch' ? 'bg-orange-50 border border-orange-200 text-orange-700' : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{placingBreakType === 'lunch' ? '🍱' : '☕'}</span>
            正在放置<strong>{placingBreakType === 'lunch' ? '午餐 (45分鐘)' : '小休 (15分鐘)'}</strong> — 點擊組與組之間的高亮區域放置
          </div>
          <button onClick={() => setPlacingBreakType(null)} className={`font-medium px-2 py-1 rounded ${
            placingBreakType === 'lunch' ? 'text-orange-500 hover:text-orange-800 hover:bg-orange-100' : 'text-blue-500 hover:text-blue-800 hover:bg-blue-100'
          }`}>✕ 取消</button>
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
              {timetableRowsWithBreaks.map((row: any, rowIdx: number) => {
                const colSpanFull = 7 + Math.min(maxPositions, 9) + 1;
                // 小休/午餐行
                if (row._type === 'break') {
                  return (
                    <tr
                      key={`break-${rowIdx}`}
                      className={row._breakType === 'lunch' ? 'bg-orange-50' : 'bg-blue-50'}
                    >
                      <td colSpan={colSpanFull} className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm font-medium">
                          <span>{row._breakType === 'lunch' ? '🍱' : '☕'}</span>
                          <span className={row._breakType === 'lunch' ? 'text-orange-700' : 'text-blue-700'}>
                            {row._breakType === 'lunch' ? '午餐' : '小休'} — {row._breakMinutes} 分鐘
                          </span>
                          <span className="text-gray-500 text-xs">({row._breakStart} ~ {row._breakEnd})</span>
                          <button
                            onClick={() => handleRemoveBreak(row._afterGroup)}
                            className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold hover:bg-white/80 transition-colors ${row._breakType === 'lunch' ? 'text-orange-500 hover:text-red-600' : 'text-blue-500 hover:text-red-600'}`}
                            title={`移除 ${row._afterGroup} 組後的${row._breakType === 'lunch' ? '午餐' : '小休'}`}
                          >✕ 移除</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                // 正常組別行 + 後接 drop zone
                const groupCode = String(row.groupCode || '').toUpperCase();
                // 判斷此組之後是否已有 break 行（如有則不顯示 drop zone）
                const nextRow = timetableRowsWithBreaks[rowIdx + 1];
                const hasBreakAfter = nextRow && nextRow._type === 'break';
                const showDropZone = placingBreakType && !hasBreakAfter && rowIdx < timetableRowsWithBreaks.length - 1;
                return (
                <React.Fragment key={row.id}>
                <tr className="hover:bg-gray-50">
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
                            {/* Check-in status indicator */}
                            {!isSelected && (
                              ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)
                                ? <span className="text-[8px] leading-tight text-green-600 font-medium">✓ 已到</span>
                                : c.status === 'absent'
                                  ? <span className="text-[8px] leading-tight text-red-500 font-medium">✗ 缺席</span>
                                  : <span className="text-[8px] leading-tight text-gray-400">未到</span>
                            )}
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
                {/* Drop zone: 點擊放置小休/午餐到此組之後 */}
                {showDropZone && (
                  <tr
                    key={`dropzone-${groupCode}`}
                    onClick={() => handlePlaceBreak(groupCode)}
                    className="cursor-pointer"
                  >
                    <td colSpan={colSpanFull} className="p-0">
                      <div className={`flex items-center justify-center transition-all border-2 border-dashed rounded mx-2 my-0.5 h-9 hover:h-11 ${
                        placingBreakType === 'lunch'
                          ? 'border-orange-400 bg-orange-50 hover:bg-orange-100 text-orange-600'
                          : 'border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-600'
                      } text-xs font-medium hover:shadow-sm`}>
                        <span>{placingBreakType === 'lunch' ? '🍱 點擊加入午餐' : '☕ 點擊加入小休'} — {groupCode} 組之後</span>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
              {timetableRowsWithBreaks.length === 0 && (
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
                  {/* Check-in count */}
                  {(() => {
                    const arrived = groupCandidates.filter((gc: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(gc.status)).length;
                    return arrived > 0 ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${arrived === groupCandidates.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {arrived}/{groupCandidates.length} 已到
                      </span>
                    ) : null;
                  })()}
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
                        {/* Check-in status indicator */}
                        {!isSelected && (
                          ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)
                            ? <span className="text-[8px] leading-tight text-green-600 font-medium">✓ 已到</span>
                            : c.status === 'absent'
                              ? <span className="text-[8px] leading-tight text-red-500 font-medium">✗ 缺席</span>
                              : <span className="text-[8px] leading-tight text-gray-400">未到</span>
                        )}
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
  const { data: candidates, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: allScores } = trpc.exam.scores.listByExam.useQuery({ examId });
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });

  // SSE: real-time score updates auto-invalidate queries
  useExamSSE({ examId, enabled: true, autoInvalidate: true });

  // Issuance mutation
  const updateIssuance = trpc.exam.updateIssuance.useMutation({
    onSuccess: () => { refetchCandidates(); },
    onError: (err) => toast.error(err.message || '更新失敗'),
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [activeBelt, setActiveBelt] = useState<string>('');
  // viewTab removed — scores + issuance merged into one view

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
        <div className="flex items-center gap-4 text-sm text-gray-600 bg-white rounded-lg border px-4 py-2 flex-wrap">
          <span>組別：<strong>{selectedGroup.toUpperCase()}</strong></span>
          <span>帶級：<strong>{getBeltName(currentBelt)}</strong></span>
          <span>人數：<strong>{beltCandidates.length}</strong></span>
          <span>已評分：<strong className="text-green-600">{scoredCount}</strong>/{beltCandidates.length}</span>
          <span>項目：<strong>{totalItems}</strong> 項</span>
        </div>
      )}



      {/* === SCORES + ISSUANCE MERGED === */}
      {(<>
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
                <th className="px-2 py-1.5 border-l bg-gray-50 min-w-[42px]" rowSpan={2} title="成績表派發">📄</th>
                <th className="px-2 py-1.5 border-l bg-gray-50 min-w-[42px]" rowSpan={2} title="證書派發">🏅</th>
                <th className="px-2 py-1.5 border-l bg-gray-50 min-w-[42px]" rowSpan={2} title="叻叻獎派發">⭐</th>
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
                    {/* 派發記錄 — 三狀態循環按鈕：未派→已派→待定→未派 */}
                    {(() => {
                      const cycle = [
                        { key: 'not_issued', label: '未派', bg: 'bg-orange-100 border-orange-400 text-orange-800 hover:bg-orange-200' },
                        { key: 'issued',     label: '已派', bg: 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200' },
                        { key: 'out_of_stock', label: '待定', bg: 'bg-gray-100 border-gray-400 text-gray-600 hover:bg-gray-200' },
                      ];
                      const CycleBtn = ({ field, value }: { field: 'certificateIssued' | 'reportCardIssued' | 'lakLakAwardIssued'; value: string }) => {
                        const curIdx = cycle.findIndex(s => s.key === value);
                        const cur = cycle[curIdx >= 0 ? curIdx : 0];
                        const nxt = cycle[(curIdx + 1) % cycle.length];
                        return (
                          <button
                            onClick={() => updateIssuance.mutate({ candidateId: c.id, field, value: nxt.key as any })}
                            disabled={updateIssuance.isPending}
                            className={`px-2 py-1 rounded border-2 text-[11px] font-bold active:scale-95 transition-colors shadow-sm ${cur.bg}`}
                            title={`目前：${cur.label} → 點擊切換為「${nxt.label}」`}
                          >
                            {cur.label}
                          </button>
                        );
                      };
                      return (
                        <>
                          <td className="px-1 py-2 border-l text-center">
                            {!isAbsent ? <CycleBtn field="reportCardIssued" value={c.reportCardIssued || 'not_issued'} /> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-1 py-2 border-l text-center">
                            {!isAbsent ? <CycleBtn field="certificateIssued" value={c.certificateIssued || 'not_issued'} /> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-1 py-2 border-l text-center">
                            {!isAbsent && c.hasLakLakAward ? <CycleBtn field="lakLakAwardIssued" value={c.lakLakAwardIssued || 'not_issued'} /> : <span className="text-gray-300">—</span>}
                          </td>
                        </>
                      );
                    })()}
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
      </>)}

      {/* Issuance summary — always visible below scores table */}
      {beltCandidates.length > 0 && (() => {
        const done = beltCandidates.filter(c => ['passed', 'failed'].includes(c.status));
        const passed = beltCandidates.filter(c => c.status === 'passed');
        const withAward = beltCandidates.filter(c => c.hasLakLakAward);
        const reportIssued = done.filter(c => c.reportCardIssued === 'issued').length;
        const reportOOS = done.filter(c => c.reportCardIssued === 'out_of_stock').length;
        const certIssued = passed.filter(c => c.certificateIssued === 'issued').length;
        const certOOS = passed.filter(c => c.certificateIssued === 'out_of_stock').length;
        const awardIssued = withAward.filter(c => c.lakLakAwardIssued === 'issued').length;
        const awardOOS = withAward.filter(c => c.lakLakAwardIssued === 'out_of_stock').length;
        return (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              派發統計
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border rounded-lg p-2.5">
                <div className="font-medium text-gray-700 mb-1">📄 成績表</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">已派: {reportIssued}/{done.length}</span>
                  {reportOOS > 0 && <span className="text-red-500">缺貨: {reportOOS}</span>}
                </div>
              </div>
              <div className="border rounded-lg p-2.5">
                <div className="font-medium text-gray-700 mb-1">🏅 證書</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">已派: {certIssued}/{passed.length}</span>
                  {certOOS > 0 && <span className="text-red-500">缺貨: {certOOS}</span>}
                </div>
              </div>
              <div className="border rounded-lg p-2.5">
                <div className="font-medium text-gray-700 mb-1">⭐ 叻叻獎</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">已派: {awardIssued}/{withAward.length}</span>
                  {awardOOS > 0 && <span className="text-red-500">缺貨: {awardOOS}</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-gray-400 flex flex-wrap items-center gap-2">
              <span>派發欄操作：</span>
              <span className="px-1.5 py-0.5 rounded border-2 border-orange-400 bg-orange-100 text-orange-800 text-[10px] font-bold">未派</span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded border-2 border-green-500 bg-green-100 text-green-800 text-[10px] font-bold">已派</span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded border-2 border-gray-400 bg-gray-100 text-gray-600 text-[10px] font-bold">待定</span>
              <span>→ 循環（點擊按鈕切換）</span>
            </div>
          </div>
        );
      })()}
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
  const [certGenerating, setCertGenerating] = useState(false);

  const allCandidates = (candidates as any[]) || [];
  const passed = allCandidates.filter(c => c.status === 'passed');
  const failed = allCandidates.filter(c => c.status === 'failed');
  const absent = allCandidates.filter(c => c.status === 'absent');

  // Certificate export handler
  async function handleExportCertificates() {
    const nonAbsent = allCandidates.filter(c => c.status !== 'absent');
    if (nonAbsent.length === 0) {
      toast.error('沒有考生可匯出證書');
      return;
    }
    setCertGenerating(true);
    try {
      const response = await fetch('/api/exam/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '匯出失敗' }));
        throw new Error(err.error || '匯出失敗');
      }
      const data = await response.json();
      if (!data.success || !data.downloadUrl) {
        throw new Error(data.error || '生成失敗');
      }
      // Trigger download via link
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = `證書_${examData?.name || 'exam'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`已匯出 ${nonAbsent.length} 份證書 (${(data.fileSize/1024/1024).toFixed(1)}MB)`);
    } catch (err: any) {
      toast.error(err.message || '證書匯出失敗');
    } finally {
      setCertGenerating(false);
    }
  }
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
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => {
            const TAB_LABELS: Record<string, string> = { passed: '合格名單', failed: '不合格名單', absent: '缺席名單' };
            exportCandidateListToCSV(filteredList, examData?.name || '考試', TAB_LABELS[activeTab] || activeTab);
          }}><Download className="w-4 h-4 mr-1" /> 匯出名單</Button>
          <Button size="sm" variant="outline" className="text-purple-600 border-purple-300 hover:bg-purple-50"
            onClick={handleExportCertificates}
            disabled={certGenerating}>
            {certGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
            匯出全部證書
          </Button>
        </div>
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

// ==================== 統計分析頁 ====================
function StatisticsPage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: stats } = trpc.exam.statistics.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: allScores } = trpc.exam.scores.listByExam.useQuery({ examId });

  useExamSSE({ examId, enabled: true, autoInvalidate: true });

  const allCandidates = (candidates || []) as any[];
  const scores = (allScores || []) as any[];
  const s = stats as any;
  const examData = exam as any;

  // ---- Derived statistics ----

  // 1. Status distribution
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { registered: 0, checked_in: 0, examining: 0, passed: 0, failed: 0, absent: 0 };
    allCandidates.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [allCandidates]);

  const totalJudged = statusCounts.passed + statusCounts.failed;
  const passRate = totalJudged > 0 ? ((statusCounts.passed / totalJudged) * 100) : 0;
  const checkedInTotal = allCandidates.filter(c => !['registered', 'absent'].includes(c.status)).length;
  const attendanceRate = allCandidates.length > 0 ? ((checkedInTotal / allCandidates.length) * 100) : 0;

  // 2. Belt-level stats
  const beltStats = useMemo(() => {
    return BELT_ORDER_KEYS.map(key => {
      const belt = allCandidates.filter(c => c.currentBelt === key);
      const passed = belt.filter(c => c.status === 'passed').length;
      const failed = belt.filter(c => c.status === 'failed').length;
      const lakLak = belt.filter(c => c.hasLakLakAward).length;
      const judged = passed + failed;
      return { key, name: getBeltName(key), total: belt.length, passed, failed, judged, lakLak, rate: judged > 0 ? Math.round((passed / judged) * 100) : null };
    }).filter(b => b.total > 0);
  }, [allCandidates]);

  // 3. Per-item score distribution (A/B/C/F/pass)
  const itemStats = useMemo(() => {
    const map: Record<number, { id: number; name: string; category: string; beltLevel: string; gradeA: number; gradeB: number; gradeC: number; gradeF: number; pass: number; total: number }> = {};
    scores.forEach((entry: any) => {
      const item = entry.item || {};
      const sc = entry.score || entry;
      const itemId = item.id || sc.scoringItemId;
      if (!map[itemId]) {
        map[itemId] = { id: itemId, name: item.name || '', category: item.category || '', beltLevel: item.beltLevel || '', gradeA: 0, gradeB: 0, gradeC: 0, gradeF: 0, pass: 0, total: 0 };
      }
      map[itemId].total++;
      const v = (sc.score || '').toUpperCase();
      if (v === 'A') map[itemId].gradeA++;
      else if (v === 'B') map[itemId].gradeB++;
      else if (v === 'C') map[itemId].gradeC++;
      else if (v === 'F' || v === 'FAIL' || v === 'FALSE' || v === '不合格' || v === '未達標') map[itemId].gradeF++;
      else if (v === 'PASS' || v === 'TRUE' || v === '合格') map[itemId].pass++;
    });
    return Object.values(map);
  }, [scores]);

  // Group items by belt
  const itemsByBelt = useMemo(() => {
    const map = new Map<string, typeof itemStats>();
    itemStats.forEach(item => {
      const belt = item.beltLevel || 'unknown';
      if (!map.has(belt)) map.set(belt, []);
      map.get(belt)!.push(item);
    });
    return map;
  }, [itemStats]);

  // 4. Group (A~M) performance
  const groupStats = useMemo(() => {
    const map: Record<string, { code: string; belt: string; total: number; passed: number; failed: number; lakLak: number }> = {};
    allCandidates.forEach(c => {
      const g = c.groupCode || '';
      if (!g) return;
      if (!map[g]) map[g] = { code: g, belt: '', total: 0, passed: 0, failed: 0, lakLak: 0 };
      map[g].total++;
      if (c.status === 'passed') map[g].passed++;
      if (c.status === 'failed') map[g].failed++;
      if (c.hasLakLakAward) map[g].lakLak++;
      if (!map[g].belt && c.currentBelt) map[g].belt = c.currentBelt;
    });
    return Object.values(map).sort((a, b) => a.code.localeCompare(b.code));
  }, [allCandidates]);

  // 5. Dojo performance
  const dojoStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; passed: number; failed: number; lakLak: number; checkedIn: number }> = {};
    allCandidates.forEach(c => {
      const dojo = c.dojoName || '未知道場';
      if (!map[dojo]) map[dojo] = { name: dojo, total: 0, passed: 0, failed: 0, lakLak: 0, checkedIn: 0 };
      map[dojo].total++;
      if (c.status === 'passed') map[dojo].passed++;
      if (c.status === 'failed') map[dojo].failed++;
      if (c.hasLakLakAward) map[dojo].lakLak++;
      if (!['registered', 'absent'].includes(c.status)) map[dojo].checkedIn++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [allCandidates]);

  // 6. Gender stats
  const genderStats = useMemo(() => {
    const map: Record<string, { total: number; passed: number; failed: number }> = {};
    allCandidates.forEach(c => {
      const g = c.gender || 'unknown';
      if (!map[g]) map[g] = { total: 0, passed: 0, failed: 0 };
      map[g].total++;
      if (c.status === 'passed') map[g].passed++;
      if (c.status === 'failed') map[g].failed++;
    });
    return map;
  }, [allCandidates]);

  // 7. Issuance summary
  const issuanceSummary = useMemo(() => {
    const result = {
      certificate: { issued: 0, not_issued: 0, out_of_stock: 0 },
      report_card: { issued: 0, not_issued: 0, out_of_stock: 0 },
      lak_lak: { issued: 0, not_issued: 0, out_of_stock: 0, eligible: 0 },
    };
    allCandidates.forEach(c => {
      if (c.status === 'absent') return;
      const cert = c.certificateIssued || c.certificate_issued || 'not_issued';
      const report = c.reportCardIssued || c.report_card_issued || 'not_issued';
      const lak = c.lakLakAwardIssued || c.lak_lak_award_issued || 'not_issued';
      if (cert in result.certificate) result.certificate[cert as keyof typeof result.certificate]++;
      if (report in result.report_card) result.report_card[report as keyof typeof result.report_card]++;
      if (c.hasLakLakAward) {
        result.lak_lak.eligible++;
        if (lak in result.lak_lak) (result.lak_lak as any)[lak]++;
      }
    });
    return result;
  }, [allCandidates]);

  // 8. Overall grade distribution
  const gradeDistribution = useMemo(() => {
    const d = { A: 0, B: 0, C: 0, F: 0, pass: 0, total: 0 };
    scores.forEach((entry: any) => {
      const sc = entry.score || entry;
      const v = (sc.score || '').toUpperCase();
      d.total++;
      if (v === 'A') d.A++;
      else if (v === 'B') d.B++;
      else if (v === 'C') d.C++;
      else if (v === 'F' || v === 'FAIL' || v === 'FALSE' || v === '不合格' || v === '未達標') d.F++;
      else if (v === 'PASS' || v === 'TRUE' || v === '合格') d.pass++;
    });
    return d;
  }, [scores]);

  // 9. 叻叻獎 students
  const lakLakStudents = useMemo(() => {
    return allCandidates.filter(c => c.hasLakLakAward).sort((a: any, b: any) => {
      const aOrder = BELT_LEVELS[a.currentBelt]?.order || 99;
      const bOrder = BELT_LEVELS[b.currentBelt]?.order || 99;
      return aOrder - bOrder;
    });
  }, [allCandidates]);

  // 10. Weakest items (highest fail rate)
  const weakestItems = useMemo(() => {
    return [...itemStats].filter(i => i.gradeF > 0).sort((a, b) => (b.gradeF / b.total) - (a.gradeF / a.total)).slice(0, 15);
  }, [itemStats]);

  // 11. Strongest items (highest A rate)
  const strongestItems = useMemo(() => {
    return [...itemStats].filter(i => i.gradeA > 0 && i.total >= 3).sort((a, b) => (b.gradeA / b.total) - (a.gradeA / a.total)).slice(0, 10);
  }, [itemStats]);

  if (!exam) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" /> 統計分析
        </h1>
        <p className="text-sm text-gray-500 mt-1">{examData?.name} — 詳細數據儀表板</p>
      </div>

      {/* ===== Section 1: Overview KPIs ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon="👥" label="總報名" value={allCandidates.length} color="blue" />
        <StatCard icon="✅" label="已報到" value={checkedInTotal} color="green" suffix={`${checkedInTotal} (${Math.round(attendanceRate)}%)`} />
        <StatCard icon="🏆" label="合格" value={statusCounts.passed} color="emerald" />
        <StatCard icon="❌" label="不合格" value={statusCounts.failed} color="red" />
        <StatCard icon="📊" label="合格率" value={0} color="indigo" suffix={totalJudged > 0 ? `${passRate.toFixed(1)}%` : '-'} />
        <StatCard icon="⭐" label="叻叻獎" value={s?.lakLakCount || lakLakStudents.length} color="amber" />
      </div>

      {/* ===== Section 2: Status Breakdown Visual ===== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">📋 考生狀態分佈</h3>
        <div className="h-8 rounded-full overflow-hidden flex mb-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (count === 0) return null;
            const colors: Record<string, string> = { registered: 'bg-gray-300', checked_in: 'bg-blue-400', examining: 'bg-yellow-400', passed: 'bg-green-500', failed: 'bg-red-400', absent: 'bg-gray-200' };
            const pct = allCandidates.length > 0 ? (count / allCandidates.length) * 100 : 0;
            return <div key={status} className={`${colors[status] || 'bg-gray-300'} h-full transition-all flex items-center justify-center`} style={{ width: `${pct}%` }} title={`${STATUS_CONFIG[status]?.label || status}: ${count}`}>
              {pct > 8 && <span className="text-xs font-medium text-white drop-shadow">{count}</span>}
            </div>;
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(statusCounts).filter(([, c]) => c > 0).map(([status, count]) => {
            const colors: Record<string, string> = { registered: 'bg-gray-300', checked_in: 'bg-blue-400', examining: 'bg-yellow-400', passed: 'bg-green-500', failed: 'bg-red-400', absent: 'bg-gray-200' };
            return <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${colors[status] || 'bg-gray-300'}`} />
              <span className="text-gray-600">{STATUS_CONFIG[status]?.label || status}: <strong>{count}</strong></span>
            </div>;
          })}
        </div>
      </div>

      {/* ===== Section 3: Grade Distribution ===== */}
      {gradeDistribution.total > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">📊 整體成績分佈（所有評分項目）</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <GradeCard label="A（優秀）" count={gradeDistribution.A} total={gradeDistribution.total} color="bg-green-500" />
            <GradeCard label="B（良好）" count={gradeDistribution.B} total={gradeDistribution.total} color="bg-blue-500" />
            <GradeCard label="C（合格）" count={gradeDistribution.C} total={gradeDistribution.total} color="bg-yellow-500" />
            <GradeCard label="Pass" count={gradeDistribution.pass} total={gradeDistribution.total} color="bg-emerald-500" />
            <GradeCard label="F（不合格）" count={gradeDistribution.F} total={gradeDistribution.total} color="bg-red-500" />
          </div>
          <div className="h-6 rounded-full overflow-hidden flex">
            {[
              { label: 'A', count: gradeDistribution.A, color: 'bg-green-500' },
              { label: 'B', count: gradeDistribution.B, color: 'bg-blue-500' },
              { label: 'C', count: gradeDistribution.C, color: 'bg-yellow-500' },
              { label: 'Pass', count: gradeDistribution.pass, color: 'bg-emerald-400' },
              { label: 'F', count: gradeDistribution.F, color: 'bg-red-400' },
            ].filter(g => g.count > 0).map(g => {
              const pct = (g.count / gradeDistribution.total) * 100;
              return <div key={g.label} className={`${g.color} h-full flex items-center justify-center transition-all`} style={{ width: `${pct}%` }} title={`${g.label}: ${g.count} (${pct.toFixed(1)}%)`}>
                {pct > 6 && <span className="text-xs font-medium text-white drop-shadow">{g.label}</span>}
              </div>;
            })}
          </div>
        </div>
      )}

      {/* ===== Section 4: Belt-Level Performance ===== */}
      {beltStats.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">🥋 各帶級表現</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">帶級</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">報名</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">不合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格率</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">叻叻獎</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 w-36">比較</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {beltStats.map(b => (
                  <tr key={b.key} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{getBeltBadge(b.key)}</td>
                    <td className="px-3 py-2 text-center">{b.total}</td>
                    <td className="px-3 py-2 text-center text-green-600 font-medium">{b.passed}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{b.failed}</td>
                    <td className="px-3 py-2 text-center font-bold">{b.rate !== null ? `${b.rate}%` : '-'}</td>
                    <td className="px-3 py-2 text-center">{b.lakLak > 0 ? <span className="text-amber-600 font-medium">⭐ {b.lakLak}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2">
                      {b.judged > 0 && (
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500" style={{ width: `${(b.passed / b.judged) * 100}%` }} />
                          <div className="h-full bg-red-400" style={{ width: `${(b.failed / b.judged) * 100}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-center">{allCandidates.length}</td>
                  <td className="px-3 py-2 text-center text-green-600">{statusCounts.passed}</td>
                  <td className="px-3 py-2 text-center text-red-600">{statusCounts.failed}</td>
                  <td className="px-3 py-2 text-center">{totalJudged > 0 ? `${passRate.toFixed(1)}%` : '-'}</td>
                  <td className="px-3 py-2 text-center text-amber-600">⭐ {lakLakStudents.length}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===== Section 5: Group Performance ===== */}
      {groupStats.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">📁 分組表現</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {groupStats.map(g => {
              const judged = g.passed + g.failed;
              const rate = judged > 0 ? Math.round((g.passed / judged) * 100) : null;
              return (
                <div key={g.code} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-blue-600">{g.code.toUpperCase()} 組</span>
                    {g.belt && <span className="text-xs">{getBeltBadge(g.belt)}</span>}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">人數</span><span className="font-medium">{g.total}</span></div>
                    {g.passed > 0 && <div className="flex justify-between"><span className="text-green-600">合格</span><span className="font-medium text-green-600">{g.passed}</span></div>}
                    {g.failed > 0 && <div className="flex justify-between"><span className="text-red-600">不合格</span><span className="font-medium text-red-600">{g.failed}</span></div>}
                    {g.lakLak > 0 && <div className="flex justify-between"><span className="text-amber-600">叻叻獎</span><span className="font-medium text-amber-600">⭐ {g.lakLak}</span></div>}
                    {rate !== null && (
                      <div className="mt-1">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500" style={{ width: `${rate}%` }} />
                          <div className="h-full bg-red-400" style={{ width: `${100 - rate}%` }} />
                        </div>
                        <div className="text-center text-gray-500 mt-0.5">{rate}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Section 6: Dojo Performance ===== */}
      {dojoStats.length > 1 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">🏠 各道場表現</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">道場</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">報名</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">出席</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">不合格</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">合格率</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">叻叻獎</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 w-32">比較</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dojoStats.map(d => {
                  const judged = d.passed + d.failed;
                  const rate = judged > 0 ? Math.round((d.passed / judged) * 100) : null;
                  return (
                    <tr key={d.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{d.name}</td>
                      <td className="px-3 py-2 text-center">{d.total}</td>
                      <td className="px-3 py-2 text-center text-blue-600">{d.checkedIn}</td>
                      <td className="px-3 py-2 text-center text-green-600 font-medium">{d.passed}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-medium">{d.failed}</td>
                      <td className="px-3 py-2 text-center font-bold">{rate !== null ? `${rate}%` : '-'}</td>
                      <td className="px-3 py-2 text-center">{d.lakLak > 0 ? <span className="text-amber-600">⭐ {d.lakLak}</span> : '-'}</td>
                      <td className="px-3 py-2">
                        {judged > 0 && (
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-green-500" style={{ width: `${rate}%` }} />
                            <div className="h-full bg-red-400" style={{ width: `${100 - (rate || 0)}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Section 7: Gender Analysis ===== */}
      {Object.keys(genderStats).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">👫 性別分析</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(genderStats).map(([gender, data]) => {
              const judged = data.passed + data.failed;
              const rate = judged > 0 ? Math.round((data.passed / judged) * 100) : null;
              const label = GENDER_MAP[gender] || gender;
              return (
                <div key={gender} className="bg-gray-50 rounded-lg p-4 text-center border">
                  <div className="text-2xl mb-1">{gender === 'male' ? '👦' : gender === 'female' ? '👧' : '❓'}</div>
                  <div className="font-medium">{label}</div>
                  <div className="text-2xl font-bold text-gray-800 mt-1">{data.total}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    合格 <span className="text-green-600 font-medium">{data.passed}</span>
                    {' / '}不合格 <span className="text-red-600 font-medium">{data.failed}</span>
                  </div>
                  {rate !== null && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">合格率 {rate}%</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Section 8: Weakest Items ===== */}
      {weakestItems.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">⚠️ 不合格率最高項目（需加強訓練）</h3>
          <div className="space-y-2">
            {weakestItems.map((item, idx) => {
              const failRate = Math.round((item.gradeF / item.total) * 100);
              const categoryLabel = CATEGORY_NAMES[item.category] || item.category;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-red-500">#{idx + 1}</span>
                  <div className="w-16 shrink-0">{getBeltBadge(item.beltLevel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-medium truncate">
                        {categoryLabel && <span className="text-gray-400 mr-1">[{categoryLabel}]</span>}
                        {item.name}
                      </span>
                      <span className="text-xs text-red-600 font-medium whitespace-nowrap">{item.gradeF}/{item.total} 不合格 ({failRate}%)</span>
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

      {/* ===== Section 9: Strongest Items ===== */}
      {strongestItems.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">🌟 A級率最高項目（表現優秀）</h3>
          <div className="space-y-2">
            {strongestItems.map((item, idx) => {
              const aRate = Math.round((item.gradeA / item.total) * 100);
              const categoryLabel = CATEGORY_NAMES[item.category] || item.category;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-green-500">#{idx + 1}</span>
                  <div className="w-16 shrink-0">{getBeltBadge(item.beltLevel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-medium truncate">
                        {categoryLabel && <span className="text-gray-400 mr-1">[{categoryLabel}]</span>}
                        {item.name}
                      </span>
                      <span className="text-xs text-green-600 font-medium whitespace-nowrap">{item.gradeA}/{item.total} A級 ({aRate}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${aRate}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Section 10: Per-Belt Item Breakdown ===== */}
      {itemsByBelt.size > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">📋 各帶級評分項目詳情</h3>
          <div className="space-y-4">
            {BELT_ORDER_KEYS.filter(k => itemsByBelt.has(k)).map(beltKey => {
              const beltItems = itemsByBelt.get(beltKey)!;
              const byCat = new Map<string, typeof beltItems>();
              beltItems.forEach(i => {
                const cat = i.category || 'other';
                if (!byCat.has(cat)) byCat.set(cat, []);
                byCat.get(cat)!.push(i);
              });
              return (
                <div key={beltKey}>
                  <div className="flex items-center gap-2 mb-2">
                    {getBeltBadge(beltKey)}
                    <span className="text-sm text-gray-500">({beltItems.reduce((sum, i) => sum + i.total, 0)} 項成績)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">類別</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">項目</th>
                          <th className="px-2 py-1.5 text-center font-medium text-green-600">A</th>
                          <th className="px-2 py-1.5 text-center font-medium text-blue-600">B</th>
                          <th className="px-2 py-1.5 text-center font-medium text-yellow-600">C</th>
                          <th className="px-2 py-1.5 text-center font-medium text-red-600">F</th>
                          <th className="px-2 py-1.5 text-center font-medium text-emerald-600">Pass</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-28">分佈</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Array.from(byCat.entries()).flatMap(([cat, catItems]) =>
                          catItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              {idx === 0 && <td className="px-2 py-1.5 text-gray-500 font-medium" rowSpan={catItems.length}>{CATEGORY_NAMES[cat] || cat}</td>}
                              <td className="px-2 py-1.5 font-medium">{item.name}</td>
                              <td className="px-2 py-1.5 text-center text-green-600 font-medium">{item.gradeA || '-'}</td>
                              <td className="px-2 py-1.5 text-center text-blue-600 font-medium">{item.gradeB || '-'}</td>
                              <td className="px-2 py-1.5 text-center text-yellow-600 font-medium">{item.gradeC || '-'}</td>
                              <td className="px-2 py-1.5 text-center text-red-600 font-medium">{item.gradeF || '-'}</td>
                              <td className="px-2 py-1.5 text-center text-emerald-600 font-medium">{item.pass || '-'}</td>
                              <td className="px-2 py-1.5">
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                                  {item.total > 0 && <>
                                    <div className="h-full bg-green-500" style={{ width: `${(item.gradeA / item.total) * 100}%` }} title={`A: ${item.gradeA}`} />
                                    <div className="h-full bg-blue-400" style={{ width: `${(item.gradeB / item.total) * 100}%` }} title={`B: ${item.gradeB}`} />
                                    <div className="h-full bg-yellow-400" style={{ width: `${(item.gradeC / item.total) * 100}%` }} title={`C: ${item.gradeC}`} />
                                    <div className="h-full bg-emerald-400" style={{ width: `${(item.pass / item.total) * 100}%` }} title={`Pass: ${item.pass}`} />
                                    <div className="h-full bg-red-400" style={{ width: `${(item.gradeF / item.total) * 100}%` }} title={`F: ${item.gradeF}`} />
                                  </>}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Section 11: 叻叻獎 List ===== */}
      {lakLakStudents.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">⭐ 叻叻獎名單（{lakLakStudents.length} 人）</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {lakLakStudents.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-amber-800">{c.name}</span>
                <div className="flex items-center gap-1 ml-auto">
                  {getBeltBadge(c.currentBelt)}
                  <span className="text-xs text-amber-500">→</span>
                  {getBeltBadge(c.targetBelt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Section 12: Issuance Tracking ===== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">📦 派發追蹤</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: '證書', icon: '📜', data: issuanceSummary.certificate, eligibleNote: '' },
            { label: '成績表', icon: '📄', data: issuanceSummary.report_card, eligibleNote: '' },
            { label: '叻叻獎', icon: '⭐', data: issuanceSummary.lak_lak, eligibleNote: `(合資格: ${issuanceSummary.lak_lak.eligible})` },
          ].map(item => {
            const total = item.data.issued + item.data.not_issued + item.data.out_of_stock;
            return (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {item.eligibleNote && <span className="text-xs text-gray-400">{item.eligibleNote}</span>}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">✅ 已派</span>
                    <span className="font-medium">{item.data.issued}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-500">⏳ 未派</span>
                    <span className="font-medium">{item.data.not_issued}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">🚫 待定</span>
                    <span className="font-medium">{item.data.out_of_stock}</span>
                  </div>
                  {total > 0 && (
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex mt-1">
                      <div className="h-full bg-green-500" style={{ width: `${(item.data.issued / total) * 100}%` }} />
                      <div className="h-full bg-orange-400" style={{ width: `${(item.data.not_issued / total) * 100}%` }} />
                      <div className="h-full bg-gray-300" style={{ width: `${(item.data.out_of_stock / total) * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== 物資清單頁 ====================
// ==================== 證書匯出組件 ====================
function CertificateExportSection({ examId, candidateCount, examName }: { examId: number; candidateCount: number; examName?: string }) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    if (candidateCount === 0) {
      toast.error('沒有考生可匯出證書');
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/exam/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '匯出失敗' }));
        throw new Error(err.error || '匯出失敗');
      }
      const data = await response.json();
      if (!data.success || !data.downloadUrl) {
        throw new Error(data.error || '生成失敗');
      }
      // Trigger download via link
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = `證書_${examName || 'exam'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`已匯出 ${candidateCount} 份證書 PDF (${(data.fileSize/1024/1024).toFixed(1)}MB)`);
    } catch (err: any) {
      toast.error(err.message || '證書匯出失敗');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">📜 證書批量匯出</h3>
          <p className="text-sm text-gray-500 mt-1">
            自動為所有考生（{candidateCount} 人）生成對應帶級的證書 PDF，填入姓名、級別、考試日期
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={generating || candidateCount === 0}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          {generating ? '生成中...' : `匯出全部證書 (${candidateCount}份)`}
        </Button>
      </div>
    </div>
  );
}

function SuppliesPage({ examId }: { examId: number }) {
  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });
  const { data: retakeData } = trpc.exam.candidates.retakeInfo.useQuery({ examId });

  useExamSSE({ examId, enabled: true, autoInvalidate: true });

  const allCandidates = (candidates || []) as any[];
  const examData = exam as any;

  // ---- Belt Size Logic ----
  // 幼稚園 (K): age 3~5 → 160cm
  // 小學 (Primary): age 6~11 → 180cm
  // 中學 (Secondary): age 12+ → 210cm
  const getBeltSize = (age: number | null): { size: string; label: string } => {
    if (!age || age <= 5) return { size: '160cm', label: '幼稚園' };
    if (age <= 11) return { size: '180cm', label: '小學' };
    return { size: '210cm', label: '中學' };
  };

  // ---- Calculate belt orders ----
  // Only count non-absent candidates (candidates who will actually take the exam)
  const beltOrders = useMemo(() => {
    const orders: Record<string, { belt: string; beltName: string; sizes: Record<string, { count: number; label: string }> ; total: number }> = {};

    allCandidates.forEach(c => {
      if (c.status === 'absent') return; // skip absent
      const targetBelt = c.targetBelt;
      if (!targetBelt) return;

      if (!orders[targetBelt]) {
        orders[targetBelt] = {
          belt: targetBelt,
          beltName: getBeltName(targetBelt),
          sizes: {},
          total: 0,
        };
      }

      const { size, label } = getBeltSize(c.age);
      if (!orders[targetBelt].sizes[size]) {
        orders[targetBelt].sizes[size] = { count: 0, label };
      }
      orders[targetBelt].sizes[size].count++;
      orders[targetBelt].total++;
    });

    // Sort by belt order
    return Object.values(orders).sort((a, b) => {
      const aOrder = BELT_LEVELS[a.belt]?.order || 99;
      const bOrder = BELT_LEVELS[b.belt]?.order || 99;
      return aOrder - bOrder;
    });
  }, [allCandidates]);

  // ---- Detailed list per belt (for expandable detail) ----
  const beltDetailList = useMemo(() => {
    const map: Record<string, any[]> = {};
    allCandidates.forEach(c => {
      if (c.status === 'absent') return;
      const targetBelt = c.targetBelt;
      if (!targetBelt) return;
      if (!map[targetBelt]) map[targetBelt] = [];
      map[targetBelt].push(c);
    });
    return map;
  }, [allCandidates]);

  // ---- Other supplies: certificates, report cards, lak lak awards ----
  const otherSupplies = useMemo(() => {
    const active = allCandidates.filter(c => c.status !== 'absent');
    const passedCount = allCandidates.filter(c => c.status === 'passed').length;
    const lakLakCount = allCandidates.filter(c => c.hasLakLakAward).length;
    const lakLakEstimate = Math.ceil(active.length * 0.25); // 預估約25%獲獎
    return {
      totalActive: active.length,
      certificates: active.length, // all non-absent get certificate
      reportCards: active.length, // all non-absent get report card
      lakLakAwards: lakLakCount,
      lakLakEstimate,
      passed: passedCount,
    };
  }, [allCandidates]);

  // ---- Board (木板) Logic ----
  // 綠帶以上（currentBelt）才需要踢木板，按 currentBelt 決定塊數
  // 厚度：幼稚園=2分, 小學=3分, 中學以上=4分
  const BOARD_PER_BELT: Record<string, number> = {
    green: 8, green_blue: 8, blue: 8, blue_red: 8, red: 12, red_black: 28,
  };
  const BOARD_BELTS = ['green', 'green_blue', 'blue', 'blue_red', 'red', 'red_black'];

  const getBoardThickness = (age: number | null): { thickness: string; label: string } => {
    if (!age || age <= 5) return { thickness: '2分', label: '幼稚園' };
    if (age <= 11) return { thickness: '3分', label: '小學' };
    return { thickness: '4分', label: '中學' };
  };

  const boardOrders = useMemo(() => {
    const orders: Record<string, { belt: string; beltName: string; boardsPerPerson: number; candidates: number; thicknesses: Record<string, { count: number; totalBoards: number }> ; totalBoards: number; retakeBoards: number }> = {};

    allCandidates.forEach(c => {
      if (c.status === 'absent') return;
      const curBelt = c.currentBelt;
      if (!curBelt || !BOARD_PER_BELT[curBelt]) return;

      if (!orders[curBelt]) {
        orders[curBelt] = {
          belt: curBelt,
          beltName: getBeltName(curBelt),
          boardsPerPerson: BOARD_PER_BELT[curBelt],
          candidates: 0,
          thicknesses: {},
          totalBoards: 0,
          retakeBoards: 0,
        };
      }

      const { thickness } = getBoardThickness(c.age);
      if (!orders[curBelt].thicknesses[thickness]) {
        orders[curBelt].thicknesses[thickness] = { count: 0, totalBoards: 0 };
      }

      // Check if retake student — only count failed board items
      const isRetake = retakeData?.retakeCandidateIds?.includes(c.id) || false;
      let boardsForThis = BOARD_PER_BELT[curBelt];

      if (isRetake) {
        const prevInfo = retakeData?.previousScores?.[c.id];
        const prevScores = prevInfo?.scores || [];
        const prevStatus = prevInfo?.prevStatus || '';
        
        // If previously absent (never took the exam), full boards needed
        if (prevStatus === 'absent' || prevScores.length === 0) {
          // Keep full boards — they need to do the whole exam
        } else {
          // Previously failed — check which board items failed
          const failedBoardItems = prevScores.filter(ps =>
            ps.category === 'board' &&
            ['f', 'fail', 'false', '未達標', '否', '不合格', '沒有'].includes((ps.score || '').toLowerCase())
          );
          // If no board items failed in previous exam → 0 boards needed
          // If some board items failed → count boards per failed item:
          //   左/右 split items = 1 board each, single items = 2 boards each
          if (failedBoardItems.length === 0) {
            boardsForThis = 0;
          } else {
            boardsForThis = failedBoardItems.reduce((sum, ps) => {
              const name = ps.itemName || ps.name || '';
              const isSplit = name.includes('（左）') || name.includes('（右）');
              return sum + (isSplit ? 1 : 2);
            }, 0);
          }
        }
        orders[curBelt].retakeBoards += boardsForThis;
      }

      orders[curBelt].thicknesses[thickness].count++;
      orders[curBelt].thicknesses[thickness].totalBoards += boardsForThis;
      orders[curBelt].candidates++;
      orders[curBelt].totalBoards += boardsForThis;
    });

    return BOARD_BELTS
      .filter(key => orders[key])
      .map(key => orders[key]);
  }, [allCandidates, retakeData]);

  const boardGrandTotal = useMemo(() => {
    const totals = { total: 0, '2分': 0, '3分': 0, '4分': 0 };
    boardOrders.forEach(o => {
      totals.total += o.totalBoards;
      Object.entries(o.thicknesses).forEach(([thickness, data]) => {
        (totals as any)[thickness] = ((totals as any)[thickness] || 0) + data.totalBoards;
      });
    });
    return totals;
  }, [boardOrders]);

  // ---- Grand total belts ----
  const totalBelts = beltOrders.reduce((sum, o) => sum + o.total, 0);

  // Sizes breakdown across all belts
  const sizeGrandTotal = useMemo(() => {
    const sizes: Record<string, number> = { '160cm': 0, '180cm': 0, '210cm': 0 };
    beltOrders.forEach(o => {
      Object.entries(o.sizes).forEach(([size, data]) => {
        sizes[size] = (sizes[size] || 0) + data.count;
      });
    });
    return sizes;
  }, [beltOrders]);

  const [expandedBelt, setExpandedBelt] = useState<string | null>(null);

  if (!exam) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  // Score sheet export handler
  const [sheetExporting, setSheetExporting] = useState(false);
  async function handleExportSheets() {
    setSheetExporting(true);
    try {
      const response = await fetch('/api/exam/scoresheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '匯出失敗' }));
        throw new Error(err.error || '匯出失敗');
      }
      const data = await response.json();
      if (!data.success || !data.url) throw new Error(data.error || '生成失敗');
      const a = document.createElement('a');
      a.href = data.url;
      a.download = `成績表_${examData?.name || 'exam'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`已匯出 ${data.pages} 份成績表 (按分組時間表排序)`);
      if (data.skipped?.length > 0) toast.info(`跳過 ${data.skipped.length} 位 (無對應模板)`);
    } catch (err: any) {
      toast.error(err.message || '成績表匯出失敗');
    } finally {
      setSheetExporting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-600" /> 物資清單
          </h1>
          <p className="text-sm text-gray-500 mt-1">{examData?.name} — 所需物資計算（排除缺席考生）</p>
        </div>
        <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50"
          onClick={handleExportSheets} disabled={sheetExporting}>
          {sheetExporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Printer className="w-4 h-4 mr-1" />}
          匯出成績表PDF
        </Button>
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl">🥋</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{totalBelts}</div>
          <div className="text-xs text-orange-600">色帶總數</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
          <div className="text-2xl">🪵</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{boardGrandTotal.total}</div>
          <div className="text-xs text-rose-600">木板總數</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl">📜</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{otherSupplies.certificates}</div>
          <div className="text-xs text-blue-600">證書</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl">📄</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{otherSupplies.reportCards}</div>
          <div className="text-xs text-green-600">成績表</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl">⭐</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{otherSupplies.lakLakAwards}</div>
          <div className="text-xs text-amber-600">叻叻獎（實際）</div>
          <div className="text-sm text-amber-500 mt-1">建議準備 <span className="font-bold">{otherSupplies.lakLakEstimate}</span> 份</div>
          <div className="text-[10px] text-amber-400">（預估約25%考生）</div>
        </div>
      </div>

      {/* ===== Certificate Export ===== */}
      <CertificateExportSection examId={examId} candidateCount={otherSupplies.certificates} examName={examData?.name} />

      {/* ===== Belt Size Summary ===== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">📏 色帶尺寸總覽</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <div className="text-sm text-purple-600 font-medium">幼稚園</div>
            <div className="text-xs text-purple-400 mb-1">(年齡 ≤5)</div>
            <div className="text-3xl font-bold text-purple-700">{sizeGrandTotal['160cm']}</div>
            <div className="text-xs text-purple-500 mt-1">160cm</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
            <div className="text-sm text-cyan-600 font-medium">小學</div>
            <div className="text-xs text-cyan-400 mb-1">(年齡 6~11)</div>
            <div className="text-3xl font-bold text-cyan-700">{sizeGrandTotal['180cm']}</div>
            <div className="text-xs text-cyan-500 mt-1">180cm</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
            <div className="text-sm text-indigo-600 font-medium">中學</div>
            <div className="text-xs text-indigo-400 mb-1">(年齡 ≥12)</div>
            <div className="text-3xl font-bold text-indigo-700">{sizeGrandTotal['210cm']}</div>
            <div className="text-xs text-indigo-500 mt-1">210cm</div>
          </div>
        </div>
      </div>

      {/* ===== Belt Orders Table ===== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">🥋 色帶訂購明細</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">需訂色帶</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">總數</th>
                <th className="px-3 py-2 text-center font-medium text-purple-600">160cm<br/><span className="text-xs font-normal">幼稚園</span></th>
                <th className="px-3 py-2 text-center font-medium text-cyan-600">180cm<br/><span className="text-xs font-normal">小學</span></th>
                <th className="px-3 py-2 text-center font-medium text-indigo-600">210cm<br/><span className="text-xs font-normal">中學</span></th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">明細</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {beltOrders.map(order => (
                <React.Fragment key={order.belt}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {getBeltBadge(order.belt)}
                        <span className="text-gray-500 text-xs">× {order.total}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-lg">{order.total}</td>
                    <td className="px-3 py-2.5 text-center">
                      {order.sizes['160cm'] ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold">{order.sizes['160cm'].count}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {order.sizes['180cm'] ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 font-bold">{order.sizes['180cm'].count}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {order.sizes['210cm'] ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold">{order.sizes['210cm'].count}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setExpandedBelt(expandedBelt === order.belt ? null : order.belt)}
                        className="text-blue-500 hover:text-blue-700 text-xs underline"
                      >
                        {expandedBelt === order.belt ? '收起' : '展開'}
                      </button>
                    </td>
                  </tr>
                  {expandedBelt === order.belt && beltDetailList[order.belt] && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 bg-gray-50">
                        <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
                            {beltDetailList[order.belt].sort((a: any, b: any) => (a.age || 0) - (b.age || 0)).map((c: any) => {
                              const { size, label } = getBeltSize(c.age);
                              return (
                                <div key={c.id} className="flex items-center gap-1 bg-white rounded px-2 py-1 border">
                                  <span className="font-medium truncate">{c.name}</span>
                                  <span className="text-gray-400 shrink-0">({c.age || '?'}歲)</span>
                                  <span className="text-xs text-gray-500 shrink-0 ml-auto">{size}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-medium">
              <tr>
                <td className="px-3 py-2.5">合計</td>
                <td className="px-3 py-2.5 text-center font-bold text-lg">{totalBelts}</td>
                <td className="px-3 py-2.5 text-center font-bold text-purple-700">{sizeGrandTotal['160cm']}</td>
                <td className="px-3 py-2.5 text-center font-bold text-cyan-700">{sizeGrandTotal['180cm']}</td>
                <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{sizeGrandTotal['210cm']}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ===== Board Orders Table ===== */}
      {boardOrders.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">🪵 木板訂購明細</h3>
          <p className="text-xs text-gray-500 mb-3">綠帶以上需要木板。厚度：幼稚園 = 2分、小學 = 3分、中學以上 = 4分</p>
          
          {/* Board thickness summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <div className="text-sm text-amber-600 font-medium">幼稚園</div>
              <div className="text-xs text-amber-400 mb-1">2分厚</div>
              <div className="text-2xl font-bold text-amber-700">{boardGrandTotal['2分']}</div>
              <div className="text-xs text-amber-500 mt-0.5">塊</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <div className="text-sm text-orange-600 font-medium">小學</div>
              <div className="text-xs text-orange-400 mb-1">3分厚</div>
              <div className="text-2xl font-bold text-orange-700">{boardGrandTotal['3分']}</div>
              <div className="text-xs text-orange-500 mt-0.5">塊</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-sm text-red-600 font-medium">中學以上</div>
              <div className="text-xs text-red-400 mb-1">4分厚</div>
              <div className="text-2xl font-bold text-red-700">{boardGrandTotal['4分']}</div>
              <div className="text-xs text-red-500 mt-0.5">塊</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">現時帶級</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">人數</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">每人塊數</th>
                  <th className="px-3 py-2 text-center font-medium text-amber-600">2分<br/><span className="text-xs font-normal">幼稚園</span></th>
                  <th className="px-3 py-2 text-center font-medium text-orange-600">3分<br/><span className="text-xs font-normal">小學</span></th>
                  <th className="px-3 py-2 text-center font-medium text-red-600">4分<br/><span className="text-xs font-normal">中學</span></th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {boardOrders.map(order => (
                  <tr key={order.belt} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {getBeltBadge(order.belt)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">{order.candidates}</td>
                    <td className="px-3 py-2.5 text-center font-medium">{order.boardsPerPerson}</td>
                    <td className="px-3 py-2.5 text-center">
                      {order.thicknesses['2分'] ? (
                        <span className="text-amber-700 font-medium">{order.thicknesses['2分'].totalBoards}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {order.thicknesses['3分'] ? (
                        <span className="text-orange-700 font-medium">{order.thicknesses['3分'].totalBoards}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {order.thicknesses['4分'] ? (
                        <span className="text-red-700 font-medium">{order.thicknesses['4分'].totalBoards}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-lg">{order.totalBoards}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-medium">
                <tr>
                  <td className="px-3 py-2.5">合計</td>
                  <td className="px-3 py-2.5 text-center">{boardOrders.reduce((s, o) => s + o.candidates, 0)}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-center font-bold text-amber-700">{boardGrandTotal['2分']}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-orange-700">{boardGrandTotal['3分']}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-red-700">{boardGrandTotal['4分']}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-lg">{boardGrandTotal.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Retake note */}
          {retakeData && retakeData.retakeCandidateIds.length > 0 && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <span className="font-semibold">📌 補考調整：</span>
              {' '}本次有 {retakeData.retakeCandidateIds.filter(id => {
                const c = allCandidates.find((x: any) => x.id === id);
                return c && BOARD_PER_BELT[c.currentBelt];
              }).length} 位補考生需用木板。
              補考生如上次木板項目均合格，則不需重新踢板（0塊）；如有不合格項目，左/右拆分項每項1塊、單項每項2塊。
            </div>
          )}
        </div>
      )}

      {/* ===== Other Supplies ===== */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">📦 其他物資</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">物資項目</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">數量</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2.5 flex items-center gap-2">📜 證書</td>
                <td className="px-3 py-2.5 text-center font-bold">{otherSupplies.certificates}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">所有出席考生均需 (排除缺席)</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2.5 flex items-center gap-2">📄 成績表</td>
                <td className="px-3 py-2.5 text-center font-bold">{otherSupplies.reportCards}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">所有出席考生均需 (排除缺席)</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2.5 flex items-center gap-2">⭐ 叻叻獎獎狀</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-bold">{otherSupplies.lakLakAwards}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-amber-600 font-medium">建議 {otherSupplies.lakLakEstimate}</span>
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">實際數 / 預估25%。合格+非補考+A級≥80%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Notes ===== */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        <h4 className="font-semibold mb-2">📝 備註</h4>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>色帶尺寸依考生年齡判斷：幼稚園（≤5歲）= 160cm、小學（6~11歲）= 180cm、中學（≥12歲）= 210cm</li>
          <li>考生報考時的目標帶（target belt）即為需訂購的色帶顏色</li>
          <li>木板：綠帶以上才需要（按現時帶級）。塊數：綠/綠藍/藍/藍紅 各8塊、紅帶12塊、紅黑帶28塊（21項：拆分項各1塊、單項各2塊）</li>
          <li>木板厚度依考生年齡判斷：幼稚園 = 2分厚、小學 = 3分厚、中學以上 = 4分厚</li>
          <li>計算已排除「缺席」狀態的考生</li>
          <li>叻叻獎：實際數隨評分進度即時更新；建議準備數 = 考生人數 × 25%（歷屆約20~25%獲獎率）</li>
          <li>建議加訂 5~10% 備用量以防損耗</li>
        </ul>
      </div>
    </div>
  );
}

// ==================== 考試繳費管理 ====================
const EXAM_FEE_MAP: Record<string, number> = {
  yellow: 700, yellowGreen: 700, green: 700, red: 700, redBlack: 700,
  greenBlue: 800, blue: 800, blueRed: 800,
  black: 2200,
};

const BELT_NAME_MAP: Record<string, string> = {
  white: '白帶', yellow: '黃帶', yellowGreen: '黃綠帶', green: '綠帶',
  greenBlue: '綠藍帶', blue: '藍帶', blueRed: '藍紅帶', red: '紅帶',
  redBlack: '紅黑帶', black: '黑帶',
};

function PaymentsPage({ examId }: { examId: number }) {
  const utils = trpc.useUtils();
  const { data: stats, refetch: refetchStats } = trpc.exam.payments.stats.useQuery({ examId });
  const { data: payments, refetch: refetchPayments } = trpc.exam.payments.listByExam.useQuery({ examId });
  const { data: candidates } = trpc.exam.candidates.list.useQuery({ examId });

  const createPayment = trpc.exam.payments.create.useMutation({
    onSuccess: () => { refetchPayments(); refetchStats(); utils.exam.payments.listByExam.invalidate({ examId }); toast.success('繳費記錄已新增'); setShowCreate(false); },
    onError: (err) => toast.error(err.message || '新增失敗'),
  });
  const updatePayment = trpc.exam.payments.update.useMutation({
    onSuccess: () => { refetchPayments(); refetchStats(); toast.success('已更新'); },
    onError: (err) => toast.error(err.message || '更新失敗'),
  });
  const deletePayment = trpc.exam.payments.delete.useMutation({
    onSuccess: () => { refetchPayments(); refetchStats(); toast.success('已刪除'); },
    onError: (err) => toast.error(err.message || '刪除失敗'),
  });
  const bulkCreate = trpc.exam.payments.bulkCreate.useMutation({
    onSuccess: (result) => { refetchPayments(); refetchStats(); toast.success(`已批量新增 ${result.count} 筆記錄`); setShowBulk(false); },
    onError: (err) => toast.error(err.message || '批量新增失敗'),
  });

  const uploadReceipt = trpc.exam.payments.uploadReceipt.useMutation({
    onSuccess: () => { refetchPayments(); toast.success('收據已上傳'); setUploadingId(null); },
    onError: (err) => toast.error(err.message || '上傳失敗'),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'waived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleReceiptUpload = (paymentId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('檔案太大（上限 10MB）'); return; }
      setUploadingId(paymentId);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        uploadReceipt.mutate({
          examPaymentId: paymentId,
          receiptBase64: base64,
          receiptMimeType: file.type || 'image/jpeg',
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Build candidate payment status map
  const candidatePaymentMap = useMemo(() => {
    const map = new Map<number, any>();
    if (payments) {
      payments.forEach((p: any) => { if (p.candidateId) map.set(p.candidateId, p); });
    }
    return map;
  }, [payments]);

  // Build combined list: all candidates with payment info
  const combinedList = useMemo(() => {
    if (!candidates) return [];
    return (candidates as any[]).map((c: any) => {
      const payment = candidatePaymentMap.get(c.id);
      const fee = EXAM_FEE_MAP[c.targetBelt] || 0;
      const isRetake = c.isRetake || false;
      return {
        candidateId: c.id,
        studentId: c.studentId,
        studentName: c.studentName,
        targetBelt: c.targetBelt,
        targetBeltName: BELT_NAME_MAP[c.targetBelt] || c.targetBelt,
        fee: isRetake ? 0 : fee,
        isRetake,
        payment,
        status: payment ? payment.status : (isRetake ? 'waived' : 'unpaid'),
      };
    });
  }, [candidates, candidatePaymentMap]);

  // Filter + search
  const filteredList = useMemo(() => {
    let list = combinedList;
    if (filterStatus === 'paid') list = list.filter(c => c.status === 'confirmed');
    else if (filterStatus === 'unpaid') list = list.filter(c => c.status === 'unpaid' || c.status === 'pending');
    else if (filterStatus === 'waived') list = list.filter(c => c.status === 'waived');
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => c.studentName.toLowerCase().includes(term) || c.targetBeltName.includes(term));
    }
    return list;
  }, [combinedList, filterStatus, searchTerm]);

  // Quick actions
  const handleMarkPaid = (item: any) => {
    createPayment.mutate({
      examId,
      candidateId: item.candidateId,
      studentId: item.studentId,
      studentName: item.studentName,
      targetBelt: item.targetBelt,
      amount: String(item.fee),
      isRetake: item.isRetake,
      status: 'confirmed',
    });
  };

  const handleMarkWaived = (item: any) => {
    createPayment.mutate({
      examId,
      candidateId: item.candidateId,
      studentId: item.studentId,
      studentName: item.studentName,
      targetBelt: item.targetBelt,
      amount: '0',
      isRetake: true,
      status: 'waived',
      notes: '補考免費',
    });
  };

  const handleDelete = (paymentId: number) => {
    if (confirm('確定要刪除此繳費記錄？')) {
      deletePayment.mutate({ id: paymentId });
    }
  };

  // Bulk mark all retakes as waived
  const handleBulkWaiveRetakes = () => {
    const retakesUnpaid = combinedList.filter(c => c.isRetake && c.status === 'unpaid');
    if (retakesUnpaid.length === 0) { toast.info('所有補考生已標記'); return; }
    const records = retakesUnpaid.map(c => ({
      examId,
      candidateId: c.candidateId,
      studentId: c.studentId,
      studentName: c.studentName,
      targetBelt: c.targetBelt,
      amount: '0',
      isRetake: true,
      status: 'waived' as const,
      notes: '補考免費',
    }));
    bulkCreate.mutate({ records });
  };

  // Create payment form state
  const [createForm, setCreateForm] = useState({
    candidateId: 0, bank: '', receivingBank: '', paymentDate: '', notes: '',
  });

  const selectedCandidate = combinedList.find(c => c.candidateId === createForm.candidateId);

  const handleCreateSubmit = () => {
    if (!createForm.candidateId) { toast.error('請選擇考生'); return; }
    const item = combinedList.find(c => c.candidateId === createForm.candidateId);
    if (!item) return;
    createPayment.mutate({
      examId,
      candidateId: item.candidateId,
      studentId: item.studentId,
      studentName: item.studentName,
      targetBelt: item.targetBelt,
      amount: String(item.fee),
      isRetake: item.isRetake,
      status: 'confirmed',
      bank: createForm.bank || undefined,
      receivingBank: createForm.receivingBank || undefined,
      paymentDate: createForm.paymentDate ? new Date(createForm.paymentDate).toISOString() : undefined,
      notes: createForm.notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* ===== Stats Summary ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{stats?.totalCandidates ?? '-'}</div>
          <div className="text-xs text-gray-500">總考生</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-green-200">
          <div className="text-2xl font-bold text-green-600">{stats?.paidCount ?? '-'}</div>
          <div className="text-xs text-gray-500">已繳費</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats?.waivedCount ?? '-'}</div>
          <div className="text-xs text-gray-500">免費(補考)</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">{stats?.pendingCount ?? '-'}</div>
          <div className="text-xs text-gray-500">待確認</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats?.unpaidCount ?? '-'}</div>
          <div className="text-xs text-gray-500">未繳費</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center border-purple-200">
          <div className="text-2xl font-bold text-purple-600">${stats?.totalAmount ?? '0'}</div>
          <div className="text-xs text-gray-500">已收金額</div>
        </div>
      </div>

      {/* ===== Actions Bar ===== */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700 text-white text-sm">
          <Plus className="w-4 h-4 mr-1" /> 新增繳費
        </Button>
        <Button onClick={handleBulkWaiveRetakes} variant="outline" className="text-sm border-blue-300 text-blue-700 hover:bg-blue-50">
          <Ban className="w-4 h-4 mr-1" /> 批量標記補考免費
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜尋學生..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 h-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="h-9 px-3 rounded-md border text-sm bg-white"
          >
            <option value="all">全部</option>
            <option value="paid">已繳費</option>
            <option value="unpaid">未繳費</option>
            <option value="waived">免費</option>
          </select>
        </div>
      </div>

      {/* ===== Create Payment Modal ===== */}
      {showCreate && (
        <div className="bg-white rounded-lg border-2 border-green-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-green-800"><CreditCard className="w-4 h-4 inline mr-1" />新增繳費記錄</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">選擇考生</label>
              <select
                value={createForm.candidateId}
                onChange={(e) => setCreateForm(f => ({ ...f, candidateId: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-md border text-sm bg-white"
              >
                <option value={0}>-- 選擇考生 --</option>
                {combinedList.filter(c => c.status === 'unpaid').map(c => (
                  <option key={c.candidateId} value={c.candidateId}>
                    {c.studentName} → {c.targetBeltName} (${c.fee})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">付款銀行</label>
              <select
                value={createForm.bank}
                onChange={(e) => setCreateForm(f => ({ ...f, bank: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border text-sm bg-white"
              >
                <option value="">-- 選擇 --</option>
                <option value="HSBC">HSBC 匯豐</option>
                <option value="BOC">BOC 中銀</option>
                <option value="FPS">FPS 轉數快</option>
                <option value="cash">現金</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">收款帳戶</label>
              <select
                value={createForm.receivingBank}
                onChange={(e) => setCreateForm(f => ({ ...f, receivingBank: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border text-sm bg-white"
              >
                <option value="">-- 選擇 --</option>
                <option value="HSBC 484-287123-838">HSBC 484-287123-838</option>
                <option value="BOC 01269220114816">BOC 01269220114816</option>
                <option value="FPS 164577132 (BOC)">FPS 164577132 → BOC</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">付款日期</label>
              <Input type="date" value={createForm.paymentDate} onChange={(e) => setCreateForm(f => ({ ...f, paymentDate: e.target.value }))} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">備註</label>
              <Input placeholder="備註" value={createForm.notes} onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateSubmit} disabled={createPayment.isPending} className="bg-green-600 hover:bg-green-700 text-white w-full h-9">
                {createPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認入帳'}
              </Button>
            </div>
          </div>
          {selectedCandidate && (
            <div className="text-sm text-gray-600 bg-green-50 p-2 rounded">
              金額：<span className="font-bold text-green-700">${selectedCandidate.fee}</span>
              {' '}| 考{selectedCandidate.targetBeltName}
              {selectedCandidate.isRetake && <span className="ml-2 text-blue-600">(補考-免費)</span>}
            </div>
          )}
        </div>
      )}

      {/* ===== Payment Table ===== */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">學生姓名</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">考帶</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">費用</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">狀態</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">付款方式</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">日期</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">收據</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredList.map((item, idx) => (
                <tr key={item.candidateId} className={`hover:bg-gray-50 ${item.isRetake ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    {item.studentName}
                    {item.isRetake && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">補考</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${BELT_LEVELS[item.targetBelt]?.color || 'bg-gray-100'}`}>
                      {item.targetBeltName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium">{item.fee > 0 ? `$${item.fee}` : '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {item.status === 'confirmed' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />已繳</span>}
                    {item.status === 'waived' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"><Ban className="w-3 h-3" />免費</span>}
                    {item.status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" />待確認</span>}
                    {item.status === 'unpaid' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700"><XCircle className="w-3 h-3" />未繳</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-500">{item.payment?.bank || '-'}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                    {item.payment?.paymentDate ? new Date(item.payment.paymentDate).toLocaleDateString('zh-HK') : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {item.payment?.receiptUrl ? (
                      <Button size="sm" variant="ghost" onClick={() => setPreviewUrl(item.payment.receiptUrl)} className="text-green-600 hover:text-green-700 h-7 px-2 text-xs" title="查看收據">
                        <Eye className="w-3 h-3" />
                      </Button>
                    ) : item.payment && item.status !== 'waived' ? (
                      <Button size="sm" variant="ghost" onClick={() => handleReceiptUpload(item.payment.id)} disabled={uploadingId === item.payment.id} className="text-orange-500 hover:text-orange-700 h-7 px-2 text-xs" title="上傳收據">
                        {uploadingId === item.payment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </Button>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {item.status === 'unpaid' && !item.isRetake && (
                      <Button size="sm" variant="ghost" onClick={() => handleMarkPaid(item)} className="text-green-600 hover:text-green-700 h-7 px-2 text-xs">
                        <DollarSign className="w-3 h-3 mr-0.5" />入帳
                      </Button>
                    )}
                    {item.status === 'unpaid' && item.isRetake && (
                      <Button size="sm" variant="ghost" onClick={() => handleMarkWaived(item)} className="text-blue-600 hover:text-blue-700 h-7 px-2 text-xs">
                        <Ban className="w-3 h-3 mr-0.5" />免費
                      </Button>
                    )}
                    {item.payment && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.payment.id)} className="text-red-500 hover:text-red-700 h-7 px-2 text-xs">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">沒有符合條件的記錄</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Receipt Preview Modal ===== */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-auto p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">收據預覽</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}><X className="w-4 h-4" /></Button>
            </div>
            <img src={previewUrl} alt="收據" className="w-full rounded border" />
          </div>
        </div>
      )}

      {/* ===== Fee Structure Reference ===== */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Receipt className="w-4 h-4" /> 收費標準</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white rounded p-2 border">
            <div className="font-medium text-gray-700">$700</div>
            <div className="text-gray-500">黃帶 / 黃綠帶 / 綠帶 / 紅帶 / 紅黑帶</div>
          </div>
          <div className="bg-white rounded p-2 border">
            <div className="font-medium text-gray-700">$800</div>
            <div className="text-gray-500">綠藍帶 / 藍帶 / 藍紅帶</div>
          </div>
          <div className="bg-white rounded p-2 border">
            <div className="font-medium text-gray-700">$2,200</div>
            <div className="text-gray-500">黑帶</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          收款帳戶：HSBC 484-287123-838 ｜ BOC 01269220114816 ｜ FPS ID 164577132 → BOC
        </div>
      </div>
    </div>
  );
}
