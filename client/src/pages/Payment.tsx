import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Loader2, CheckCircle2, KeyRound, History as HistoryIcon } from "lucide-react";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { EliteParentSection } from "@/components/EliteParentSection";
import { toast } from "sonner";

type PaymentPeriod = "Q1" | "Q2" | "Q3" | "Q4" | "CUSTOM";

const PERIOD_OPTIONS = [
  { value: "Q1", label: "1-3月" },
  { value: "Q2", label: "4-6月" },
  { value: "Q3", label: "7-9月" },
  { value: "Q4", label: "10-12月" },
  { value: "CUSTOM", label: "自選月份" },
] as const;

export default function Payment() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") || "";
  const [, setLocation] = useLocation();

  const { data: students, isLoading } = trpc.students.getByPhone.useQuery({ phone });
  const studentIds = students?.map(s => s.id) || [];
  const { data: existingPayments } = trpc.payments.getByStudentIds.useQuery(
    { studentIds },
    { enabled: studentIds.length > 0 }
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [period, setPeriod] = useState<PaymentPeriod>("Q1");
  const [customMonths, setCustomMonths] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractedAmount, setExtractedAmount] = useState<string>("");
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 檢查某個學生的某個期間是否已繳費(只計算 confirmed 狀態且金額>0的記錄)
  const isPeriodPaid = (studentId: number, period: PaymentPeriod) => {
    if (!existingPayments) return false;
    return existingPayments.some(
      payment => 
        payment.studentId === studentId && 
        payment.paymentPeriod === period &&
        payment.status === 'confirmed' &&
        parseFloat(payment.amount) > 0
    );
  };

  // 獲取某個期間的繳費資訊（日期 + 來源）
  const getPeriodPaymentInfo = (period: PaymentPeriod) => {
    if (!existingPayments || selectedStudentIds.length === 0) return null;
    
    for (const studentId of selectedStudentIds) {
      const payment = existingPayments.find(
        p => p.studentId === studentId && p.paymentPeriod === period && p.status === 'confirmed'
      );
      if (payment) {
        const date = payment.receiptTransferDate 
          ? new Date(payment.receiptTransferDate)
          : new Date(payment.paymentDate);
        const confirmedBy = (payment as any).confirmedBy;
        return { date, confirmedBy };
      }
    }
    return null;
  };

  // 檢查當前選擇的學生和期間是否已繳費
  const isCurrentSelectionPaid = () => {
    if (selectedStudentIds.length === 0) return false;
    return selectedStudentIds.some(studentId => isPeriodPaid(studentId, period));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPayment = trpc.payments.create.useMutation();

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("請選擇至少一位學生");
      return;
    }

    if (isCurrentSelectionPaid()) {
      toast.error("所選學生已繳交此期間的學費,請勿重複繳費");
      return;
    }

    if (!receiptFile) {
      toast.error("請上傳收據照片");
      return;
    }

    if (period === "CUSTOM" && !customMonths.trim()) {
      toast.error("請輸入自選月份");
      return;
    }

    setIsSubmitting(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];

        for (const studentId of selectedStudentIds) {
          const result = await createPayment.mutateAsync({
            studentId,
            paymentPeriod: period,
            customMonths: period === "CUSTOM" ? customMonths.split(",").map(m => m.trim()) : undefined,
            amount: "0",
            receiptBase64: base64,
            receiptMimeType: receiptFile.type,
          });

          if (result.extractedAmount) {
            setExtractedAmount(result.extractedAmount);
          }
        }

        toast.success("繳費記錄已成功提交!");
        setTimeout(() => {
          setLocation(`/history?phone=${encodeURIComponent(phone)}`);
        }, 1500);
      };
      reader.readAsDataURL(receiptFile);
    } catch (error) {
      console.error("提交失敗:", error);
      toast.error("提交失敗,請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasRegularStudents = students && students.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="container max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首頁
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setLocation(`/parent-attendance?phone=${encodeURIComponent(phone)}`)} variant="outline" size="sm">
              📊 出席情況
            </Button>
            <Button onClick={() => setLocation(`/history?phone=${encodeURIComponent(phone)}`)} variant="outline" size="sm">
              <HistoryIcon className="w-4 h-4 mr-1" />
              繳費記錄
            </Button>
            <Button onClick={() => setShowChangePassword(true)} variant="outline" size="sm">
              <KeyRound className="w-4 h-4 mr-1" />
              修改密碼
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* 精英班區塊 */}
          <EliteParentSection phone={phone} />

          {/* 恆常班學生選擇 */}
          {hasRegularStudents && (
          <Card>
            <CardHeader>
              <CardTitle>恆常班 - 選擇學生</CardTitle>
              <CardDescription>請選擇要繳費的恆常班學生 (可多選，季繳)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {students!.map((student) => (
                <div key={student.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={`student-${student.id}`}
                    checked={selectedStudentIds.includes(student.id)}
                    onCheckedChange={() => handleStudentToggle(student.id)}
                  />
                  <Label htmlFor={`student-${student.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-sm text-gray-500">
                      {student.venue} · {student.scheduleDay} {student.scheduleTime} · {student.beltLevel}
                    </div>
                  </Label>
                  <div className="text-right">
                    <div className="font-semibold text-blue-600">${student.feePerQuarter}</div>
                    <div className="text-xs text-gray-500">每季學費</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          )}

          {/* 繳費期間 - 只在有恆常班學生時顯示 */}
          {hasRegularStudents && (
          <Card>
            <CardHeader>
              <CardTitle>繳費期間</CardTitle>
              <CardDescription>選擇繳費的季度或自選月份</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={period} onValueChange={(v) => setPeriod(v as PaymentPeriod)}>
                {PERIOD_OPTIONS.map((option) => {
                  const hasAnyStudentPaid = selectedStudentIds.some(studentId => 
                    isPeriodPaid(studentId, option.value as PaymentPeriod)
                  );
                  const paymentInfo = getPeriodPaymentInfo(option.value as PaymentPeriod);
                  
                  return (
                    <div 
                      key={option.value} 
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        hasAnyStudentPaid ? 'bg-green-50 border border-green-200 opacity-60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <RadioGroupItem 
                        value={option.value} 
                        id={option.value} 
                        disabled={hasAnyStudentPaid}
                      />
                      <Label 
                        htmlFor={option.value} 
                        className={`flex-1 ${
                          hasAnyStudentPaid ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <div>{option.label}</div>
                        {hasAnyStudentPaid && paymentInfo && (
                          <div className="text-xs text-green-700 mt-1">
                            {paymentInfo.confirmedBy === 'parent_upload' 
                              ? `家長於 ${paymentInfo.date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} 上傳收據繳費`
                              : `管理員於 ${paymentInfo.date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} 確認已繳費`
                            }
                          </div>
                        )}
                      </Label>
                      {hasAnyStudentPaid && (
                        <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                          已繳交
                        </span>
                      )}
                    </div>
                  );
                })}
              </RadioGroup>

              {period === "CUSTOM" && (
                <div className="mt-4">
                  <Label htmlFor="customMonths">自選月份 (用逗號分隔,例如: 1月, 2月, 3月)</Label>
                  <Input
                    id="customMonths"
                    value={customMonths}
                    onChange={(e) => setCustomMonths(e.target.value)}
                    placeholder="例如: 1月, 2月, 3月"
                    className="mt-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* 收據上傳 - 只在有恆常班學生時顯示 */}
          {hasRegularStudents && (
          <Card>
            <CardHeader>
              <CardTitle>上傳收據</CardTitle>
              <CardDescription>上傳收據照片,系統會自動識別金額</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {receiptPreview ? (
                <div className="space-y-4">
                  <img
                    src={receiptPreview}
                    alt="收據預覽"
                    className="w-full max-h-96 object-contain rounded-lg border"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full"
                  >
                    更換收據
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-32 border-dashed"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span>點擊上傳收據照片</span>
                  </div>
                </Button>
              )}

              {extractedAmount && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">已識別金額: ${extractedAmount}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* 已繳費警告 */}
          {isCurrentSelectionPaid() && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-yellow-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-800 mb-1">警告: 此期間已繳費</h4>
                  <p className="text-sm text-yellow-700">
                    您選擇的學生已繳交此期間的學費,請勿重複繳費。如有疑問,請聯繫道館管理員。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 提交按鈕 - 只在有恆常班學生時顯示 */}
          {hasRegularStudents && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedStudentIds.length === 0 || !receiptFile || isCurrentSelectionPaid()}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                處理中...
              </>
            ) : isCurrentSelectionPaid() ? (
              "此期間已繳費"
            ) : (
              "確認提交"
            )}
          </Button>
          )}
        </div>

        <ChangePasswordDialog
          open={showChangePassword}
          onOpenChange={setShowChangePassword}
          phone={phone}
          userType="parent"
          userName={students?.[0]?.name}
        />
      </div>
    </div>
  );
}
