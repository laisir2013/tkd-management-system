import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Image, Upload, ShieldCheck, Check, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export function QuarterlyPaymentRecords({ coachName, showConfirmButton }: { coachName?: string; showConfirmButton?: boolean } = {}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [coachFilter, setCoachFilter] = useState<string>(coachName || "all");
  const { data: statuses, isLoading, refetch } = trpc.payments.getQuarterlyStatuses.useQuery({ year: selectedYear });
  
  // 生成年份選項（從 2026 到當前年份 + 1）
  const yearOptions = [];
  for (let year = 2026; year <= currentYear + 1; year++) {
    yearOptions.push(year);
  }
  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [receiptInfo, setReceiptInfo] = useState<{ studentName: string; quarter: string } | null>(null);

  // Confirm payment dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ studentId: number; studentName: string; quarter: string; quarterLabel: string } | null>(null);
  const confirmPayment = trpc.payments.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success('已確認繳費');
      refetch();
      setConfirmDialog(null);
    },
    onError: (err: any) => {
      toast.error(`確認失敗: ${err.message}`);
    },
  });

  // 教練列表（從資料中取得）— 必須在所有 early return 之前
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
      alert(`無法發送 WhatsApp：${student.studentName} 沒有電話號碼記錄。請先在學生名單中新增電話號碼。`);
      return;
    }

    setSendingWhatsApp(student.studentId);

    const unpaidQuarters: string[] = [];
    if (student.Q1 === 'unpaid') unpaidQuarters.push('1-3月');
    if (student.Q2 === 'unpaid') unpaidQuarters.push('4-6月');
    if (student.Q3 === 'unpaid') unpaidQuarters.push('7-9月');
    if (student.Q4 === 'unpaid') unpaidQuarters.push('10-12月');

    const defaultQuarter = unpaidQuarters[0] || '1-3月';
    
    const fee = Number(student.feePerQuarter || 0).toFixed(2);
    const message = `🥋 *${student.studentName}* 家長您好！\n\n📌 *${selectedYear}年 ${defaultQuarter} 學費通知*\n應繳學費：*$${fee}*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=852${student.phone}&text=${encodeURIComponent(message)}`;
    
    const newWindow = window.open(whatsappUrl, "_blank");
    if (!newWindow) {
      alert('無法開啟 WhatsApp，請確認瀏覽器允許彈出視窗。');
    }

    setTimeout(() => setSendingWhatsApp(null), 1000);
  };

  const handleViewReceipt = (url: string, studentName: string, quarter: string) => {
    setReceiptUrl(url);
    setReceiptInfo({ studentName, quarter });
    setReceiptDialogOpen(true);
  };

  const getConfirmedByLabel = (confirmedBy: string | null | undefined) => {
    if (confirmedBy === 'parent_upload') return '家長上傳';
    if (confirmedBy === 'admin_approved') return '管理員批准';
    if (confirmedBy === 'coach_approved') return '教練確認';
    return '';
  };

  const getStatusBadge = (
    status: 'paid' | 'unpaid' | 'not_due', 
    paymentDate?: string | null,
    confirmedBy?: string | null,
    receiptUrlVal?: string | null,
    studentName?: string,
    quarterLabel?: string,
    studentId?: number,
    quarter?: string,
  ) => {
    if (status === 'paid') {
      return (
        <div className="text-center space-y-1">
          <div className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-green-100 text-green-700 border border-green-300">
            已繳
          </div>
          {paymentDate && (
            <div className="text-xs text-gray-500">{paymentDate}</div>
          )}
          {confirmedBy && (
            <div className="flex items-center justify-center gap-1 text-xs">
              {confirmedBy === 'parent_upload' ? (
                <Upload className="w-3 h-3 text-blue-500" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-green-600" />
              )}
              <span className={confirmedBy === 'parent_upload' ? 'text-blue-600' : 'text-green-600'}>
                {getConfirmedByLabel(confirmedBy)}
              </span>
            </div>
          )}
          {receiptUrlVal && (
            <button 
              onClick={() => handleViewReceipt(receiptUrlVal, studentName || '', quarterLabel || '')}
              className="flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer mx-auto"
            >
              <Image className="w-3 h-3" />
              查看收據
            </button>
          )}
        </div>
      );
    } else if (status === 'unpaid') {
      return (
        <div className="text-center space-y-1">
          <div className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-red-100 text-red-700 border border-red-300">
            未繳
          </div>
          {studentId && quarter && (
            <button
              onClick={() => setConfirmDialog({
                studentId,
                studentName: studentName || '',
                quarter,
                quarterLabel: quarterLabel || '',
              })}
              className="mt-1 mx-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <Check className="w-3 h-3" />
              確認已繳
            </button>
          )}
        </div>
      );
    } else {
      return (
        <div className="text-center space-y-1">
          <div className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-gray-100 text-gray-500 border border-gray-300">
            未到期
          </div>
          {studentId && quarter && (
            <button
              onClick={() => setConfirmDialog({
                studentId,
                studentName: studentName || '',
                quarter,
                quarterLabel: quarterLabel || '',
              })}
              className="mt-1 mx-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <Check className="w-3 h-3" />
              預繳確認
            </button>
          )}
        </div>
      );
    }
  };

  const quarterLabels = ['1-3月', '4-6月', '7-9月', '10-12月'];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">繳費紀錄（季度顯示）</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {coachName ? '我的學生' : '所有學生'}的季度繳費狀態
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
              <Upload className="w-3 h-3 text-blue-500" />
              <span>家長上傳</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span>管理員/教練</span>
            </div>
            <div className="flex items-center gap-1">
              <Image className="w-3 h-3 text-indigo-600" />
              <span>查看收據</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs sm:text-sm">姓名</TableHead>
                  {quarterLabels.map((label, i) => (
                    <TableHead key={i} className="text-center">
                      <div className="font-semibold text-xs">{selectedYear}</div>
                      <div className="text-xs font-normal">{label}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-xs sm:text-sm">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatuses.map((student, index) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {student.studentName}
                      {(student as any).feePerQuarter && (
                        <div className="text-[10px] text-gray-400">${(student as any).feePerQuarter}/季</div>
                      )}
                    </TableCell>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q, i) => (
                      <TableCell key={q} className="text-center">
                        {getStatusBadge(
                          student[q],
                          student[`${q}PaymentDate`],
                          (student as any)[`${q}ConfirmedBy`],
                          (student as any)[`${q}ReceiptUrl`],
                          student.studentName,
                          quarterLabels[i],
                          student.studentId,
                          q,
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppNotify(student)}
                        disabled={sendingWhatsApp === student.studentId}
                        className="flex items-center gap-1 text-xs"
                        title={!student.phone ? '該學生沒有電話號碼' : '發送 WhatsApp 繳費提醒'}
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{sendingWhatsApp === student.studentId ? '發送中' : 'WhatsApp'}</span>
                        <span className="sm:hidden">{sendingWhatsApp === student.studentId ? '...' : '提醒'}</span>
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
              {receiptInfo?.studentName} — {receiptInfo?.quarter} 繳費收據
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
            <DialogTitle>確認繳費</DialogTitle>
            <DialogDescription>
              確認 <strong>{confirmDialog?.studentName}</strong> 已繳 {selectedYear}年{confirmDialog?.quarterLabel} 學費？
              <br />
              <span className="text-xs text-gray-500 mt-1 block">此操作由管理員/教練批准，無需上傳收據。</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={confirmPayment.isPending}
              onClick={() => {
                if (confirmDialog) {
                  confirmPayment.mutate({
                    studentId: confirmDialog.studentId,
                    year: selectedYear,
                    quarter: confirmDialog.quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4',
                  });
                }
              }}
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              {confirmPayment.isPending ? '處理中...' : '確認已繳'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
