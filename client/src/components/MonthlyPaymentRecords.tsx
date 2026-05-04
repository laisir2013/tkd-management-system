import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Image, Upload, ShieldCheck, Check, Calendar, CreditCard, Undo2, AlertTriangle, Search, Plus, X, Building2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
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

export function MonthlyPaymentRecords({ coachName, readOnly = false }: { coachName?: string; readOnly?: boolean } = {}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [coachFilter, setCoachFilter] = useState<string>(coachName || "all");
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: statuses, isLoading, refetch } = trpc.payments.getMonthlyStatuses.useQuery({ year: selectedYear }, { refetchInterval: 15000 });
  
  const yearOptions = [];
  for (let year = 2025; year <= currentYear + 1; year++) {
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
  // 確認繳費時的收據上傳
  const [confirmReceiptFile, setConfirmReceiptFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  // 請假月份排除（僅教練/管理員確認季繳時使用）
  const [confirmExcludedMonths, setConfirmExcludedMonths] = useState<number[]>([]);
  // 付款銀行（教練/管理員確認時選擇）
  const [confirmBank, setConfirmBank] = useState<string>("");
  // 收款銀行（入數到哪間銀行，用於銀行月結單對帳）
  const [confirmReceivingBank, setConfirmReceivingBank] = useState<string>("");

  // Approve payment dialog state (待審核→批准)
  const [approveDialog, setApproveDialog] = useState<{
    paymentRecordId: number;
    studentName: string;
    month: number;
    amount: string | null;
    receiptUrl: string | null;
  } | null>(null);
  const [approvePassword, setApprovePassword] = useState("");
  const [approveStep, setApproveStep] = useState<1 | 2>(1);

  // Revert payment dialog state (已繳→未繳)
  const [revertDialog, setRevertDialog] = useState<{
    studentId: number;
    studentName: string;
    month: number;
    paymentType: string;
  } | null>(null);
  const [revertPassword, setRevertPassword] = useState("");

  // 修改銀行 dialog state
  const [editBankDialog, setEditBankDialog] = useState<{
    paymentRecordId: number;
    studentName: string;
    month: number;
    currentBank: string;
    currentReceivingBank: string;
  } | null>(null);
  const [editBank, setEditBank] = useState("");
  const [editReceivingBank, setEditReceivingBank] = useState("");

  const confirmMonthlyPayment = trpc.payments.confirmMonthlyPayment.useMutation({
    onSuccess: () => {
      toast.success('已確認繳費');
      refetch();
      setConfirmDialog(null);
      setConfirmReceiptFile(null);
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
      setRevertPassword("");
    },
    onError: (err: any) => {
      toast.error(`撤銷失敗: ${err.message}`);
    },
  });

  const updatePaymentBank = trpc.payments.updatePaymentBank.useMutation({
    onSuccess: () => {
      toast.success('已更新銀行資訊');
      refetch();
      setEditBankDialog(null);
    },
    onError: (err: any) => {
      toast.error(`更新失敗: ${err.message}`);
    },
  });

  const approvePendingPayment = trpc.payments.approvePendingPayment.useMutation({
    onSuccess: () => {
      toast.success('已批准繳費');
      refetch();
      setApproveDialog(null);
      setApprovePassword("");
    },
    onError: (err: any) => {
      toast.error(`批准失敗: ${err.message}`);
    },
  });

  // 教練列表
  const coachList = useMemo(() => {
    if (!statuses) return [];
    const coaches = [...new Set(statuses.map((s: any) => s.coach).filter(Boolean))];
    return coaches.sort();
  }, [statuses]);

  // 計算待審核數
  const pendingCount = useMemo(() => {
    if (!statuses) return 0;
    let count = 0;
    statuses.forEach((s: any) => {
      for (let m = 1; m <= 12; m++) {
        if (s.months[m]?.status === 'pending') count++;
      }
    });
    return count;
  }, [statuses]);

  // 篩選後的學生
  const filteredStatuses = useMemo(() => {
    if (!statuses) return [];
    let result = statuses;
    if (coachFilter !== 'all') {
      result = result.filter((s: any) => s.coach === coachFilter);
    }
    if (showPendingOnly) {
      result = result.filter((s: any) => {
        for (let m = 1; m <= 12; m++) {
          if (s.months[m]?.status === 'pending') return true;
        }
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s: any) =>
        s.studentName?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    }
    return result;
  }, [statuses, coachFilter, showPendingOnly, searchQuery]);

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

    // 以季度為單位收集未繳季度
    const unpaidQuarterLabels: string[] = [];
    const quarterDefs = [
      { months: [1, 2, 3], label: '1-3月' },
      { months: [4, 5, 6], label: '4-6月' },
      { months: [7, 8, 9], label: '7-9月' },
      { months: [10, 11, 12], label: '10-12月' },
    ];
    for (const q of quarterDefs) {
      // 季度中任何一個月未繳，整季視為未繳
      const hasUnpaid = q.months.some(m => student.months[m]?.status === 'unpaid');
      if (hasUnpaid) {
        unpaidQuarterLabels.push(q.label);
      }
    }

    // 預設取第一個未繳季度發送通知（一次通知一季）
    const notifyQuarter = unpaidQuarterLabels[0] || '1-3月';
    const fee = Number(student.feePerQuarter || 0).toFixed(2);
    const message = `🥋 *${student.studentName}* 家長您好！\n\n📌 *${selectedYear}年 ${notifyQuarter} 學費通知*\n應繳學費：*$${fee}*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;

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

  // WhatsApp 通知家長已收到學費
  const handlePaidWhatsApp = (studentId: number, studentName: string, month: number, paymentType: string) => {
    const student = filteredStatuses.find((s: any) => s.studentId === studentId);
    if (!student) return;
    if (!student.phone || student.phone.trim() === '') {
      alert(`無法發送 WhatsApp：${studentName} 沒有電話號碼記錄。`);
      return;
    }

    // 計算繳費涵蓋月份
    let paidMonths: string;
    if (paymentType === 'quarterly') {
      const { months } = getQuarterForMonth(month);
      paidMonths = `${selectedYear}年${months[0]}-${months[2]}月`;
    } else {
      paidMonths = `${selectedYear}年${month}月`;
    }

    const fee = Number(student.feePerQuarter || 0);
    const amount = paymentType === 'quarterly' ? fee : Math.round(fee / 3);

    const message = `🥋 ${studentName} 家長您好！

📌 *【學費確認通知】*

我們已收到 *${studentName}* ${paidMonths} 的學費 *$${amount.toLocaleString()}*，感謝您的繳費！

如有任何疑問，歡迎隨時聯絡我們 🙏`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${student.phone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const getMonthStatusCell = (
    monthData: { status: string; paymentDate?: string | null; confirmedBy?: string | null; receiptUrl?: string | null; paymentType?: string | null; paymentRecordId?: number | null; amount?: string | null; bank?: string | null; receivingBank?: string | null },
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
          {/* WhatsApp 通知已收學費 + 撤銷繳費（僅管理員可見） */}
          {!readOnly && (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => handlePaidWhatsApp(studentId, studentName, month, monthData.paymentType || 'monthly')}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                title="WhatsApp 通知家長已收到學費"
              >
                <WhatsAppIcon className="w-2.5 h-2.5" />
                已收
              </button>
              <button
                onClick={() => setRevertDialog({
                  studentId,
                  studentName,
                  month,
                  paymentType: monthData.paymentType || 'monthly',
                })}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors border border-orange-300"
                title="撤銷繳費（轉為未繳）"
              >
                <Undo2 className="w-2.5 h-2.5" />
                轉未繳
              </button>
              {monthData.paymentRecordId && (
                <button
                  onClick={() => {
                    setEditBankDialog({
                      paymentRecordId: monthData.paymentRecordId!,
                      studentName,
                      month,
                      currentBank: monthData.bank || '',
                      currentReceivingBank: monthData.receivingBank || '',
                    });
                    setEditBank(monthData.bank || '');
                    setEditReceivingBank(monthData.receivingBank || '');
                  }}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors border border-blue-300"
                  title="修改付款/收款銀行"
                >
                  <Building2 className="w-2.5 h-2.5" />
                  銀行
                </button>
              )}
            </div>
          )}
        </div>
      );
    } else if (monthData.status === 'pending') {
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-400 animate-pulse">
            待審核
          </div>
          {monthData.amount && parseFloat(monthData.amount) > 0 && (
            <div className="text-[9px] text-yellow-700 font-medium">${monthData.amount}</div>
          )}
          {!readOnly && monthData.paymentRecordId && (
            <button
              onClick={() => {
                setApproveDialog({
                  paymentRecordId: monthData.paymentRecordId!,
                  studentName,
                  month,
                  amount: monthData.amount || null,
                  receiptUrl: monthData.receiptUrl || null,
                });
                setApproveStep(1);
                setApprovePassword("");
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors mx-auto"
              title="審核此筆繳費"
            >
              <Check className="w-2.5 h-2.5" />
              審核
            </button>
          )}
        </div>
      );
    } else if (monthData.status === 'unpaid') {
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">
            未繳
          </div>
          {/* 確認繳費按鈕（僅管理員可見） */}
          {!readOnly && (
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
          )}
        </div>
      );
    } else {
      // not_due
      return (
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-300">
            未到期
          </div>
          {/* 預繳按鈕（僅管理員可見） */}
          {!readOnly && (
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
          )}
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
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="搜尋姓名或電話..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-44 h-9 text-sm"
                />
              </div>
            </div>
          </div>
          {/* 待審核提示 */}
          {!readOnly && pendingCount > 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-300">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm font-medium text-yellow-800">
                有 {pendingCount} 筆待審核繳費記錄（家長已上傳收據）
              </span>
              <Button
                variant={showPendingOnly ? 'default' : 'outline'}
                size="sm"
                className={`ml-auto text-xs h-7 ${showPendingOnly ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-100'}`}
                onClick={() => setShowPendingOnly(!showPendingOnly)}
              >
                {showPendingOnly ? '顯示全部' : '只看待審核'}
              </Button>
            </div>
          )}
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
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
              <span>待審核</span>
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
                        <WhatsAppIcon className="w-4 h-4" />
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
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) { setConfirmDialog(null); setConfirmReceiptFile(null); setConfirmExcludedMonths([]); setConfirmBank(""); setConfirmReceivingBank(""); } }}>
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
              </span>
            </DialogDescription>
          </DialogHeader>
          {/* 請假月排除（僅季繳時顯示） */}
          {confirmDialog?.paymentType === 'quarterly' && confirmDialog.months.length > 1 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-medium text-orange-800 mb-2">如有請假月份，可取消勾選：</div>
              <div className="flex flex-wrap gap-2">
                {confirmDialog.months.map(month => {
                  const isExcluded = confirmExcludedMonths.includes(month);
                  return (
                    <div
                      key={month}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                        isExcluded
                          ? 'bg-red-50 border-red-300 text-red-600 line-through'
                          : 'bg-green-50 border-green-300 text-green-700'
                      }`}
                      onClick={() => {
                        setConfirmExcludedMonths(prev =>
                          prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
                        );
                      }}
                    >
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => {
                          setConfirmExcludedMonths(prev =>
                            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5"
                      />
                      <span className="text-sm font-medium">{month}月</span>
                    </div>
                  );
                })}
              </div>
              {confirmExcludedMonths.length > 0 && (
                <div className="mt-2 text-xs text-orange-700">
                  ℹ️ 已排除 {confirmExcludedMonths.sort((a,b)=>a-b).map(m => `${m}月`).join('、')}（請假免繳），實繳 {confirmDialog.months.length - confirmExcludedMonths.length} 個月
                </div>
              )}
            </div>
          )}
          {/* 付款銀行選擇 */}
          <div className="px-0">
            <Label className="text-sm font-medium">付款銀行 *</Label>
            <Select value={confirmBank} onValueChange={(v) => { setConfirmBank(v); if (v === 'FPS轉數快' && !confirmReceivingBank) setConfirmReceivingBank('中銀香港 (BOC)'); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="請選擇付款銀行" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FPS轉數快">FPS 轉數快</SelectItem>
                <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                <SelectItem value="恒生銀行">恒生銀行</SelectItem>
                <SelectItem value="渣打銀行 (SCB)">渣打銀行 (SCB)</SelectItem>
                <SelectItem value="現金">現金</SelectItem>
                <SelectItem value="其他銀行">其他銀行</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">選擇家長的付款方式</p>
          </div>
          {/* 收款銀行選擇（入數到哪間銀行，對帳用） */}
          <div className="px-0">
            <Label className="text-sm font-medium">收款銀行（入數到哪間公司帳戶）*</Label>
            <Select value={confirmReceivingBank} onValueChange={setConfirmReceivingBank}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="請選擇收款銀行" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                <SelectItem value="恒生銀行">恒生銀行</SelectItem>
                <SelectItem value="渣打銀行 (SCB)">渣打銀行 (SCB)</SelectItem>
                <SelectItem value="現金">現金（不經銀行）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">錢入了公司哪間銀行帳戶？用於銀行月結單對帳</p>
          </div>
          {/* 收據上傳（可選） */}
          <div className="px-0">
            <Label className="text-sm font-medium">上傳收據（可選）</Label>
            <div className="mt-1">
              {confirmReceiptFile ? (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-green-50">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 flex-1 truncate">{confirmReceiptFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setConfirmReceiptFile(null)}>
                    <X className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">點擊或拖曳上傳收據圖片</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error('檔案不能超過 10MB'); return; }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.split(',')[1];
                        setConfirmReceiptFile({ base64, mimeType: file.type, name: file.name });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">管理員/教練上傳收據直接確認，無需額外審批</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setConfirmReceiptFile(null); setConfirmBank(""); setConfirmReceivingBank(""); }}>取消</Button>
            <Button
              className={confirmDialog?.paymentType === 'quarterly' ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
              disabled={confirmMonthlyPayment.isPending}
              onClick={() => {
                if (confirmDialog) {
                  const actualMonths = confirmDialog.months.filter(m => !confirmExcludedMonths.includes(m));
                  if (actualMonths.length === 0) {
                    toast.error('至少需保留一個月份');
                    return;
                  }
                  confirmMonthlyPayment.mutate({
                    studentId: confirmDialog.studentId,
                    year: selectedYear,
                    months: actualMonths,
                    paymentType: confirmExcludedMonths.length > 0 ? 'monthly' : confirmDialog.paymentType,
                    bank: confirmBank || undefined,
                    receivingBank: confirmReceivingBank || undefined,
                    receiptBase64: confirmReceiptFile?.base64,
                    receiptMimeType: confirmReceiptFile?.mimeType,
                  });
                  setConfirmExcludedMonths([]);
                  setConfirmBank("");
                  setConfirmReceivingBank("");
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

      {/* 審核繳費對話框（Step 1: 查看收據 → Step 2: 密碼批准） */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => { if (!open) { setApproveDialog(null); setApprovePassword(""); setApproveStep(1); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                審核繳費 — {approveStep === 1 ? '查看收據' : '確認批准'}
              </div>
            </DialogTitle>
            <DialogDescription>
              <strong>{approveDialog?.studentName}</strong> {selectedYear}年<strong>{approveDialog?.month}月</strong>
              {approveDialog?.amount && parseFloat(approveDialog.amount) > 0 && <> · <strong>${approveDialog.amount}</strong></>}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: 查看收據 */}
          {approveStep === 1 && (
            <div className="space-y-3">
              {approveDialog?.receiptUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={approveDialog.receiptUrl.startsWith('http') || approveDialog.receiptUrl.startsWith('/') ? approveDialog.receiptUrl : `/api/receipts/${approveDialog.receiptUrl}`}
                    alt="收據"
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-700 border border-yellow-200 text-center">
                  <AlertTriangle className="w-5 h-5 inline mr-1.5" />
                  此筆繳費記錄沒有收據圖片
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setApproveDialog(null); setApproveStep(1); }}>取消</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setApproveStep(2)}
                >
                  <Check className="w-4 h-4 mr-1" />
                  確認收據正確，下一步
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: 輸入密碼批准 */}
          {approveStep === 2 && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800 border border-green-200">
                ✅ 已確認收據，請輸入管理員密碼以完成批准。
              </div>
              <div>
                <Label htmlFor="approve-password" className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  管理員密碼
                </Label>
                <Input
                  id="approve-password"
                  type="password"
                  placeholder="輸入您的登入密碼"
                  value={approvePassword}
                  onChange={(e) => setApprovePassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && approvePassword && approveDialog) {
                      approvePendingPayment.mutate({
                        paymentRecordId: approveDialog.paymentRecordId,
                        adminPassword: approvePassword,
                      });
                    }
                  }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveStep(1)}>返回查看收據</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={approvePendingPayment.isPending || !approvePassword}
                  onClick={() => {
                    if (approveDialog && approvePassword) {
                      approvePendingPayment.mutate({
                        paymentRecordId: approveDialog.paymentRecordId,
                        adminPassword: approvePassword,
                      });
                    }
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  {approvePendingPayment.isPending ? '處理中...' : '批准繳費'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 撤銷繳費確認對話框 */}
      <Dialog open={!!revertDialog} onOpenChange={(open) => { if (!open) { setRevertDialog(null); setRevertPassword(""); } }}>
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
          <div className="py-3">
            <Label htmlFor="revert-password" className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Lock className="w-4 h-4 text-orange-600" />
              請輸入管理員密碼以確認操作
            </Label>
            <Input
              id="revert-password"
              type="password"
              placeholder="輸入您的登入密碼"
              value={revertPassword}
              onChange={(e) => setRevertPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && revertPassword && revertDialog) {
                  revertPayment.mutate({
                    studentId: revertDialog.studentId,
                    year: selectedYear,
                    month: revertDialog.month,
                    adminPassword: revertPassword,
                  });
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={revertPayment.isPending || !revertPassword}
              onClick={() => {
                if (revertDialog && revertPassword) {
                  revertPayment.mutate({
                    studentId: revertDialog.studentId,
                    year: selectedYear,
                    month: revertDialog.month,
                    adminPassword: revertPassword,
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

      {/* 修改銀行對話框 */}
      <Dialog open={!!editBankDialog} onOpenChange={(open) => { if (!open) { setEditBankDialog(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>修改銀行資訊</DialogTitle>
            <DialogDescription>
              {editBankDialog?.studentName} — {selectedYear}年{editBankDialog?.month}月
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">付款銀行</Label>
              <Select value={editBank} onValueChange={(v) => { setEditBank(v); if (v === 'FPS轉數快' && !editReceivingBank) setEditReceivingBank('中銀香港 (BOC)'); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="請選擇付款銀行" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FPS轉數快">FPS 轉數快</SelectItem>
                  <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                  <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                  <SelectItem value="恒生銀行">恒生銀行</SelectItem>
                  <SelectItem value="渣打銀行 (SCB)">渣打銀行 (SCB)</SelectItem>
                  <SelectItem value="Mox Bank">Mox Bank</SelectItem>
                  <SelectItem value="ZA Bank">ZA Bank</SelectItem>
                  <SelectItem value="現金">現金</SelectItem>
                  <SelectItem value="其他銀行">其他銀行</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">收款銀行（入數到哪間公司帳戶）</Label>
              <Select value={editReceivingBank} onValueChange={setEditReceivingBank}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="請選擇收款銀行" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="中銀香港 (BOC)">中銀香港 (BOC)</SelectItem>
                  <SelectItem value="滙豐銀行 (HSBC)">滙豐銀行 (HSBC)</SelectItem>
                  <SelectItem value="恒生銀行">恒生銀行</SelectItem>
                  <SelectItem value="渣打銀行 (SCB)">渣打銀行 (SCB)</SelectItem>
                  <SelectItem value="現金">現金（不經銀行）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">錢入了公司哪間銀行帳戶？用於銀行月結單對帳</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBankDialog(null)}>取消</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={updatePaymentBank.isPending}
              onClick={() => {
                if (editBankDialog) {
                  updatePaymentBank.mutate({
                    paymentRecordId: editBankDialog.paymentRecordId,
                    bank: editBank || undefined,
                    receivingBank: editReceivingBank || undefined,
                  });
                }
              }}
            >
              <Building2 className="w-4 h-4 mr-1" />
              {updatePaymentBank.isPending ? '處理中...' : '確認修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
