import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ClipboardCheck, ListChecks, Eye, Calendar, ChevronRight, Award, Menu, ArrowLeft, X, LogOut, Trophy, ShieldCheck } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { CheckInPage, ScoringPage, ScoreViewPage, TimetablePage, ResultsPage } from "@/components/ExamManagement";

// 考試狀態設定
const EXAM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: '已排期', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '進行中', color: 'bg-green-100 text-green-700' },
  completed: { label: '已完成', color: 'bg-purple-100 text-purple-700' },
};

// 所有可用的頁面
type StaffNavPage = 'checkin' | 'scoring' | 'scoreview' | 'timetable' | 'results';
const ALL_NAV_ITEMS: { key: StaffNavPage; label: string; icon: any }[] = [
  { key: 'checkin', label: '點名', icon: ListChecks },
  { key: 'scoring', label: '評分', icon: ClipboardCheck },
  { key: 'scoreview', label: '成績記錄', icon: Eye },
  { key: 'timetable', label: '時間表', icon: Calendar },
  { key: 'results', label: '合格名單', icon: Trophy },
];

// 根據角色過濾可見頁面
// staff(工作人員): 點名 + 成績記錄(唯讀) + 時間表(唯讀) + 合格名單 — 不能看評分表
// examiner(考官): 全部 5 個功能（含評分表），時間表仍為唯讀
// admin: 全部
function getNavItemsForRole(role: string) {
  if (role === 'staff') {
    return ALL_NAV_ITEMS.filter(item => item.key !== 'scoring');
  }
  // examiner, admin, coach 看到全部（含評分表）
  return ALL_NAV_ITEMS;
}

export default function StaffDashboard() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [navPage, setNavPage] = useState<StaffNavPage>('checkin');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-600">請先登入</p>
          <button onClick={() => setLocation('/staff-login')}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            前往登入
          </button>
        </div>
      </div>
    );
  }

  // 允許 staff, examiner, admin, coach 使用（支援多角色）
  const userRoles: string[] = (user as any).roles || [user.role];
  const canAccessStaff = userRoles.some(r => ['staff', 'examiner', 'admin', 'coach'].includes(r));
  if (!canAccessStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-medium">您的帳號沒有工作人員權限</p>
          <p className="text-gray-500 text-sm">請聯絡管理員設定您的帳號角色</p>
          <button onClick={() => { logout(); setLocation('/staff-login'); }}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            返回登入
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    setLocation('/staff-login');
  };

  if (!selectedExamId) {
    return (
      <>
        <Toaster />
        <StaffExamList
          onSelectExam={(id) => { setSelectedExamId(id); setNavPage('checkin'); }}
          user={user}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // 用 roles 判斷可見功能
  const effectiveRole = userRoles.includes('admin') ? 'admin' :
    userRoles.includes('examiner') || userRoles.includes('coach') ? 'examiner' : 
    userRoles.includes('staff') ? 'staff' : 'staff';
  const navItems = getNavItemsForRole(effectiveRole);
  const currentNavItem = navItems.find(item => item.key === navPage);

  // 角色標籤
  const roleLabel = userRoles.includes('admin') ? '管理員' :
    (userRoles.includes('coach') && userRoles.includes('examiner')) ? '教練/考官' :
    userRoles.includes('coach') ? '教練/考官' :
    userRoles.includes('examiner') ? '考官' : '工作人員';

  return (
    <>
      <Toaster />
      <div className="flex flex-col md:flex-row h-screen">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between bg-white border-b px-3 py-2 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-gray-100">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              {currentNavItem && <currentNavItem.icon className="w-4 h-4 text-teal-600" />}
              {currentNavItem?.label || '考試工具'}
            </div>
          </div>
          <button onClick={() => setSelectedExamId(null)}
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
                <div className="flex items-center gap-2 text-sm font-bold text-teal-700">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>考試工作系統</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <button onClick={() => { setSelectedExamId(null); setSidebarOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-b">
                <ArrowLeft className="w-4 h-4" /> 選擇考試
              </button>
              <nav className="flex-1 py-2">
                {navItems.map(item => (
                  <button key={item.key}
                    onClick={() => { setNavPage(item.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                      navPage === item.key ? 'bg-teal-50 text-teal-700 font-medium border-r-2 border-teal-600' : 'text-gray-600 hover:bg-gray-50'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  <LogOut className="w-4 h-4" /> 登出
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Left Sidebar */}
        <div className="hidden md:flex w-48 bg-white border-r flex-col shrink-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 text-sm font-bold text-teal-700">
              <ClipboardCheck className="w-4 h-4" />
              <span>考試工作系統</span>
            </div>
          </div>
          <button onClick={() => setSelectedExamId(null)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-b">
            <ArrowLeft className="w-4 h-4" /> 選擇考試
          </button>
          <nav className="flex-1 py-2">
            {navItems.map(item => (
              <button key={item.key}
                onClick={() => setNavPage(item.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  navPage === item.key ? 'bg-teal-50 text-teal-700 font-medium border-r-2 border-teal-600' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t">
            <div className="text-xs text-gray-500 mb-2 px-1">
              {user.name || '工作人員'}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                userRoles.includes('coach') ? 'bg-blue-100 text-blue-700' : userRoles.includes('examiner') ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>{roleLabel}</span>
            </div>
            {userRoles.includes('coach') && (
              <button onClick={() => setLocation('/coach')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg mb-1">
                <ArrowLeft className="w-4 h-4" /> 返回教練系統
              </button>
            )}
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
              <LogOut className="w-4 h-4" /> 登出
            </button>
          </div>
        </div>

        {/* Main Content — 直接使用 ExamManagement 的子組件 */}
        <div className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 md:p-6">
          {navPage === 'checkin' && <CheckInPage examId={selectedExamId} />}
          {navPage === 'scoring' && effectiveRole !== 'staff' && <ScoringPage examId={selectedExamId} />}
          {navPage === 'scoreview' && <ScoreViewPage examId={selectedExamId} />}
          {navPage === 'timetable' && <TimetablePage examId={selectedExamId} readOnly={true} />}
          {navPage === 'results' && <ResultsPage examId={selectedExamId} />}
        </div>
      </div>
    </>
  );
}

// ==================== 考試列表（工作人員版：只讀，不能新增/刪除考試） ====================
function StaffExamList({ onSelectExam, user, onLogout }: {
  onSelectExam: (id: number) => void;
  user: any;
  onLogout: () => void;
}) {
  const { data: exams } = trpc.exam.list.useQuery();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">考試工作系統</h1>
              <p className="text-xs text-gray-500">考試工作人員 / 考官專用</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">{user.name || '工作人員'}</span>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200">
              <LogOut className="w-3.5 h-3.5" /> 登出
            </button>
          </div>
        </div>
      </header>

      {/* Exam List */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">選擇考試</h2>

        <div className="space-y-2">
          {exams?.map((exam: any) => {
            const status = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
            return (
              <div key={exam.id}
                className="bg-white rounded-lg border p-4 flex items-center justify-between hover:shadow-md hover:border-teal-300 transition-all cursor-pointer"
                onClick={() => onSelectExam(exam.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{exam.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    📅 {new Date(exam.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {exam.examTime && <span className="ml-2">🕐 {exam.examTime}</span>}
                    {exam.location && <span className="ml-2">📍 {exam.location}</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
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
    </div>
  );
}
