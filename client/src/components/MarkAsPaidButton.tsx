import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface MarkAsPaidButtonProps {
  studentId: number;
  studentName: string;
  year: number;
  month: number;
  amount: string;
  onSuccess?: () => void;
}

export function MarkAsPaidButton({
  studentId,
  studentName,
  year,
  month,
  amount,
  onSuccess,
}: MarkAsPaidButtonProps) {
  const [isMarking, setIsMarking] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [bank, setBank] = useState<string>("");
  const [receivingBank, setReceivingBank] = useState<string>("");
  
  const markAsPaid = trpc.payments.markAsPaid.useMutation({
    onSuccess: () => {
      alert(`成功！已標記 ${studentName} 的 ${year}年${month}月 學費為已繳付`);
      setIsMarking(false);
      setShowDialog(false);
      setBank("");
      setReceivingBank("");
      onSuccess?.();
    },
    onError: (error) => {
      alert(`失敗！${error.message}`);
      setIsMarking(false);
    },
  });

  const handleConfirm = () => {
    setIsMarking(true);
    markAsPaid.mutate({
      studentId,
      year,
      month,
      amount,
      bank: bank || undefined,
      receivingBank: receivingBank || undefined,
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowDialog(true)}
        disabled={isMarking}
        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
      >
        {isMarking ? "處理中..." : "標記已繳"}
      </Button>

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setBank(""); setReceivingBank(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>標記已繳</DialogTitle>
            <DialogDescription>
              確認 <strong>{studentName}</strong> 的 {year}年{month}月 學費 ${amount} 為已繳付
            </DialogDescription>
          </DialogHeader>
          {/* 付款銀行 */}
          <div>
            <Label className="text-sm font-medium">付款銀行</Label>
            <Select value={bank} onValueChange={(v) => { setBank(v); if (v === 'FPS轉數快' && !receivingBank) setReceivingBank('中銀香港 (BOC)'); }}>
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
          </div>
          {/* 收款銀行（對帳用） */}
          <div>
            <Label className="text-sm font-medium">收款銀行（入數到哪間公司帳戶）*</Label>
            <Select value={receivingBank} onValueChange={setReceivingBank}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setBank(""); setReceivingBank(""); }}>取消</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isMarking}
              onClick={handleConfirm}
            >
              {isMarking ? "處理中..." : "確認標記已繳"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
