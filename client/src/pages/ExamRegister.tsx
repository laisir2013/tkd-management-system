import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Camera, Upload, ArrowLeft, ArrowRight, Copy, ChevronRight } from "lucide-react";
import { useParams } from "wouter";

// ── 帶級列表（中文）──
const BELT_LEVELS_CN = [
  "白帶", "黃帶", "黃綠帶", "綠帶", "綠藍帶",
  "藍帶", "藍紅帶", "紅帶", "紅黑帶", "黑帶",
];

// ── 帶級對應下一級 ──
const NEXT_BELT_MAP: Record<string, string> = {
  "白帶": "黃帶", "黃帶": "黃綠帶", "黃綠帶": "綠帶", "綠帶": "綠藍帶",
  "綠藍帶": "藍帶", "藍帶": "藍紅帶", "藍紅帶": "紅帶", "紅帶": "紅黑帶",
  "紅黑帶": "黑帶",
};

// ── 帶級顏色 ──
const BELT_COLOR_MAP: Record<string, string> = {
  "白帶": "bg-white border border-gray-300 text-gray-800",
  "黃帶": "bg-yellow-300 text-yellow-900",
  "黃綠帶": "bg-gradient-to-r from-yellow-300 to-green-400 text-green-900",
  "綠帶": "bg-green-500 text-white",
  "綠藍帶": "bg-gradient-to-r from-green-500 to-blue-500 text-white",
  "藍帶": "bg-blue-600 text-white",
  "藍紅帶": "bg-gradient-to-r from-blue-600 to-red-500 text-white",
  "紅帶": "bg-red-600 text-white",
  "紅黑帶": "bg-gradient-to-r from-red-600 to-gray-900 text-white",
  "黑帶": "bg-gray-900 text-white",
};

// ── 道場列表 ──
const DOJO_LIST = [
  "寶林", "坑口", "將軍澳", "調景嶺", "觀塘", "藍田", "油塘",
  "牛頭角", "九龍灣", "鑽石山", "黃大仙", "慈雲山", "其他",
];

