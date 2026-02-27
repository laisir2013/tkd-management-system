import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Eye, Trash2, Check, X, Lock, RefreshCw, BookOpen } from "lucide-react";
import { toast } from "sonner";

function formatMoney(amount: string | number | null) {
  if (amount === null || amount === undefined) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (n === 0) return "-";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function JournalEntries() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // Create form state
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLines, setFormLines] = useState<Array<{ accountCode: string; debit: string; credit: string; description: string }>>([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);

  const yearOptions = Array.from({ length: 3 }, (_, i) => 2025 + i);

  // Queries
  const { data: entriesData, refetch, isLoading } = trpc.accounting.getJournalEntries.useQuery({
    fiscalYear: selectedYear,
    fiscalMonth: selectedMonth,
    page,
    pageSize: 50,
  });

  const { data: accounts } = trpc.accounting.getChartOfAccounts.useQuery();

  const { data: detail } = trpc.accounting.getJournalEntryDetail.useQuery(
    { id: detailId! },
    { enabled: !!detailId }
  );

  // Mutations
  const createMutation = trpc.accounting.createJournalEntry.useMutation({
    onSuccess: () => {
      toast.success("分錄已建立");
      refetch();
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (e) => toast.error(`建立失敗: ${e.message}`),
  });

  const postMutation = trpc.accounting.postEntry.useMutation({
    onSuccess: () => {
      toast.success("已過帳");
      refetch();
      if (detailId) {
        // Refetch detail
      }
    },
    onError: (e) => toast.error(`過帳失敗: ${e.message}`),
  });

  const unpostMutation = trpc.accounting.unpostEntry.useMutation({
    onSuccess: () => {
      toast.success("已取消過帳");
      refetch();
    },
    onError: (e) => toast.error(`取消過帳失敗: ${e.message}`),
  });

  const deleteMutation = trpc.accounting.deleteEntry.useMutation({
    onSuccess: () => {
      toast.success("分錄已刪除");
      refetch();
      setShowDetailDialog(false);
      setDetailId(null);
    },
    onError: (e) => toast.error(`刪除失敗: ${e.message}`),
  });

  const syncMutation = trpc.accounting.syncPendingToJournal.useMutation({
    onSuccess: (result) => {
      toast.success(`同步完成：${result.success} 筆成功，${result.failed} 筆失敗`);
      refetch();
    },
    onError: (e) => toast.error(`同步失敗: ${e.message}`),
  });

  const lockMutation = trpc.accounting.lockPeriod.useMutation({
    onSuccess: (result) => {
      toast.success(`已鎖定 ${result.lockedCount} 筆分錄`);
      refetch();
    },
    onError: (e) => toast.error(`鎖定失敗: ${e.message}`),
  });

  function resetForm() {
    setFormDate(now.toISOString().slice(0, 10));
    setFormDescription("");
    setFormNotes("");
    setFormLines([
      { accountCode: "", debit: "", credit: "", description: "" },
      { accountCode: "", debit: "", credit: "", description: "" },
    ]);
  }

  function addLine() {
    setFormLines([...formLines, { accountCode: "", debit: "", credit: "", description: "" }]);
  }

  function removeLine(idx: number) {
    if (formLines.length <= 2) return;
    setFormLines(formLines.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: string, value: string) {
    const updated = [...formLines];
    (updated[idx] as any)[field] = value;
    // Auto-clear the other side
    if (field === 'debit' && value && parseFloat(value) > 0) {
      updated[idx].credit = "";
    } else if (field === 'credit' && value && parseFloat(value) > 0) {
      updated[idx].debit = "";
    }
    setFormLines(updated);
  }

  function handleCreate() {
    const validLines = formLines.filter(l => l.accountCode && (parseFloat(l.debit || "0") > 0 || parseFloat(l.credit || "0") > 0));
    if (validLines.length < 2) {
      toast.error("至少需要 2 行有效分錄");
      return;
    }
    createMutation.mutate({
      entryDate: formDate,
      description: formDescription,
      notes: formNotes || undefined,
      lines: validLines.map(l => ({
        accountCode: l.accountCode,
        debit: l.debit || "0.00",
        credit: l.credit || "0.00",
        description: l.description || undefined,
      })),
    });
  }

  const totalDebit = formLines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
  const totalCredit = formLines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const sourceTypeLabels: Record<string, string> = {
    auto_sync: "自動同步",
    manual: "手動",
    adjustment: "調整",
    reversal: "沖銷",
    deferred_split: "遞延分攤",
  };

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedMonth !== undefined ? String(selectedMonth) : "all"} onValueChange={(v) => { setSelectedMonth(v === "all" ? undefined : Number(v)); setPage(1); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部月份</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />手動新增
        </Button>

        <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          同步流水帳
        </Button>

        {selectedMonth && (
          <Button size="sm" variant="destructive" onClick={() => {
            if (confirm(`確定鎖定 ${selectedYear}年${selectedMonth}月？鎖定後不可修改。`)) {
              lockMutation.mutate({ fiscalYear: selectedYear, fiscalMonth: selectedMonth });
            }
          }} disabled={lockMutation.isPending}>
            <Lock className="w-4 h-4 mr-1" />鎖定期間
          </Button>
        )}
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            日記帳 Journal Entries
            {entriesData && <Badge variant="secondary">{entriesData.total} 筆</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">編號</TableHead>
                    <TableHead className="w-[100px]">日期</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="w-[80px]">來源</TableHead>
                    <TableHead className="w-[80px]">狀態</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesData?.entries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">{entry.entryNumber}</TableCell>
                      <TableCell className="text-sm">{entry.entryDate}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sourceTypeLabels[entry.sourceType] || entry.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.isLocked ? (
                          <Badge variant="destructive" className="text-xs"><Lock className="w-3 h-3 mr-1" />已鎖定</Badge>
                        ) : entry.isPosted ? (
                          <Badge className="text-xs bg-green-600"><Check className="w-3 h-3 mr-1" />已過帳</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">草稿</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setDetailId(entry.id); setShowDetailDialog(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!entry.isPosted && !entry.isLocked && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                              onClick={() => postMutation.mutate({ id: entry.id })}>
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!entriesData?.entries || entriesData.entries.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暫無日記帳記錄
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {entriesData && entriesData.total > 50 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="text-sm self-center">第 {page} / {Math.ceil(entriesData.total / 50)} 頁</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(entriesData.total / 50)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>手動新增分錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>日期</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div>
                <Label>說明</Label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="例: 場地租金 - 1月" />
              </div>
            </div>

            <div>
              <Label>備註（選填）</Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>

            <div>
              <Label className="mb-2 block">分錄明細</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目</TableHead>
                    <TableHead className="w-[120px]">借方 Dr</TableHead>
                    <TableHead className="w-[120px]">貸方 Cr</TableHead>
                    <TableHead className="w-[150px]">說明</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="p-1">
                        <Select value={line.accountCode} onValueChange={(v) => updateLine(idx, 'accountCode', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="選擇科目" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts?.map((a: any) => (
                              <SelectItem key={a.code} value={a.code}>
                                {a.code} {a.nameZh}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input className="h-8 text-right" type="number" step="0.01" min="0"
                          value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)}
                          placeholder="0.00" />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input className="h-8 text-right" type="number" step="0.01" min="0"
                          value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)}
                          placeholder="0.00" />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input className="h-8 text-xs" value={line.description}
                          onChange={e => updateLine(idx, 'description', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-1">
                        {formLines.length > 2 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(idx)}>
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-bold text-right">合計</TableCell>
                    <TableCell className="text-right font-bold">{formatMoney(totalDebit)}</TableCell>
                    <TableCell className="text-right font-bold">{formatMoney(totalCredit)}</TableCell>
                    <TableCell colSpan={2}>
                      {isBalanced ? (
                        <Badge className="bg-green-600 text-xs">平衡</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">不平衡 ({formatMoney(Math.abs(totalDebit - totalCredit))})</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2" onClick={addLine}>
                <Plus className="w-3 h-3 mr-1" />新增行
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!isBalanced || !formDescription || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              建立分錄
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>分錄明細 - {detail?.entry.entryNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">日期：</span>{detail.entry.entryDate}</div>
                <div><span className="text-muted-foreground">來源：</span>{sourceTypeLabels[detail.entry.sourceType] || detail.entry.sourceType}</div>
                <div className="col-span-2"><span className="text-muted-foreground">說明：</span>{detail.entry.description}</div>
                {detail.entry.notes && (
                  <div className="col-span-2"><span className="text-muted-foreground">備註：</span>{detail.entry.notes}</div>
                )}
                <div>
                  <span className="text-muted-foreground">狀態：</span>
                  {detail.entry.isLocked ? "已鎖定" : detail.entry.isPosted ? "已過帳" : "草稿"}
                </div>
                {detail.entry.postedBy && (
                  <div><span className="text-muted-foreground">過帳者：</span>{detail.entry.postedBy}</div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead className="text-right">借方 Dr</TableHead>
                    <TableHead className="text-right">貸方 Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">{line.accountCode}</TableCell>
                      <TableCell>{line.accountNameZh || line.accountName || '-'}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.debit)}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex gap-2 justify-end">
                {!detail.entry.isLocked && !detail.entry.isPosted && (
                  <>
                    <Button size="sm" className="bg-green-600" onClick={() => postMutation.mutate({ id: detail.entry.id })}>
                      <Check className="w-4 h-4 mr-1" />過帳
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("確定刪除此分錄？")) deleteMutation.mutate({ id: detail.entry.id });
                    }}>
                      <Trash2 className="w-4 h-4 mr-1" />刪除
                    </Button>
                  </>
                )}
                {detail.entry.isPosted && !detail.entry.isLocked && (
                  <Button size="sm" variant="outline" onClick={() => unpostMutation.mutate({ id: detail.entry.id })}>
                    <X className="w-4 h-4 mr-1" />取消過帳
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
