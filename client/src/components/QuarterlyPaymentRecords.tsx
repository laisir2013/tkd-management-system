import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Image, Upload, ShieldCheck, X } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QuarterlyPaymentRecords() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const { data: statuses, isLoading } = trpc.payments.getQuarterlyStatuses.useQuery({ year: selectedYear });
  
  // 生成年份選項（從 2026 到當前年份 + 1）
  const yearOptions = [];
  for (let year = 2026; year <= currentYear + 1; year++) {
    yearOptions.push(year);
  }
  const [sendingWhatsApp, setSendingWhatsApp] = useState<number | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [receiptInfo, setReceiptInfo] = useState<{ studentName: string; quarter: string } | null>(null);

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
    
    const systemUrl = window.location.origin;
    const message = `🥋 ${student.studentName} 家長您好！\n\n📌 *${selectedYear}年${defaultQuarter}學費通知*\n\n───────────────\n💳 *繳費方式*\n\n銀行轉帳：\n• 銀行：中國銀行\n• 帳戶號碼：012-692-2-0114816\n• 帳戶名稱：Chong Mo Company Limited\n\n轉數快 (FPS)：\n• ID：164577132\n\n───────────────\n📱 *上傳收據步驟*\n\n1️⃣ 完成轉帳並截圖\n2️⃣ 登入系統：${systemUrl}\n3️⃣ 使用您的電話號碼登入\n   · 帳號：${student.phone}\n   · 密碼：${student.phone}\n   (登入後可自行修改密碼)\n4️⃣ 上傳收據截圖\n5️⃣ 完成！可隨時查閱繳費記錄\n\n───────────────\nℹ️ 如有任何疑問，歡迎隨時聯絡我們！\n\n✅ *已繳費者請忽略此訊息*\n謝謝您的配合！🙏`;

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
    return '';
  };

  const getStatusBadge = (
    status: 'paid' | 'unpaid' | 'not_due', 
    paymentDate?: string | null,
    confirmedBy?: string | null,
    receiptUrlVal?: string | null,
    studentName?: string,
    quarterLabel?: string,
  ) => {
    if (status === 'paid') {
      return (
        <div className="text-center space-y-1">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-300">
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
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-300">
          未繳
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-500 border border-gray-300">
          未到期
        </div>
      );
    }
  };

  const quarterLabels = ['1-3月', '4-6月', '7-9月', '10-12月'];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>繳費紀錄（季度顯示）</CardTitle>
              <CardDescription>查看所有學生的季度繳費狀態，含繳費來源和收據</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Upload className="w-3 h-3 text-blue-500" />
              <span>家長上傳收據</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span>管理員批准</span>
            </div>
            <div className="flex items-center gap-1">
              <Image className="w-3 h-3 text-indigo-600" />
              <span>可查看收據圖片</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">編號</TableHead>
                  <TableHead>學生姓名</TableHead>
                  {quarterLabels.map((label, i) => (
                    <TableHead key={i} className="text-center">
                      <div className="font-semibold">{selectedYear}年</div>
                      <div className="text-xs font-normal">{label}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatuses.map((student, index) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q, i) => (
                      <TableCell key={q} className="text-center">
                        {getStatusBadge(
                          student[q],
                          student[`${q}PaymentDate`],
                          (student as any)[`${q}ConfirmedBy`],
                          (student as any)[`${q}ReceiptUrl`],
                          student.studentName,
                          quarterLabels[i],
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppNotify(student)}
                        disabled={sendingWhatsApp === student.studentId}
                        className="flex items-center gap-2"
                        title={!student.phone ? '該學生沒有電話號碼' : '發送 WhatsApp 繳費提醒'}
                      >
                        <MessageCircle className="w-4 h-4" />
                        {sendingWhatsApp === student.studentId ? '發送中...' : 'WhatsApp'}
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
    </>
  );
}
