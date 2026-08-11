import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, UserPlus, Phone, Mail, MapPin, Calendar, Heart, Info, ChevronDown, ChevronUp, Camera, Upload, X, CreditCard } from "lucide-react";

export default function Register() {
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [studentName, setStudentName] = useState("");
  const [studentGender, setStudentGender] = useState<string>("");
  const [studentBirthYear, setStudentBirthYear] = useState("");
  const [studentBirthMonth, setStudentBirthMonth] = useState("");
  const [studentBirthDay, setStudentBirthDay] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentPhone2, setParentPhone2] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [preferredDojo, setPreferredDojo] = useState("");
  const [preferredSchedule, setPreferredSchedule] = useState("");
  const [firstClassDate, setFirstClassDate] = useState("");
  const [tuitionAmount, setTuitionAmount] = useState("");
  const [receivingBank, setReceivingBank] = useState("BOC");
  const [receiptFile, setReceiptFile] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [previousExperience, setPreviousExperience] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [howDidYouHear, setHowDidYouHear] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dojo options (public API)
  const dojosQuery = trpc.registration.getDojoOptions.useQuery();
  const submitMutation = trpc.registration.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  // Get schedules for selected dojo
  const selectedDojoSchedules = useMemo(() => {
    if (!preferredDojo || !dojosQuery.data) return [];
    const dojo = dojosQuery.data.find(d => d.name === preferredDojo);
    return dojo?.schedules || [];
  }, [preferredDojo, dojosQuery.data]);

  // Unique dojo names
  const dojoNames = useMemo(() => {
    if (!dojosQuery.data) return [];
    return dojosQuery.data.map(d => d.name);
  }, [dojosQuery.data]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, receipt: "檔案大小不能超過 10MB" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setReceiptFile({
        base64,
        mimeType: file.type,
        preview: URL.createObjectURL(file),
      });
      setErrors(prev => { const { receipt, ...rest } = prev; return rest; });
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!studentName.trim()) errs.studentName = "請輸入學生姓名";
    if (!parentName.trim()) errs.parentName = "請輸入家長/監護人姓名";
    if (!parentPhone.trim()) errs.parentPhone = "請輸入聯絡電話";
    else if (!/^\d{8}$/.test(parentPhone.trim())) errs.parentPhone = "請輸入8位數字電話號碼";
    if (!preferredDojo) errs.preferredDojo = "請選擇道場";
    if (!preferredSchedule) errs.preferredSchedule = "請選擇上課時段";
    if (!firstClassDate) errs.firstClassDate = "請選擇首堂日期";
    if (!receiptFile) errs.receipt = "請上傳繳費收據";
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) errs.parentEmail = "電郵格式不正確";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Build birth date if all parts present
    let birthDate: string | undefined;
    if (studentBirthYear && studentBirthMonth && studentBirthDay) {
      birthDate = `${studentBirthYear}-${studentBirthMonth.padStart(2, '0')}-${studentBirthDay.padStart(2, '0')}`;
    }

    submitMutation.mutate({
      studentName: studentName.trim(),
      studentGender: studentGender as 'male' | 'female' | undefined || undefined,
      studentBirthDate: birthDate,
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentPhone2: parentPhone2.trim() || undefined,
      parentEmail: parentEmail.trim() || undefined,
      relationship: relationship || undefined,
      preferredDojo: preferredDojo || undefined,
      preferredSchedule: preferredSchedule || undefined,
      firstClassDate: firstClassDate || undefined,
      tuitionAmount: tuitionAmount ? Number(tuitionAmount) : undefined,
      receivingBank: receivingBank || undefined,
      receiptBase64: receiptFile?.base64,
      receiptMimeType: receiptFile?.mimeType,
      previousExperience: previousExperience.trim() || undefined,
      medicalConditions: medicalConditions.trim() || undefined,
      howDidYouHear: howDidYouHear || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-10 pb-10 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">報名成功！</h2>
            <p className="text-gray-600 leading-relaxed">
              感謝您的報名！我們已收到 <span className="font-semibold text-gray-900">{studentName}</span> 的報名資料及繳費收據。
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>後續安排：</strong><br />
                管理員將於 1-2 個工作天內核實收據並確認報名。<br />
                確認後會透過 WhatsApp 通知您入學詳情。
              </p>
            </div>
            <Button
              onClick={() => {
                setSubmitted(false);
                setStudentName(""); setStudentGender(""); setStudentBirthYear("");
                setStudentBirthMonth(""); setStudentBirthDay("");
                setParentName(""); setParentPhone(""); setParentPhone2("");
                setParentEmail(""); setRelationship(""); setPreferredDojo("");
                setPreferredSchedule(""); setFirstClassDate(""); setTuitionAmount("");
                setReceivingBank("BOC"); setReceiptFile(null);
                setPreviousExperience(""); setMedicalConditions("");
                setHowDidYouHear(""); setRemarks("");
              }}
              variant="outline" className="mt-2"
            >
              再報名另一位學生
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-red-600 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-4xl">🥋</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">跆拳道新生報名表</h1>
          </div>
          <p className="text-blue-100 text-sm sm:text-base">
            歡迎加入！請填寫以下資料並上傳繳費收據，管理員核實後即完成報名。
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ─── Section 1: 學生資料 ─── */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                <UserPlus className="w-5 h-5" />
                學生資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 姓名 */}
              <div className="space-y-2">
                <Label htmlFor="studentName" className="font-medium">
                  學生姓名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="studentName"
                  placeholder="請輸入學生中文全名"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className={errors.studentName ? "border-red-400" : ""}
                />
                {errors.studentName && <p className="text-red-500 text-xs">{errors.studentName}</p>}
              </div>

              {/* 性別 */}
              <div className="space-y-2">
                <Label className="font-medium">性別</Label>
                <RadioGroup
                  value={studentGender}
                  onValueChange={setStudentGender}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="cursor-pointer">男</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="cursor-pointer">女</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 出生日期 */}
              <div className="space-y-2">
                <Label className="font-medium">出生日期</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={studentBirthYear} onValueChange={setStudentBirthYear}>
                    <SelectTrigger><SelectValue placeholder="年份" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 25 }, (_, i) => currentYear - i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentBirthMonth} onValueChange={setStudentBirthMonth}>
                    <SelectTrigger><SelectValue placeholder="月" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentBirthDay} onValueChange={setStudentBirthDay}>
                    <SelectTrigger><SelectValue placeholder="日" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>{d}日</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Section 2: 家長/監護人資料 ─── */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                <Phone className="w-5 h-5" />
                家長/監護人資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="parentName" className="font-medium">
                  家長/監護人姓名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="parentName"
                  placeholder="請輸入家長姓名"
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  className={errors.parentName ? "border-red-400" : ""}
                />
                {errors.parentName && <p className="text-red-500 text-xs">{errors.parentName}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-medium">與學生的關係</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="父親">父親</SelectItem>
                    <SelectItem value="母親">母親</SelectItem>
                    <SelectItem value="祖父/祖母">祖父/祖母</SelectItem>
                    <SelectItem value="外祖父/外祖母">外祖父/外祖母</SelectItem>
                    <SelectItem value="監護人">監護人</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentPhone" className="font-medium">
                  聯絡電話 (WhatsApp) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="parentPhone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="例：98765432"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  className={errors.parentPhone ? "border-red-400" : ""}
                />
                {errors.parentPhone && <p className="text-red-500 text-xs">{errors.parentPhone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentPhone2" className="font-medium">第二聯絡電話（選填）</Label>
                <Input
                  id="parentPhone2"
                  type="tel"
                  inputMode="numeric"
                  placeholder="例：91234567"
                  value={parentPhone2}
                  onChange={e => setParentPhone2(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentEmail" className="font-medium flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  電郵地址（選填）
                </Label>
                <Input
                  id="parentEmail"
                  type="email"
                  placeholder="example@email.com"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                  className={errors.parentEmail ? "border-red-400" : ""}
                />
                {errors.parentEmail && <p className="text-red-500 text-xs">{errors.parentEmail}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ─── Section 3: 道場選擇 + 首堂日期 ─── */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                <MapPin className="w-5 h-5" />
                上課安排
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="font-medium">
                  選擇道場 <span className="text-red-500">*</span>
                </Label>
                {dojosQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                  </div>
                ) : (
                  <Select value={preferredDojo} onValueChange={v => { setPreferredDojo(v); setPreferredSchedule(""); }}>
                    <SelectTrigger className={errors.preferredDojo ? "border-red-400" : ""}>
                      <SelectValue placeholder="請選擇道場" />
                    </SelectTrigger>
                    <SelectContent>
                      {dojoNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.preferredDojo && <p className="text-red-500 text-xs">{errors.preferredDojo}</p>}
              </div>

              {preferredDojo && selectedDojoSchedules.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-medium">
                    上課時段 <span className="text-red-500">*</span>
                  </Label>
                  <Select value={preferredSchedule} onValueChange={setPreferredSchedule}>
                    <SelectTrigger className={errors.preferredSchedule ? "border-red-400" : ""}>
                      <SelectValue placeholder="請選擇時段" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedDojoSchedules.map(s => {
                        const label = `${s.day} ${s.time}${s.coach ? ` (${s.coach})` : ''}`;
                        return <SelectItem key={s.id} value={label}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {errors.preferredSchedule && <p className="text-red-500 text-xs">{errors.preferredSchedule}</p>}
                </div>
              )}

              {/* 首堂日期 */}
              <div className="space-y-2">
                <Label htmlFor="firstClassDate" className="font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  首堂日期 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstClassDate"
                  type="date"
                  value={firstClassDate}
                  onChange={e => setFirstClassDate(e.target.value)}
                  className={errors.firstClassDate ? "border-red-400" : ""}
                />
                <p className="text-xs text-gray-400">第一次上課的日期</p>
                {errors.firstClassDate && <p className="text-red-500 text-xs">{errors.firstClassDate}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ─── Section 4: 繳費資料 ─── */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                <CreditCard className="w-5 h-5" />
                繳費資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 繳費金額 */}
              <div className="space-y-2">
                <Label htmlFor="tuitionAmount" className="font-medium">繳費金額 (HKD)</Label>
                <Input
                  id="tuitionAmount"
                  type="number"
                  inputMode="numeric"
                  placeholder="例：1800"
                  value={tuitionAmount}
                  onChange={e => setTuitionAmount(e.target.value)}
                />
                <p className="text-xs text-gray-400">請輸入已轉帳的金額</p>
              </div>

              {/* 收款方式 */}
              <div className="space-y-2">
                <Label className="font-medium">轉帳至</Label>
                <RadioGroup
                  value={receivingBank}
                  onValueChange={setReceivingBank}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="BOC" id="bank-boc" />
                    <Label htmlFor="bank-boc" className="cursor-pointer">中銀香港 (BOC)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="HSBC" id="bank-hsbc" />
                    <Label htmlFor="bank-hsbc" className="cursor-pointer">滙豐銀行 (HSBC)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CASH" id="bank-cash" />
                    <Label htmlFor="bank-cash" className="cursor-pointer">現金</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 收據上傳 */}
              <div className="space-y-2">
                <Label className="font-medium">
                  繳費收據 <span className="text-red-500">*</span>
                </Label>
                {receiptFile ? (
                  <div className="relative border rounded-lg overflow-hidden">
                    <img
                      src={receiptFile.preview}
                      alt="收據預覽"
                      className="w-full max-h-64 object-contain bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors ${errors.receipt ? 'border-red-400 bg-red-50/50' : 'border-gray-300'}`}
                  >
                    <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">點擊上傳收據照片</p>
                    <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {errors.receipt && <p className="text-red-500 text-xs">{errors.receipt}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ─── Section 5: 其他資料（可收合） ─── */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowOptional(!showOptional)}>
              <CardTitle className="flex items-center justify-between text-lg text-blue-700">
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  其他資料（選填）
                </span>
                {showOptional ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
            {showOptional && (
              <CardContent className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label className="font-medium">是否曾學習跆拳道？</Label>
                  <RadioGroup
                    value={previousExperience}
                    onValueChange={setPreviousExperience}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="無經驗" id="exp-no" />
                      <Label htmlFor="exp-no" className="cursor-pointer">無經驗</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="半年以下" id="exp-half" />
                      <Label htmlFor="exp-half" className="cursor-pointer">半年以下</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="半年至一年" id="exp-1y" />
                      <Label htmlFor="exp-1y" className="cursor-pointer">半年至一年</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="一年以上" id="exp-more" />
                      <Label htmlFor="exp-more" className="cursor-pointer">一年以上</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical" className="font-medium flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" />
                    特殊身體狀況 / 過敏
                  </Label>
                  <Textarea
                    id="medical"
                    placeholder="如有任何身體狀況、過敏或需要特別注意的事項，請在此說明"
                    value={medicalConditions}
                    onChange={e => setMedicalConditions(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">從何處得知我們？</Label>
                  <Select value={howDidYouHear} onValueChange={setHowDidYouHear}>
                    <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="朋友/學生介紹">朋友/學生介紹</SelectItem>
                      <SelectItem value="社交媒體 (Facebook/Instagram)">社交媒體 (Facebook/Instagram)</SelectItem>
                      <SelectItem value="學校宣傳">學校宣傳</SelectItem>
                      <SelectItem value="路過道場">路過道場</SelectItem>
                      <SelectItem value="網上搜尋">網上搜尋</SelectItem>
                      <SelectItem value="傳單/海報">傳單/海報</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks" className="font-medium">其他備註</Label>
                  <Textarea
                    id="remarks"
                    placeholder="如有其他問題或特別要求，歡迎在此留言"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 shadow-lg"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                提交中...
              </span>
            ) : (
              "提交報名"
            )}
          </Button>

          {submitMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm text-center">
              提交失敗，請稍後再試。{submitMutation.error?.message}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            提交後，管理員將核實收據並確認報名
          </p>
        </form>
      </div>
    </div>
  );
}
