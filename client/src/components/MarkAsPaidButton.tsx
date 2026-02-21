import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

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
  
  const markAsPaid = trpc.payments.markAsPaid.useMutation({
    onSuccess: () => {
      alert(`成功！已標記 ${studentName} 的 ${year}年${month}月 學費為已繳付`);
      setIsMarking(false);
      onSuccess?.();
    },
    onError: (error) => {
      alert(`失敗！${error.message}`);
      setIsMarking(false);
    },
  });

  const handleMarkAsPaid = () => {
    if (confirm(`確定要標記 ${studentName} 的 ${year}年${month}月 學費為已繳付嗎？`)) {
      setIsMarking(true);
      markAsPaid.mutate({
        studentId,
        year,
        month,
        amount,
      });
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleMarkAsPaid}
      disabled={isMarking}
      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
    >
      {isMarking ? "處理中..." : "標記已繳"}
    </Button>
  );
}
