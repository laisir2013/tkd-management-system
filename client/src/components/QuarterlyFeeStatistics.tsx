import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface QuarterlyFeeStatisticsProps {
  coachName?: string;
  year?: number;
  quarter?: number;
}

export function QuarterlyFeeStatistics({ coachName, year: externalYear, quarter: externalQuarter }: QuarterlyFeeStatisticsProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  // 如果外部傳入 year/quarter 就用外部的，否則用內部 state
  const hasExternalControl = externalYear !== undefined && externalQuarter !== undefined;
  const [internalYear, setInternalYear] = useState(currentYear);
  const [internalQuarter, setInternalQuarter] = useState(currentQuarter);
  const selectedYear = hasExternalControl ? externalYear : internalYear;
  const selectedQuarter = hasExternalControl ? externalQuarter : internalQuarter;
  const [showUnpaid, setShowUnpaid] = useState(false);
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  const { data: stats, isLoading } = trpc.users.getQuarterlyStats.useQuery({
    year: selectedYear,
    quarter: selectedQuarter,
    coachName,
  }, { refetchInterval: 30000 });

  const { data: unpaidData, isLoading: unpaidLoading } = trpc.users.getUnpaidStudentsForQuarter.useQuery({
    year: selectedYear,
    quarter: selectedQuarter,
    coachName,
  }, {
    enabled: showUnpaid,
  });

  if (isLoading) {
    return <div className="text-center py-8">載入中...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8">暫無數據</div>;
  }

  const toggleVenue = (venue: string) => {
    setExpandedVenues(prev => {
      const next = new Set(prev);
      if (next.has(venue)) {
        next.delete(venue);
      } else {
        next.add(venue);
      }
      return next;
    });
  };

  const expandAllVenues = () => {
    if (!unpaidData) return;
    const allVenues = new Set(unpaidData.unpaidStudents.map(s => s.venue));
    setExpandedVenues(allVenues);
  };

  const collapseAllVenues = () => {
    setExpandedVenues(new Set());
  };

  // 按道場分組未繳費學生
  type UnpaidStudent = { id: number; name: string; phone: string; venue: string; feePerQuarter: string };
  const groupByVenue = (studentList: UnpaidStudent[]) => {
    const groups: Record<string, UnpaidStudent[]> = {};
    studentList.forEach(s => {
      if (!groups[s.venue]) groups[s.venue] = [];
      groups[s.venue].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'zh-TW'));
  };

  const handleWhatsAppClick = (student: { id: number; name: string; phone: string; feePerQuarter: string }) => {
    const quarterName = `${(selectedQuarter - 1) * 3 + 1}-${selectedQuarter * 3}月`;
    const fee = Number(student.feePerQuarter).toFixed(2);
    const message = `🥋 *${student.name}* 家長您好！\n\n📌 *${selectedYear}年 ${quarterName} 學費通知*\n應繳學費：*$${fee}*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${student.phone}&text=${encodeURIComponent(message)}`;

    // 記錄提醒時間
    const key = `whatsapp_reminder_${student.id}`;
    localStorage.setItem(key, Date.now().toString());

    window.open(whatsappUrl, "_blank");
  };

  // 格式化最後提醒時間
  const getLastRemindedText = (studentId: number): string | null => {
    const key = `whatsapp_reminder_${studentId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const diff = Date.now() - parseInt(stored, 10);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "剛剛已通知";
    if (minutes < 60) return `${minutes}分鐘前已通知`;
    if (hours < 24) return `${hours}小時前已通知`;
    return `${days}天前已通知`;
  };

  return (
    <div className="space-y-6">
      {/* 季度選擇器 — 僅在沒有外部控制時顯示 */}
      {!hasExternalControl && (
        <div className="flex gap-4 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setInternalYear(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedQuarter}
            onChange={(e) => setInternalQuarter(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={1}>1-3月(第一季)</option>
            <option value={2}>4-6月(第二季)</option>
            <option value={3}>7-9月(第三季)</option>
            <option value={4}>10-12月(第四季)</option>
          </select>
        </div>
      )}

      {/* 季度總覽 */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedYear}年 Q{selectedQuarter}(季度)</CardTitle>
          <CardDescription>季度收入統計(基於實際繳費記錄)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 恆常班統計 */}
            <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
              <div className="text-sm text-gray-600 mb-1">💰 恆常班應收總額</div>
              <div className="text-2xl font-bold text-amber-700">${stats.totalExpectedFee?.toFixed(2) || '0.00'}</div>
              <div className="text-xs text-amber-600 mt-1">共 {stats.totalStudents || 0} 位學生</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">✅ 恆常班實收金額</div>
              <div className="text-2xl font-bold text-green-600">${stats.totalPaidFee.toFixed(2)}</div>
              <div className="text-xs text-green-600 mt-1">已繳費 {stats.paidStudentCount || 0} 位學生</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">❌ 恆常班未收金額</div>
              <div className="text-2xl font-bold text-red-600">${stats.totalUnpaidFee?.toFixed(2) || '0.00'}</div>
              <div className="text-xs text-red-600 mt-1">未繳費 {stats.unpaidStudentCount || 0} 位學生</div>
            </div>
            
            {/* 精英班統計 */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">🏆 精英班已繳費用</div>
              <div className="text-2xl font-bold text-purple-600">$0.00</div>
              <div className="text-xs text-purple-600 mt-1">共 0 位學生</div>
            </div>
            
            {/* 總計 */}
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
              <div className="text-sm text-gray-600 mb-1">📊 季度總收入（實收）</div>
              <div className="text-3xl font-bold text-blue-600">${stats.totalPaidFee.toFixed(2)}</div>
              <div className="text-xs text-blue-600 mt-1">已繳費 {stats.paidStudentCount || 0} / {stats.totalStudents || 0} 位學生</div>
              {/* 繳費率進度條 */}
              {stats.totalStudents > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">繳費率</span>
                    <span className="font-semibold text-blue-700">
                      {((stats.paidStudentCount || 0) / stats.totalStudents * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(((stats.paidStudentCount || 0) / stats.totalStudents * 100), 100)}%`,
                        background: ((stats.paidStudentCount || 0) / stats.totalStudents) >= 0.8
                          ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                          : ((stats.paidStudentCount || 0) / stats.totalStudents) >= 0.5
                          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                          : 'linear-gradient(90deg, #ef4444, #dc2626)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-gray-400">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 未繳費學生名單 */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle className="text-lg text-red-700">未繳費學生名單</CardTitle>
                <CardDescription>
                  {selectedYear}年 Q{selectedQuarter} 尚未繳費的學生
                </CardDescription>
              </div>
            </div>
            <Button
              variant={showUnpaid ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnpaid(!showUnpaid)}
              className={showUnpaid ? "bg-red-600 hover:bg-red-700" : "border-red-300 text-red-600 hover:bg-red-50"}
            >
              {showUnpaid ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  收起名單
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  查看名單
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showUnpaid && (
          <CardContent>
            {unpaidLoading ? (
              <div className="text-center py-8">載入中...</div>
            ) : unpaidData ? (
              <div className="space-y-4">
                {/* 統計摘要 */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      未繳費：{unpaidData.unpaidCount} 人
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      已繳費：{unpaidData.paidCount} 人
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">
                      總計：{unpaidData.totalStudents} 人
                    </span>
                  </div>
                </div>

                {/* 全部展開/收起 */}
                {unpaidData.unpaidStudents.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAllVenues}>
                      全部展開
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAllVenues}>
                      全部收起
                    </Button>
                  </div>
                )}

                {/* 按道場分組 */}
                {unpaidData.unpaidStudents.length === 0 ? (
                  <div className="text-center py-6 text-green-600 font-medium">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    所有學生都已繳費！
                  </div>
                ) : (
                  groupByVenue(unpaidData.unpaidStudents).map(([venue, students]) => (
                    <div key={venue} className="border rounded-lg overflow-hidden">
                      {/* 道場標題 */}
                      <button
                        onClick={() => toggleVenue(venue)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{venue}</span>
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            {students.length} 人未繳
                          </span>
                        </div>
                        {expandedVenues.has(venue) ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {/* 學生列表 */}
                      {expandedVenues.has(venue) && (
                        <div className="divide-y">
                          {students.map(student => {
                            const lastReminded = getLastRemindedText(student.id);
                            return (
                              <div
                                key={student.id}
                                className="flex items-center justify-between p-3 hover:bg-gray-50"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{student.name}</div>
                                  <div className="text-xs text-gray-500">{student.phone}</div>
                                  {lastReminded && (
                                    <div className="text-xs text-green-600 mt-0.5">{lastReminded}</div>
                                  )}
                                </div>
                                <div className="text-right mr-3 shrink-0">
                                  <div className="text-sm font-bold text-red-600">
                                    ${Number(student.feePerQuarter).toFixed(2)}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleWhatsAppClick(student)}
                                  className="shrink-0 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
                                >
                                  <WhatsAppIcon className="h-4 w-4 mr-1" />
                                  通知
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
