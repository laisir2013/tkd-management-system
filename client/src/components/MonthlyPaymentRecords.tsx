import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Image, Upload, ShieldCheck, Check, Calendar, CreditCard, Undo2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const QUARTER_COLORS = [
  'bg-blue-50', 'bg-blue-50', 'bg-blue-50',       // Q1: 1-3月
  'bg-green-50', 'bg-green-50', 'bg-green-50',     // Q2: 4-6月
  'bg-amber-50', 'bg-amber-50', 'bg-amber-50',     // Q3: 7-9月
  'bg-purple-50', 'bg-purple-50', 'bg-purple-50',  // Q4: 10-12月
];

function getQuarterForMonth(month: number): { quarter: string; months: number[] } {
  if (month <= 3) return { quarter: 'Q1', months: [1, 2, 3] };
  if (month <= 6) return { quarter: 'Q2', months: [4, 5, 6] };
  if (month <= 9) return { quarter: 'Q3', months: [7, 8, 9] };
  return { quarter: 'Q4', months: [10, 11, 12] };
}

export function MonthlyPaymentRecords({ coachName }: { coachName?: string } = {}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [coachFilter, setCoachFilter] = useState<string>(coachName || "all");
  const { data: statuses, isLoading, refetch } = trpc.payments.getMonthlyStatuses.useQuery({ year: selectedYear });
  
  const yearOptions = [];
  for (let year = 2026; year <= currentYear + 1; year++) {
    yearOptions.push(year);
  }

  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [receiptInfo, setReceiptInfo] = useState<{ studentName: string; month: string } | null>(null);

  // Confirm payment dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    studentId: number;
    studentName: string;
    months: number[];
    paymentType: 'monthly' | 'quarterly';
    label: string;
  } | null>(null);

  // Revert payment dialog state (已繳→未繳)
  const [revertDialog, setRevertDialog] = useState<{
    studentId: number;
    studentName: string;
    month: number;
    paymentType: string;
  } | null>(null);

  const confirmMonthlyPayment = trpc.payments.confirmMonthlyPayment.useMutation({
    onSuccess: () => {
      toast.success('已確認繳費');
      refetch();
      setConfirmDialog(null);
    },
    onError: (err: any) => {
      toast.error(`確認失敗: ${err.message}`);
    },
  });

  const revertPayment = trpc.payments.revertPayment.useMutation({
    onSuccess: () => {
      toast.success('已撤銷繳費，狀態改為未繳');
      refetch();
      setRevertDialog(null);
    },
    onError: (err: any) => {
      toast.error(`撤銷失敗: ${err.message}`);
    },
  });

  // 教練列表
  const coachList = useMemo(() => {
    if (!statuses) return [];
    const coaches = [...new Set(statuses.map((s: any) => s.coach).filter(Boolean))];
    return coaches.sort();
  }, [statuses]);

  // 篩選後的學生
  const filteredStatuses = useMemo(() => {
    if (!statuses) return [];
    if (coachFilter === 'all') return statuses;
    return statuses.filter((s: any) => s.coach === coachFilter);
  }, [statuses, coachFilter]);

  if (isLoading) {
    return <div className="text-center py-8">載入中...</div>;
  }

  if (!statuses || statuses.length === 0) {
    return <div className="text-center py-8">暫無數據</div>;
  }

  const handleWhatsAppNotify = (student: typeof statuses[0]) => {
    if (!student.phone || student.phone.trim() === '') {
      alert(`無法發送 WhatsApp：${student.studentName} 沒有電話號碼記錄。`);
      return;
    }

    setSendingWhatsApp(student.studentId);

    const unpaidMonths: string[] = [];
    for (let m = 1; m <= 12; m++) {
      if (student.months[m]?.status === 'unpaid') {
        unpaidMonths.push(`${m}月`);
      }
    }

    const monthsStr = unpaidMonths.join('、') || '（無未繳月份）';
    const systemUrl = window.location.origin;
    const message = `🥋 ${student.studentName} 家長您好！\n\n📌 *${selectedYear}年${monthsStr}學費通知*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\n📱 *上傳收據步驟*\n\n1️⃣ 完成轉帳並截圖\n2️⃣ 登入系統：${systemUrl}\n3️⃣ 使用您的電話號碼登入\n   · 帳號：${student.phone}\n   · 密碼：${student.phone}\n   (登入後可自行修改密碼)\n4️⃣ 上傳收據截圖\n5️⃣ 完成！\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${student.phone}&text=${encodeURIComponent(message)}`;
    const newWindow = window.open(whatsappUrl, "_blank");
    if (!newWindow) {
      alert('無法開啟 WhatsApp，請確認瀏覽器允許彈出視窗。');
    }
    setTimeout(() => setSendingWhatsApp(null), 1000);
  };

  const handleViewReceipt = (url: string, studentName: string, month: string) => {
    setReceiptUrl(url);
    setReceiptInfo({ studentName, month });
    setReceiptDialogOpen(true);
  };

  const getConfirmedByLabel = (confirmedBy: string | null | undefined) => {
    if (confirmedBy === 'parent_upload') return '家長上傳';
    if (confirmedBy === 'admin_approved') return '管理員批准';
    if (confirmedBy === 'coach_approved') return '教練確認';
    return '';
  };

  // 開啟確認對話框（單月）
  const handleConfirmMonth = (studentId: number, studentName: string, month: number) => {
    setConfirmDialog({
      studentId,
      studentName,
      months: [month],
      paymentType: 'monthly',
      label: `${month}月`,
    });
  };

  // 開啟確認對話框（季繳）
  const handleConfirmQuarter = (studentId: number, studentName: string, month: number) => {
    const { months } = getQuarterForMonth(month);
    const quarterLabel = `${months[0]}-${months[2]}月`;
    setConfirmDialog({
      studentId,
      studentName,
      months,
      paymentType: 'quarterly',
      label: quarterLabel,
    });
  };

  const getMonthStatusCell = (
    monthData: { status: string; paymentDate?: string | null; confirmedBy?: string | null; receiptUrl?: string | null; paymentType?: string | null },
    month: number,
    studentName: string,
    studentId: number,
  ) => {
    if (monthData.status === 'paid') {
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">
            已繳
          </div>
          {monthData.paymentType && (
            <div className="text-[9px] text-gray-400">
              {monthData.paymentType === 'quarterly' ? '季繳' : '月繳'}
            </div>
          )}
          {monthData.confirmedBy && (
            <div className="flex items-center justify-center gap-0.5 text-[9px]">
              {monthData.confirmedBy === 'parent_upload' ? (
                <Upload className="w-2.5 h-2.5 text-blue-500" />
              ) : (
                <ShieldCheck className="w-2.5 h-2.5 text-green-600" />
              )}
            </div>
          )}
          {monthData.receiptUrl && (
            <button 
              onClick={() => handleViewReceipt(monthData.receiptUrl!, studentName, `${month}月`)}
              className="flex items-center justify-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer mx-auto"
            >
              <Image className="w-2.5 h-2.5" />
            </button>
          )}
          {/* 撤銷繳費按鈕 */}
          <button
            onClick={() => setRevertDialog({
              studentId,
              studentName,
              month,
              paymentType: monthData.paymentType || 'monthly',
            })}
            className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors mx-auto border border-orange-300"
            title="撤銷繳費（轉為未繳）"
          >
            <Undo2 className="w-2.5 h-2.5" />
            轉未繳
          </button>
        </div>
      );
    } else if (monthData.status === 'unpaid') {
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">
            未繳
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => handleConfirmMonth(studentId, studentName, month)}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="確認單月已繳"
            >
              <Check className="w-2.5 h-2.5" />
              月繳
            </button>
            <button
              onClick={() => handleConfirmQuarter(studentId, studentName, month)}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              title="確認整季已繳"
            >
              <CreditCard className="w-2.5 h-2.5" />
              季繳
            </button>
          </div>
        </div>
      );
    } else {
      // not_due
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-300">
            未到期
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => handleConfirmMonth(studentId, studentName, month)}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-400 text-white hover:bg-blue-500 transition-colors"
              title="預繳單月"
            >
              <Check className="w-2.5 h-2.5" />
              月繳
            </button>
            <button
              onClick={() => handleConfirmQuarter(studentId, studentName, month)}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-indigo-400 text-white hover:bg-indigo-500 transition-colors"
              title="預繳整季"
            >
              <CreditCard className="w-2.5 h-2.5" />
              季繳
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                繳費紀錄（月份顯示）
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {coachName ? '我的學生' : '所有學生'}的月份繳費狀態
                {filteredStatuses.length > 0 && ` (${filteredStatuses.length} 人)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!coachName && (
                <>
                  <label className="text-sm font-medium">教練：</label>
                  <Select value={coachFilter} onValueChange={setCoachFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部教練</SelectItem>
                      {coachList.map((coach: string) => (
                        <SelectItem key={coach} value={coach}>{coach}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <label className="text-sm font-medium">年份：</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* 圖例 */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>已繳</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>未繳</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span>未到期</span>
            </div>
            <div className="flex items-center gap-1 border-l pl-3">
              <Upload className="w-3 h-3 text-blue-500" />
              <span>家長上傳</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span>管理員/教練</span>
            </div>
            <div className="flex items-center gap-1 border-l pl-3">
              <Check className="w-3 h-3 text-green-600" />
              <span>月繳(單月)</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-blue-500" />
              <span>季繳(3個月)</span>
            </div>
            <div className="flex items-center gap-1 border-l pl-3">
              <Undo2 className="w-3 h-3 text-orange-600" />
              <span>撤銷（轉未繳）</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-1 sm:p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 text-[10px] sticky left-0 bg-white z-10">#</TableHead>
                  <TableHead className="text-[10px] sm:text-xs sticky left-8 bg-white z-10 min-w-[60px]">姓名</TableHead>
                  {MONTH_LABELS.map((label, i) => (
                    <TableHead key={i} className={`text-center px-1 min-w-[52px] ${QUARTER_COLORS[i]}`}>
                      <div className="text-[10px] font-medium">{label}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-[10px] min-w-[50px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatuses.map((student, index) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="text-muted-foreground text-[10px] sticky left-0 bg-white z-10">{index + 1}</TableCell>
                    <TableCell className="font-medium text-xs sticky left-8 bg-white z-10">
                      <div className="truncate max-w-[80px]">{student.studentName}</div>
                      <div className="text-[9px] text-gray-400 truncate">${student.feePerQuarter}/季</div>
                    </TableCell>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <TableCell key={month} className={`text-center p-0.5 ${QUARTER_COLORS[month - 1]}`}>
                        {getMonthStatusCell(
                          student.months[month] || { status: 'not_due' },
                          month,
                          student.studentName,
                          student.studentId,
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center p-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppNotify(student)}
                        disabled={sendingWhatsApp === student.studentId}
                        className="flex items-center gap-0.5 text-[10px] px-1.5 py-1 h-auto"
                        title={!student.phone ? '沒有電話號碼' : 'WhatsApp 提醒'}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">{sendingWhatsApp === student.studentId ? '...' : 'WA'}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 收據圖片查看對話框 */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {receiptInfo?.studentName} — {receiptInfo?.month} 繳費收據
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {receiptUrl ? (
              <img 
                src={receiptUrl} 
                alt="繳費收據" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg border"
              />
            ) : (
              <p className="text-gray-500 py-8">無法載入收據圖片</p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setReceiptDialogOpen(false)}>
              關閉
            </Button>
            {receiptUrl && (
              <Button size="sm" onClick={() => window.open(receiptUrl, '_blank')}>
                在新分頁開啟
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 確認繳費對話框 */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.paymentType === 'quarterly' ? '季度繳費確認' : '單月繳費確認'}
            </DialogTitle>
            <DialogDescription>
              確認 <strong>{confirmDialog?.studentName}</strong> 已繳 {selectedYear}年{confirmDialog?.label} 學費？
              <br />
              <span className="text-xs text-gray-500 mt-1 block">
                {confirmDialog?.paymentType === 'quarterly' 
                  ? `季繳：一次確認 ${confirmDialog?.label} 共3個月`
                  : `月繳：僅確認 ${confirmDialog?.label}`
                }
                ，此操作由管理員/教練批准，無需上傳收據。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>取消</Button>
            <Button
              className={confirmDialog?.paymentType === 'quarterly' ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
              disabled={confirmMonthlyPayment.isPending}
              onClick={() => {
                if (confirmDialog) {
                  confirmMonthlyPayment.mutate({
                    studentId: confirmDialog.studentId,
                    year: selectedYear,
                    months: confirmDialog.months,
                    paymentType: confirmDialog.paymentType,
                  });
                }
              }}
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              {confirmMonthlyPayment.isPending ? '處理中...' : (
                confirmDialog?.paymentType === 'quarterly' ? '確認季繳' : '確認月繳'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤銷繳費確認對話框 */}
      <Dialog open={!!revertDialog} onOpenChange={() => setRevertDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-700">
              ⚠️ 撤銷繳費確認
            </DialogTitle>
            <DialogDescription>
              確定要將 <strong>{revertDialog?.studentName}</strong> {selectedYear}年<strong>{revertDialog?.month}月</strong> 的繳費狀態改為「未繳」嗎？
              <br />
              <span className="text-xs text-red-500 mt-2 block font-medium">
                ⚠️ 注意：
                {revertDialog?.paymentType === 'quarterly' 
                  ? ' 此月份為季繳，撤銷後該季度（3個月）的繳費記錄都會被刪除。'
                  : ' 此操作會刪除該月的繳費記錄。'
                }
                此操作不可逆轉。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={revertPayment.isPending}
              onClick={() => {
                if (revertDialog) {
                  revertPayment.mutate({
                    studentId: revertDialog.studentId,
                    year: selectedYear,
                    month: revertDialog.month,
                  });
                }
              }}
            >
              <Undo2 className="w-4 h-4 mr-1" />
              {revertPayment.isPending ? '處理中...' : '確認撤銷（轉未繳）'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
