import { useState, useMemo, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { useExamSSE } from "../lib/useExamSSE";
import { useParams } from "wouter";
import { toast, Toaster } from "sonner";

// 帶級定義
const BELT_LEVELS: Record<string, { name: string; order: number }> = {
  white: { name: '白帶', order: 1 },
  yellow: { name: '黃帶', order: 2 },
  yellow_green: { name: '黃綠帶', order: 3 },
  green: { name: '綠帶', order: 4 },
  green_blue: { name: '綠藍帶', order: 5 },
  blue: { name: '藍帶', order: 6 },
  blue_red: { name: '藍紅帶', order: 7 },
  red: { name: '紅帶', order: 8 },
  red_black: { name: '紅黑帶', order: 9 },
  black: { name: '黑帶', order: 10 },
  black_2dan: { name: '黑帶二段', order: 11 },
  black_3dan: { name: '黑帶三段', order: 12 },
};

const BELT_COLORS: Record<string, string> = {
  white: "bg-slate-50 border-slate-200",
  yellow: "bg-yellow-50 border-yellow-200",
  yellow_green: "bg-lime-50 border-lime-200",
  green: "bg-green-50 border-green-200",
  green_blue: "bg-teal-50 border-teal-200",
  blue: "bg-blue-50 border-blue-200",
  blue_red: "bg-indigo-50 border-indigo-200",
  red: "bg-red-50 border-red-200",
  red_black: "bg-purple-50 border-purple-200",
  black: "bg-gray-100 border-gray-300",
  black_2dan: "bg-gray-100 border-gray-300",
  black_3dan: "bg-gray-100 border-gray-300",
};

const BELT_TAG_COLORS: Record<string, string> = {
  white: "text-slate-500 bg-slate-100",
  yellow: "text-yellow-700 bg-yellow-100",
  yellow_green: "text-lime-700 bg-lime-100",
  green: "text-green-700 bg-green-100",
  green_blue: "text-teal-700 bg-teal-100",
  blue: "text-blue-700 bg-blue-100",
  blue_red: "text-purple-700 bg-purple-100",
  red: "text-red-700 bg-red-100",
  red_black: "text-rose-800 bg-rose-100",
  black: "text-slate-900 bg-slate-200",
  black_2dan: "text-slate-900 bg-slate-200",
  black_3dan: "text-slate-900 bg-slate-200",
};

function getBeltName(key: string) {
  return BELT_LEVELS[key]?.name || key;
}

function isCheckedInStatus(status: string) {
  return ['checked_in', 'examining', 'passed', 'failed'].includes(status);
}

function getGroupBeltLabels(candidates: { currentBelt: string }[]) {
  if (candidates.length === 0) return "-";
  const belts = Array.from(new Set(candidates.map(c => c.currentBelt)));
  const sorted = belts.sort((a, b) => (BELT_LEVELS[a]?.order ?? 99) - (BELT_LEVELS[b]?.order ?? 99));
  return sorted.map(k => getBeltName(k)).join(" / ");
}

export default function ExamAttendance() {
  const params = useParams<{ examId: string }>();
  const examId = parseInt(params.examId || "0");
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [sseConnected, setSseConnected] = useState(false);

  const { data: exam } = trpc.exam.get.useQuery({ id: examId });
  const { data: schedules, isLoading: schedulesLoading } = trpc.exam.schedules.list.useQuery({ examId });
  const { data: candidates, isLoading: candidatesLoading, refetch: refetchCandidates } = trpc.exam.candidates.list.useQuery(
    { examId },
    // WebSocket 負責即時更新，SSE 作為考試專用的額外保障
    { refetchIntervalInBackground: true }
  );

  // SSE 即時同步 - 取代頻繁輪詢
  useExamSSE({
    examId,
    enabled: examId > 0,
    autoInvalidate: true,
    onConnected: () => setSseConnected(true),
    onAttendanceUpdate: (data) => {
      if (data.candidateName && data.action) {
        const actionLabel = data.action === 'check_in' ? '已報到' : 
          data.action === 'mark_absent' ? '標記缺席' : 
          data.action === 'undo_check_in' ? '取消報到' : 
          data.action === 'bulk_check_in' ? '批量報到' : '狀態更新';
        toast.info(`${data.candidateName} ${actionLabel}`, { duration: 2000 });
      }
    },
    onCandidateUpdate: () => {
      // SSE 已經 autoInvalidate，這裡不需要手動 refetch
    },
  });

  const checkInMutation = trpc.exam.attendance.checkIn.useMutation({ onSuccess: () => refetchCandidates() });
  const undoCheckInMutation = trpc.exam.attendance.undoCheckIn.useMutation({ onSuccess: () => refetchCandidates() });
  const markAbsentMutation = trpc.exam.attendance.markAbsent.useMutation({ onSuccess: () => refetchCandidates() });

  const handleCheckIn = async (candidateId: number, name: string) => {
    setLoadingIds(prev => new Set(prev).add(candidateId));
    try {
      await checkInMutation.mutateAsync({ candidateId });
      toast.success(`${name} 已報到`);
    } catch (e: any) { toast.error(e.message || "報到失敗"); }
    finally { setLoadingIds(prev => { const n = new Set(prev); n.delete(candidateId); return n; }); }
  };

  const handleUndoCheckIn = async (candidateId: number, name: string) => {
    setLoadingIds(prev => new Set(prev).add(candidateId));
    try {
      await undoCheckInMutation.mutateAsync({ candidateId });
      toast.success(`${name} 已取消報到`);
    } catch (e: any) { toast.error(e.message || "取消報到失敗"); }
    finally { setLoadingIds(prev => { const n = new Set(prev); n.delete(candidateId); return n; }); }
  };

  const handleMarkAbsent = async (candidateId: number, name: string, absent: boolean) => {
    setLoadingIds(prev => new Set(prev).add(candidateId));
    try {
      await markAbsentMutation.mutateAsync({ candidateId, absent });
      toast.success(absent ? `${name} 已標記為缺席` : `${name} 已取消缺席`);
    } catch (e: any) { toast.error(e.message || "操作失敗"); }
    finally { setLoadingIds(prev => { const n = new Set(prev); n.delete(candidateId); return n; }); }
  };

  const stats = useMemo(() => {
    if (!candidates) return { total: 0, checkedIn: 0, notCheckedIn: 0, absent: 0 };
    const total = candidates.length;
    const checkedIn = candidates.filter((c: any) => isCheckedInStatus(c.status)).length;
    const absent = candidates.filter((c: any) => c.status === 'absent').length;
    return { total, checkedIn, notCheckedIn: total - checkedIn - absent, absent };
  }, [candidates]);

  const sortedSchedules = useMemo(() => {
    if (!schedules) return [];
    return [...schedules].sort((a: any, b: any) => {
      const aTime = String(a.startTime || '');
      const bTime = String(b.startTime || '');
      return aTime.localeCompare(bTime);
    });
  }, [schedules]);

  const isLoading = schedulesLoading || candidatesLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Toaster position="top-center" />
      {/* 頂部導航 */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              📋 點名
              {sseConnected && <span className="ml-2 text-xs text-green-500 font-normal">🟢 即時連線</span>}
            </h1>
            {exam && <p className="text-[10px] sm:text-xs text-slate-500">{(exam as any).name}</p>}
          </div>
          <button onClick={() => refetchCandidates()} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
            🔄 重新整理
          </button>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {/* 統計卡片 */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
          <StatCard icon="👥" label="總人數" value={stats.total} color="blue" />
          <StatCard icon="✅" label="已到" value={stats.checkedIn} color="green" />
          <StatCard icon="⏳" label="未到" value={stats.notCheckedIn} color="yellow" />
          <StatCard icon="🚫" label="缺席" value={stats.absent} color="orange" />
        </div>

        {/* 到場率進度條 */}
        {stats.total > 0 && (
          <div className="mb-3 sm:mb-4 bg-white rounded-xl border p-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>到場率</span>
              <span className="font-semibold text-green-600">{((stats.checkedIn / stats.total) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.checkedIn / stats.total) * 100}%` }} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">載入中...</div>
        ) : sortedSchedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">尚無時間表</p>
            <p className="text-sm">請先建立考試時間表</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSchedules.map((schedule: any) => {
              const groupCandidates = candidates?.filter((c: any) => c.groupCode === schedule.groupCode) || [];
              const bgColor = BELT_COLORS[schedule.beltLevel] || "bg-white border-slate-200";
              const groupBeltLabel = getGroupBeltLabels(groupCandidates);
              const checkedInCount = groupCandidates.filter((c: any) => isCheckedInStatus(c.status)).length;
              const allCheckedIn = groupCandidates.length > 0 && checkedInCount === groupCandidates.length;

              return (
                <div key={schedule.id} className={`rounded-xl border-2 overflow-hidden ${bgColor}`}>
                  {/* 組別標題 */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-inherit">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl font-bold text-slate-900 w-8 text-center">
                        {schedule.groupCode?.toUpperCase() || "-"}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-700 block">{groupBeltLabel}</span>
                        <span className="text-xs text-slate-500">
                          {String(schedule.startTime || '')} - {String(schedule.endTime || '')}
                        </span>
                      </div>
                    </div>
                    <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${
                      allCheckedIn ? "bg-green-600 text-white" : "bg-white border text-slate-600"
                    }`}>
                      {checkedInCount}/{groupCandidates.length}
                    </span>
                  </div>

                  {/* 考生列表 */}
                  <div className="p-2 space-y-1.5">
                    {groupCandidates.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-3">無考生</p>
                    ) : groupCandidates.map((candidate: any) => {
                      const isProcessing = loadingIds.has(candidate.id);
                      const isCheckedIn = isCheckedInStatus(candidate.status);
                      const isAbsent = candidate.status === 'absent';
                      const tagColor = BELT_TAG_COLORS[candidate.currentBelt] || "text-slate-500 bg-slate-100";

                      if (isAbsent) {
                        return (
                          <div key={candidate.id} className="flex items-stretch gap-2">
                            <div className="flex-1 rounded-xl border-2 border-orange-400 bg-orange-50 px-3 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">🚫</span>
                                <div className="flex-1 text-left min-w-0">
                                  <span className="text-base font-medium block text-orange-700 line-through">{candidate.name}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded inline-block mt-0.5 ${tagColor}`}>
                                    {getBeltName(candidate.currentBelt)}
                                  </span>
                                </div>
                                <span className="text-sm text-orange-600 font-bold">缺席</span>
                              </div>
                            </div>
                            <button onClick={() => !isProcessing && handleMarkAbsent(candidate.id, candidate.name, false)}
                              disabled={isProcessing}
                              className="rounded-xl border-2 border-green-200 bg-green-50 px-3 hover:bg-green-100 flex items-center">
                              <span className="text-xs text-green-600 font-medium">取消</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div key={candidate.id} className="flex items-stretch gap-2">
                          <button
                            onClick={() => !isProcessing && !isCheckedIn && handleCheckIn(candidate.id, candidate.name)}
                            disabled={isProcessing || isCheckedIn}
                            className={`flex-1 rounded-xl border-2 px-3 py-3 transition-all text-left ${
                              isCheckedIn
                                ? "border-green-400 bg-green-50"
                                : "border-slate-200 bg-white active:border-blue-400"
                            } ${isProcessing ? "opacity-50" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{isCheckedIn ? "✅" : "⭕"}</span>
                              <div className="flex-1 min-w-0">
                                <span className={`text-base font-medium block ${isCheckedIn ? "text-green-700" : "text-slate-700"}`}>
                                  {candidate.name}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded inline-block mt-0.5 ${tagColor}`}>
                                  {getBeltName(candidate.currentBelt)}
                                </span>
                              </div>
                              {isCheckedIn && <span className="text-sm text-green-600 font-bold">已到</span>}
                              {candidate.hasLakLakAward && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">⭐</span>}
                            </div>
                          </button>
                          <div className="flex flex-col gap-1">
                            {isCheckedIn ? (
                              <button onClick={() => !isProcessing && handleUndoCheckIn(candidate.id, candidate.name)}
                                disabled={isProcessing}
                                className="flex-1 rounded-xl border-2 border-red-200 bg-red-50 px-3 hover:bg-red-100 flex items-center justify-center">
                                <span className="text-xs text-red-600 font-medium">取消</span>
                              </button>
                            ) : (
                              <button onClick={() => !isProcessing && handleMarkAbsent(candidate.id, candidate.name, true)}
                                disabled={isProcessing}
                                className="rounded-xl border-2 border-orange-200 bg-orange-50 px-3 py-2 hover:bg-orange-100 flex items-center justify-center">
                                <span className="text-xs text-orange-600 font-medium">ABS</span>
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
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colors = {
    blue: "border-slate-200 bg-white",
    green: "border-green-200 bg-green-50/50",
    yellow: "border-yellow-200 bg-yellow-50/50",
    orange: "border-orange-200 bg-orange-50/50",
  };
  const textColors = {
    blue: "text-slate-900",
    green: "text-green-700",
    yellow: "text-yellow-700",
    orange: "text-orange-700",
  };
  return (
    <div className={`rounded-xl border p-2.5 sm:p-4 ${colors[color as keyof typeof colors] || colors.blue}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-[10px] sm:text-xs text-slate-500">{label}</p>
          <p className={`text-lg sm:text-2xl font-bold ${textColors[color as keyof typeof textColors] || textColors.blue}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
