import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { DollarSign, Loader2, RefreshCw, CreditCard, CheckCircle2, AlertCircle, FileText, Banknote, Edit2, Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending: { label: '待發放', variant: 'outline' },
  paid: { label: '已出糧', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

export default function PayrollManagement() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentBank, setPaymentBank] = useState<string>('');
  const [showPayDialog, setShowPayDialog] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<{ id: number; coachName: string; bonus: string; deductions: string; notes: string } | null>(null);
  const [showAdhocDialog, setShowAdhocDialog] = useState(false);
  const [adhocCoach, setAdhocCoach] = useState('');
  const [adhocAmount, setAdhocAmount] = useState('');
  const [adhocDate, setAdhocDate] = useState(new Date().toISOString().split('T')[0]);
  const [adhocNotes, setAdhocNotes] = useState('');
  const [expandedArrears, setExpandedArrears] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: records, isLoading } = trpc.payroll.getAll.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: summary } = trpc.payroll.getSummary.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // 欠薪累積查詢
  const { data: arrearsData, isLoading: arrearsLoading } = trpc.payroll.getArrearsBalance.useQuery({
    upToYear: selectedYear,
    upToMonth: selectedMonth,
  });

  const adhocPaymentMutation = trpc.payroll.addAdhocPayment.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
      utils.payroll.getArrearsBalance.invalidate();
      setShowAdhocDialog(false);
      setAdhocCoach('');
      setAdhocAmount('');
      setAdhocNotes('');
      alert('不定期出糧記錄已新增');
    },
    onError: (err) => alert(`新增失敗：${err.message}`),
  });

  const generateMutation = trpc.payroll.generateMonth.useMutation({
    onSuccess: (data) => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
      alert(`已生成 ${data.generated} 筆薪資記錄`);
    },
    onError: (err) => alert(`生成失敗：${err.message}`),
  });

  const processPaymentMutation = trpc.payroll.processPayment.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
      setShowPayDialog(null);
      alert('出糧成功！已同步到會計帳');
    },
    onError: (err) => alert(`出糧失敗：${err.message}`),
  });

  const batchPaymentMutation = trpc.payroll.batchProcessPayment.useMutation({
    onSuccess: (data) => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
      alert(`批量出糧完成：成功 ${data.success} 筆，失敗 ${data.failed} 筆`);
    },
    onError: (err) => alert(`批量出糧失敗：${err.message}`),
  });

  const updateStatusMutation = trpc.payroll.updateStatus.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
    },
  });

  const deleteMutation = trpc.payroll.delete.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
    },
    onError: (err) => alert(`刪除失敗：${err.message}`),
  });

  const upsertMutation = trpc.payroll.upsert.useMutation({
    onSuccess: () => {
      utils.payroll.getAll.invalidate();
      utils.payroll.getSummary.invalidate();
      setEditingRecord(null);
    },
    onError: (err) => alert(`更新失敗：${err.message}`),
  });

  const yearOptions = [];
  for (let y = 2024; y <= currentYear + 1; y++) yearOptions.push(y);

  const handleGenerate = () => {
    if (confirm(`確定要生成 ${selectedYear}年${selectedMonth}月 所有教練的薪資草稿嗎？\n（會根據財務報表數據自動計算）`)) {
      generateMutation.mutate({ year: selectedYear, month: selectedMonth });
    }
  };

  const handleBatchPay = () => {
    if (!records) return;
    const pendingOrDraft = records.filter(r => r.status === 'draft' || r.status === 'pending');
    if (pendingOrDraft.length === 0) {
      alert('沒有待發放的薪資記錄');
      return;
    }
    if (!paymentDate) {
      alert('請選擇出糧日期');
      return;
    }
    if (confirm(`確定要一次性出糧 ${pendingOrDraft.length} 筆嗎？\n（金額 $${pendingOrDraft.reduce((sum, r) => sum + parseFloat(String(r.netAmount)), 0).toLocaleString()}）\n\n此操作將同步到會計帳及日記帳`)) {
      batchPaymentMutation.mutate({
        ids: pendingOrDraft.map(r => r.id),
        paymentDate,
        paymentBank: paymentBank || undefined,
      });
    }
  };

  const handleSinglePay = (id: number) => {
    if (!paymentDate) {
      alert('請選擇出糧日期');
      return;
    }
    processPaymentMutation.mutate({
      id,
      paymentDate,
      paymentBank: paymentBank || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 標題與操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-600" />
            教練出糧管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理每月教練薪資計算、發放及會計入帳
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((label, i) => (
                <SelectItem key={i+1} value={(i+1).toString()}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 匯總卡片 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-blue-600 font-medium">總記錄</p>
              <p className="text-xl font-bold text-blue-700">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-green-600 font-medium">已出糧</p>
              <p className="text-xl font-bold text-green-700">{summary.paid}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-amber-600 font-medium">待發放</p>
              <p className="text-xl font-bold text-amber-700">{summary.pending + summary.draft}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-emerald-600 font-medium">薪資總額</p>
              <p className="text-lg font-bold text-emerald-700">${summary.totalAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-teal-600 font-medium">已發金額</p>
              <p className="text-lg font-bold text-teal-700">${summary.paidAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 💰 欠薪累積餘額 */}
      <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              教練欠薪累積餘額
              <span className="text-xs text-muted-foreground font-normal">
                （截至 {selectedYear}年{selectedMonth}月）
              </span>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => setShowAdhocDialog(true)}
            >
              <Plus className="h-3 w-3" />
              新增出糧
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {arrearsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !arrearsData || arrearsData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">暫無數據</p>
          ) : (
            <div className="space-y-2">
              {arrearsData.map((coach) => (
                <div key={coach.coachName} className="border rounded-lg overflow-hidden">
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      coach.balance > 0 ? 'bg-red-50/50' : coach.balance < 0 ? 'bg-green-50/50' : 'bg-gray-50/50'
                    }`}
                    onClick={() => setExpandedArrears(expandedArrears === coach.coachName ? null : coach.coachName)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{coach.coachName}</span>
                      <span className="text-xs text-gray-500">({coach.paymentCount} 筆出糧記錄)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">累積應發</p>
                        <p className="text-sm font-medium">${coach.totalOwed.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">累積已付</p>
                        <p className="text-sm font-medium text-green-700">${coach.totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        {coach.balance > 0 ? (
                          <>
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 justify-end">
                              <TrendingDown className="h-3 w-3" /> 欠薪
                            </p>
                            <p className="text-sm font-bold text-red-700">${coach.balance.toLocaleString()}</p>
                          </>
                        ) : coach.balance < 0 ? (
                          <>
                            <p className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
                              <TrendingUp className="h-3 w-3" /> 溢付
                            </p>
                            <p className="text-sm font-bold text-green-700">${Math.abs(coach.balance).toLocaleString()}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-gray-500">結清</p>
                            <p className="text-sm font-bold text-gray-600">$0</p>
                          </>
                        )}
                      </div>
                      {expandedArrears === coach.coachName ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {/* 展開的出糧歷史 */}
                  {expandedArrears === coach.coachName && coach.recentPayments.length > 0 && (
                    <div className="border-t bg-white px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">最近出糧記錄：</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {coach.recentPayments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{p.date}</span>
                              {p.isAdhoc && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-300 text-orange-600">
                                  不定期
                                </Badge>
                              )}
                              {p.notes && <span className="text-gray-400 truncate max-w-[150px]">{p.notes}</span>}
                            </div>
                            <span className="font-medium text-emerald-700">${p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作區 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">出糧日期</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">轉帳銀行</label>
              <Select value={paymentBank || undefined} onValueChange={setPaymentBank}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="選擇銀行" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hsbc">匯豐銀行</SelectItem>
                  <SelectItem value="boc">中國銀行</SelectItem>
                  <SelectItem value="hang_seng">恒生銀行</SelectItem>
                  <SelectItem value="std_chartered">渣打銀行</SelectItem>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="fps">轉數快 FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              variant="outline"
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              生成薪資草稿
            </Button>
            <Button
              onClick={handleBatchPay}
              disabled={batchPaymentMutation.isPending || !records || records.filter(r => r.status !== 'paid' && r.status !== 'cancelled').length === 0}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <CreditCard className="h-4 w-4" />
              {batchPaymentMutation.isPending ? '處理中...' : '一鍵出糧'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 「生成薪資草稿」會根據財務報表自動計算各教練的薪資。確認無誤後點「一鍵出糧」即可批量發放並同步到會計帳。
          </p>
        </CardContent>
      </Card>

      {/* 薪資記錄表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {selectedYear}年{MONTH_LABELS[selectedMonth - 1]} 薪資記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!records || records.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>尚無薪資記錄</p>
              <p className="text-xs mt-1">點擊「生成薪資草稿」按鈕從財務報表自動計算</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">教練</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">恆常班收入</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">精英班收入</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">MPF (10%)</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">營運費 (5%)</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">獎金</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap font-bold">實發薪資</TableHead>
                    <TableHead className="text-xs text-center">狀態</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">出糧日期</TableHead>
                    <TableHead className="text-xs text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const statusInfo = STATUS_MAP[record.status] || STATUS_MAP.draft;
                    return (
                      <TableRow key={record.id} className={record.status === 'cancelled' ? 'opacity-50' : ''}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {record.coachName}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          ${parseFloat(String(record.regularIncome)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          ${parseFloat(String(record.eliteIncome)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-right text-red-600">
                          −${parseFloat(String(record.mpf)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-right text-red-600">
                          −${parseFloat(String(record.operatingFee)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-right text-green-600">
                          {parseFloat(String(record.bonus)) > 0 ? `+$${parseFloat(String(record.bonus)).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-right font-bold text-emerald-700">
                          ${parseFloat(String(record.netAmount)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusInfo.variant} className="text-[10px]">
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {record.paymentDate ? String(record.paymentDate).split('T')[0] : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {(record.status === 'draft' || record.status === 'pending') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                                  onClick={() => setEditingRecord({
                                    id: record.id,
                                    coachName: record.coachName,
                                    bonus: String(record.bonus || '0'),
                                    deductions: String(record.deductions || '0'),
                                    notes: record.notes || '',
                                  })}
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  調整
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                                  onClick={() => handleSinglePay(record.id)}
                                  disabled={processPaymentMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  出糧
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                  onClick={() => {
                                    if (confirm('確定取消此薪資記錄？')) {
                                      updateStatusMutation.mutate({ id: record.id, status: 'cancelled' });
                                    }
                                  }}
                                >
                                  取消
                                </Button>
                              </>
                            )}
                            {record.status === 'paid' && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                已入帳
                              </span>
                            )}
                            {record.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-gray-400 hover:text-red-500"
                                onClick={() => {
                                  if (confirm('確定刪除此草稿？')) {
                                    deleteMutation.mutate({ id: record.id });
                                  }
                                }}
                              >
                                刪除
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* 合計行 */}
                  <TableRow className="border-t-2 bg-gray-50 font-semibold">
                    <TableCell className="text-sm">合計</TableCell>
                    <TableCell className="text-sm text-right">
                      ${records.reduce((sum, r) => sum + parseFloat(String(r.regularIncome)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      ${records.reduce((sum, r) => sum + parseFloat(String(r.eliteIncome)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right text-red-600">
                      −${records.reduce((sum, r) => sum + parseFloat(String(r.mpf)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right text-red-600">
                      −${records.reduce((sum, r) => sum + parseFloat(String(r.operatingFee)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right text-green-600">
                      ${records.reduce((sum, r) => sum + parseFloat(String(r.bonus)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right font-bold text-emerald-700">
                      ${records.reduce((sum, r) => sum + parseFloat(String(r.netAmount)), 0).toLocaleString()}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 說明 */}
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-4 pb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 教練出糧流程說明</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• <strong>步驟 1</strong>：選擇年份和月份，點擊「生成薪資草稿」</li>
            <li>• <strong>步驟 2</strong>：系統自動從財務報表計算各教練的恆常班+精英班收入，扣除 MPF (10%) 和營運費 (5%)</li>
            <li>• <strong>步驟 3</strong>：確認金額無誤後，選擇出糧日期和銀行，點擊「一鍵出糧」</li>
            <li>• <strong>自動入帳</strong>：出糧後自動建立會計記錄（支出→教練薪資）並生成日記帳分錄（借：5003 薪金，貸：1001 銀行）</li>
            <li>• <strong>計算公式</strong>：教練實收 = (恆常班收入 + 精英班收入 + 獎金 − 扣款) × 85%</li>
            <li>• 如需調整個別教練的獎金或扣款，可在生成草稿後手動編輯</li>
          </ul>
        </CardContent>
      </Card>

      {/* 編輯獎金/扣款 Dialog */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingRecord(null)}>
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">調整薪資 — {editingRecord.coachName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">獎金/津貼 ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingRecord.bonus}
                  onChange={(e) => setEditingRecord({ ...editingRecord, bonus: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">扣款 ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingRecord.deductions}
                  onChange={(e) => setEditingRecord({ ...editingRecord, deductions: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">備註</label>
                <Input
                  value={editingRecord.notes}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  placeholder="例：本月額外教學津貼"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditingRecord(null)}>取消</Button>
                <Button
                  onClick={() => {
                    const record = records?.find(r => r.id === editingRecord.id);
                    if (!record) return;
                    const bonus = parseFloat(editingRecord.bonus) || 0;
                    const deductions = parseFloat(editingRecord.deductions) || 0;
                    const regularIncome = parseFloat(String(record.regularIncome)) || 0;
                    const eliteIncome = parseFloat(String(record.eliteIncome)) || 0;
                    const totalIncome = regularIncome + eliteIncome + bonus - deductions;
                    const mpf = Math.round(totalIncome * 0.10);
                    const operating = Math.round(totalIncome * 0.05);
                    const netAmount = totalIncome - mpf - operating;
                    
                    upsertMutation.mutate({
                      coachName: record.coachName,
                      year: selectedYear,
                      month: selectedMonth,
                      bonus: bonus.toFixed(2),
                      deductions: deductions.toFixed(2),
                      mpf: mpf.toFixed(2),
                      operatingFee: operating.toFixed(2),
                      netAmount: netAmount.toFixed(2),
                      notes: editingRecord.notes || null,
                    });
                  }}
                  disabled={upsertMutation.isPending}
                >
                  {upsertMutation.isPending ? '儲存中...' : '儲存並重新計算'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 不定期出糧 Dialog */}
      {showAdhocDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdhocDialog(false)}>
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-5 w-5 text-orange-600" />
                新增出糧記錄
              </CardTitle>
              <p className="text-xs text-muted-foreground">不定期出糧 — 直接記錄轉帳金額，用於扣減欠薪</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">教練</label>
                <Select value={adhocCoach || undefined} onValueChange={setAdhocCoach}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇教練" />
                  </SelectTrigger>
                  <SelectContent>
                    {arrearsData?.map(c => (
                      <SelectItem key={c.coachName} value={c.coachName}>
                        {c.coachName}
                        {c.balance > 0 && ` (欠 $${c.balance.toLocaleString()})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">出糧金額 ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={adhocAmount}
                  onChange={(e) => setAdhocAmount(e.target.value)}
                  placeholder="例如 30000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">出糧日期</label>
                <Input
                  type="date"
                  value={adhocDate}
                  onChange={(e) => setAdhocDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">備註</label>
                <Input
                  value={adhocNotes}
                  onChange={(e) => setAdhocNotes(e.target.value)}
                  placeholder="例：銀行轉帳"
                />
              </div>
              {adhocCoach && arrearsData && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <p className="text-xs text-orange-700">
                    {(() => {
                      const coach = arrearsData.find(c => c.coachName === adhocCoach);
                      if (!coach) return '';
                      const amount = parseFloat(adhocAmount) || 0;
                      const newBalance = coach.balance - amount;
                      return `當前欠薪 $${coach.balance.toLocaleString()} → 出糧後餘欠 $${Math.max(0, newBalance).toLocaleString()}${newBalance < 0 ? ` (溢付 $${Math.abs(newBalance).toLocaleString()})` : ''}`;
                    })()}
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowAdhocDialog(false)}>取消</Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    if (!adhocCoach || !adhocAmount || !adhocDate) {
                      alert('請填寫完整資料');
                      return;
                    }
                    adhocPaymentMutation.mutate({
                      coachName: adhocCoach,
                      amount: parseFloat(adhocAmount),
                      paymentDate: adhocDate,
                      notes: adhocNotes || undefined,
                    });
                  }}
                  disabled={adhocPaymentMutation.isPending}
                >
                  {adhocPaymentMutation.isPending ? '處理中...' : '確認出糧'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