export default function ExamRegister() {
  const params = useParams<{ examId: string }>();
  const examId = parseInt(params.examId || "0");

  // Multi-step: 1=basic info + belt, 2=confirm & pay, 3=success
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [dojoName, setDojoName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [age, setAge] = useState("");
  const [currentBelt, setCurrentBelt] = useState("");

  // Payment state
  const [bankName, setBankName] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [copiedAccount, setCopiedAccount] = useState("");

  // Result
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch exam info
  const { data: exam, isLoading: examLoading } = trpc.exam.get.useQuery(
    { id: examId },
    { enabled: examId > 0 }
  );

  // Calculate fee
  const targetBelt = currentBelt ? NEXT_BELT_MAP[currentBelt] : "";
  const { data: feeInfo, isLoading: feeLoading } = trpc.exam.registration.calculateFee.useQuery(
    { currentBeltCn: currentBelt, studentName, phone, examId },
    { enabled: !!currentBelt && !!studentName && !!phone && examId > 0 }
  );

  // Mutations
  const registerMutation = trpc.exam.registration.register.useMutation();
  const uploadReceiptMutation = trpc.exam.registration.uploadReceipt.useMutation();

  // ── Validation ──
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!studentName.trim()) errs.studentName = "請填寫學生姓名";
    if (!phone.trim()) errs.phone = "請填寫聯絡電話";
    if (!dojoName) errs.dojoName = "請選擇道場";
    if (!gender) errs.gender = "請選擇性別";
    if (!age.trim()) errs.age = "請填寫年齡";
    if (!currentBelt) errs.currentBelt = "請選擇目前帶級";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Handlers ──
  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setErrors({});
      setStep(2);
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep(step - 1);
  };

  const handleRegister = async () => {
    if (!gender) return;
    setSubmitting(true);
    try {
      const result = await registerMutation.mutateAsync({
        examId,
        studentId: null,
        studentName: studentName.trim(),
        phone: phone.trim(),
        dojoName,
        gender: gender as 'male' | 'female',
        age: parseInt(age) || null,
        currentBeltCn: currentBelt,
      });
      if (result.success) {
        setRegistrationResult(result);
        if (result.isRetake || result.amount === 0) {
          setStep(3);
          setSubmitted(true);
        }
        // 需繳費的留在 step 2 等上傳收據
      } else {
        setErrors({ submit: result.error || '報名失敗' });
      }
    } catch (err: any) {
      setErrors({ submit: err.message || '報名失敗，請稍後再試' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!registrationResult?.paymentId || !receiptFile) return;
    setSubmitting(true);
    try {
      await uploadReceiptMutation.mutateAsync({
        paymentId: registrationResult.paymentId,
        receiptBase64: receiptFile.base64,
        receiptFilename: `receipt-${Date.now()}.jpg`,
        bank: bankName || undefined,
        paymentDate: paymentDate || undefined,
      });
      setStep(3);
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ upload: err.message || '上傳收據失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors({ ...errors, receipt: "檔案太大，請選擇 10MB 以下的圖片" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const preview = URL.createObjectURL(file);
      setReceiptFile({ base64, mimeType: file.type, preview });
      setErrors((prev) => { const { receipt, ...rest } = prev; return rest; });
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(label);
    setTimeout(() => setCopiedAccount(""), 2000);
  };

  // ── Loading ──
  if (examLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Exam not found or not open ──
  const examData = exam as any;
  if (!examData || !examData.registrationOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-5xl mb-4">🥋</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">升級試報名</h2>
              {!examData ? (
                <p className="text-gray-500">找不到此考試場次</p>
              ) : (
                <p className="text-gray-500">此考試場次尚未開放報名或已截止</p>
              )}
              <p className="text-sm text-gray-400 mt-2">如有疑問請聯絡道場</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Success page ──
  if (step === 3 && submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-8">
          <Card className="border-green-200">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">報名成功！</h2>
              <div className="bg-green-50 rounded-lg p-4 mt-4 text-left space-y-2">
                <p className="text-sm"><span className="font-medium">考試：</span>{examData.name}</p>
                <p className="text-sm"><span className="font-medium">日期：</span>{new Date(examData.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</p>
                {examData.location && <p className="text-sm"><span className="font-medium">地點：</span>{examData.location}</p>}
                <hr className="my-2" />
                <p className="text-sm"><span className="font-medium">學生姓名：</span>{studentName}</p>
                <p className="text-sm"><span className="font-medium">目前帶級：</span>{currentBelt}</p>
                <p className="text-sm"><span className="font-medium">升級目標：</span>{targetBelt}</p>
                {registrationResult?.isRetake && (
                  <p className="text-sm text-orange-700 font-medium">🔄 補考 — 免費</p>
                )}
                {!registrationResult?.isRetake && registrationResult?.amount > 0 && (
                  <p className="text-sm"><span className="font-medium">已繳費用：</span>${registrationResult.amount?.toLocaleString()}</p>
                )}
              </div>
              <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p>📱 截止報名後將公布分組時段，届時會透過 WhatsApp 通知</p>
              </div>
              <Button
                className="mt-6 w-full"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setSubmitted(false);
                  setStudentName("");
                  setCurrentBelt("");
                  setAge("");
                  setGender("");
                  setRegistrationResult(null);
                  setReceiptFile(null);
                  setBankName("");
                  setErrors({});
                }}
              >
                再報一位學生
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-24">
      <div className="max-w-lg mx-auto pt-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🥋</div>
          <h1 className="text-xl font-bold text-gray-800">{examData.name}</h1>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
            <span>📅 {new Date(examData.examDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
            {examData.examTime && <span>🕐 {examData.examTime}</span>}
            {examData.location && <span>📍 {examData.location}</span>}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s}
              </div>
              {s < 2 && (
                <div className={`w-12 h-0.5 mx-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 text-xs text-gray-500 mb-6">
          <span className={step === 1 ? 'text-blue-600 font-medium' : ''}>填寫資料</span>
          <span className={step === 2 ? 'text-blue-600 font-medium' : ''}>確認繳費</span>
        </div>

        {/* ══════════════════ Step 1: Info & Belt ══════════════════ */}
        {step === 1 && (
          <div className="space-y-4">
            {/* 學生資料 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">👤 學生資料</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">學生姓名 <span className="text-red-500">*</span></Label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="請輸入學生中文全名"
                    className="mt-1"
                  />
                  {errors.studentName && <p className="text-red-500 text-xs mt-1">{errors.studentName}</p>}
                </div>

                <div>
                  <Label className="text-sm font-medium">性別 <span className="text-red-500">*</span></Label>
                  <RadioGroup value={gender} onValueChange={(v) => setGender(v as "male" | "female")} className="flex gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="male" id="g-male" />
                      <Label htmlFor="g-male" className="font-normal cursor-pointer">男</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="female" id="g-female" />
                      <Label htmlFor="g-female" className="font-normal cursor-pointer">女</Label>
                    </div>
                  </RadioGroup>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>

                <div>
                  <Label className="text-sm font-medium">年齡 <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="請輸入年齡"
                    className="mt-1"
                    min="3" max="80"
                  />
                  {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
                </div>

                <div>
                  <Label className="text-sm font-medium">聯絡電話 <span className="text-red-500">*</span></Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例：9123 4567"
                    className="mt-1"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <Label className="text-sm font-medium">道場 <span className="text-red-500">*</span></Label>
                  <Select value={dojoName} onValueChange={setDojoName}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="請選擇道場" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOJO_LIST.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.dojoName && <p className="text-red-500 text-xs mt-1">{errors.dojoName}</p>}
                </div>
              </CardContent>
            </Card>

            {/* 帶級選擇 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🥋 目前帶級 <span className="text-red-500">*</span></CardTitle>
                <p className="text-xs text-gray-500">選擇目前帶級，系統會自動計算升級目標和費用</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {BELT_LEVELS_CN.map((belt) => {
                    const nextBelt = NEXT_BELT_MAP[belt];
                    const isDisabled = !nextBelt;
                    return (
                      <button
                        key={belt}
                        type="button"
                        disabled={isDisabled}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-sm
                          ${currentBelt === belt ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}
                          ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !isDisabled && setCurrentBelt(belt)}
                      >
                        <div className={`w-5 h-2.5 rounded-sm shrink-0 ${BELT_COLOR_MAP[belt]?.split(' ')[0] || 'bg-gray-300'}`} />
                        <span className="font-medium">{belt}</span>
                        {currentBelt === belt && <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                {errors.currentBelt && <p className="text-red-500 text-xs mt-2">{errors.currentBelt}</p>}

                {/* 即時顯示升級目標 */}
                {currentBelt && targetBelt && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{currentBelt}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-blue-700">{targetBelt}</span>
                    </div>
                    {feeLoading ? (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> 計算費用中...
                      </p>
                    ) : feeInfo ? (
                      <p className="text-xs mt-1">
                        {feeInfo.isRetake ? (
                          <span className="text-orange-700 font-medium">🔄 補考 — 免費</span>
                        ) : (
                          <span className="text-blue-800">💰 考試費：<span className="font-bold">${feeInfo.fee.toLocaleString()}</span></span>
                        )}
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next */}
            <Button className="w-full" size="lg" onClick={handleNext}>
              下一步 <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════ Step 2: Confirm & Pay ══════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Summary */}
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📋 報名摘要</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-gray-500">學生姓名</span><span className="font-medium">{studentName}</span>
                  <span className="text-gray-500">性別</span><span className="font-medium">{gender === 'male' ? '男' : '女'}</span>
                  <span className="text-gray-500">年齡</span><span className="font-medium">{age} 歲</span>
                  <span className="text-gray-500">電話</span><span className="font-medium">{phone}</span>
                  <span className="text-gray-500">道場</span><span className="font-medium">{dojoName}</span>
                  <span className="text-gray-500">目前帶級</span><span className="font-medium">{currentBelt}</span>
                  <span className="text-gray-500">升級目標</span><span className="font-bold text-blue-700">{targetBelt}</span>
                  <span className="text-gray-500">費用</span>
                  <span className="font-bold text-lg text-blue-700">
                    {feeInfo?.isRetake ? '免費（補考）' : `$${feeInfo?.fee?.toLocaleString() || '-'}`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 補考免費 — 直接報名 */}
            {feeInfo?.isRetake ? (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-4 text-center">
                  <p className="text-orange-800 font-medium mb-3">🔄 補考免費，無需繳費</p>
                  {errors.submit && <p className="text-red-500 text-sm mb-3">{errors.submit}</p>}
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={handleRegister}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    確認報名（免費補考）
                  </Button>
                </CardContent>
              </Card>
            ) : !registrationResult ? (
              <>
                {/* 繳費資料 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">💳 繳費資料</CardTitle>
                    <p className="text-xs text-gray-500">請先報名，然後透過轉帳/FPS繳費並上傳收據</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "HSBC", account: "484-287123-838" },
                      { label: "中銀", account: "012-692-2-011481-6" },
                      { label: "FPS ID（中銀）", account: "164577132" },
                    ].map(({ label, account }) => (
                      <div key={label} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border">
                        <div>
                          <span className="text-xs text-gray-500">{label}</span>
                          <p className="font-mono text-sm font-medium">{account}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(account, label)} className="text-blue-600">
                          {copiedAccount === label ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {errors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.submit}</div>
                )}

                <Button className="w-full" size="lg" onClick={handleRegister} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  確認報名
                </Button>
                <p className="text-xs text-center text-gray-400">報名後請上傳收據完成繳費</p>
              </>
            ) : (
              <>
                {/* 已報名，等待上傳收據 */}
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">已報名成功！請上傳收據完成繳費</span>
                    </div>
                    <p className="text-sm text-green-700">考試費：<span className="font-bold">${registrationResult.amount?.toLocaleString()}</span></p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">📎 上傳轉帳收據</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm">付款銀行</Label>
                      <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="例：HSBC / 中銀 / 恒生" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">付款日期</Label>
                      <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="mt-1" />
                    </div>

                    {/* Receipt upload */}
                    {receiptFile ? (
                      <div className="relative">
                        <img src={receiptFile.preview} alt="收據預覽" className="w-full max-h-48 object-contain rounded-lg border" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            if (receiptFile.preview) URL.revokeObjectURL(receiptFile.preview);
                            setReceiptFile(null);
                          }}
                        >
                          ✕ 移除
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <Upload className="w-5 h-5 text-blue-500" />
                            <span className="text-sm text-blue-600 font-medium">選擇圖片</span>
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                        </label>
                        <label className="cursor-pointer">
                          <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors">
                            <Camera className="w-5 h-5 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">拍照</span>
                          </div>
                          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                        </label>
                      </div>
                    )}
                    {errors.receipt && <p className="text-red-500 text-xs">{errors.receipt}</p>}
                    {errors.upload && <p className="text-red-500 text-xs">{errors.upload}</p>}

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                      onClick={handleUploadReceipt}
                      disabled={submitting || !receiptFile}
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      上傳收據完成報名
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Back */}
            {!registrationResult && (
              <Button variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> 上一步
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
