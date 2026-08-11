import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Camera, X } from "lucide-react";



// ── 色帶列表 ──
const BELT_LEVELS = [
  "白帶 / 新生", "黃帶", "黃綠帶", "綠帶", "綠藍帶",
  "藍帶", "藍紅帶", "紅帶", "紅黑帶", "黑帶",
];

// ── 道袍尺寸列表 ──
const DOBOK_SIZES = [
  "90CM", "100CM", "110CM", "120CM", "130CM", "140CM",
  "150CM", "160CM", "170CM", "180CM", "190CM", "200CM",
];

// ── 從何得知列表 ──
const HOW_KNOW_OPTIONS = [
  "朋友介紹", "FACEBOOK", "傳單", "街招", "Google",
];

export default function Register() {
  const [submitted, setSubmitted] = useState(false);

  // Form state — matching Google Form field order
  const [studentName, setStudentName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [referrer, setReferrer] = useState("");
  const [firstClassDate, setFirstClassDate] = useState("");
  const [firstClassDateCustom, setFirstClassDateCustom] = useState(""); // 自選日期
  const [selectedDojoId, setSelectedDojoId] = useState(""); // 選中的道場時段 ID
  const [beltLevel, setBeltLevel] = useState("");
  const [studentBirthYear, setStudentBirthYear] = useState("");
  const [studentBirthMonth, setStudentBirthMonth] = useState("");
  const [studentBirthDay, setStudentBirthDay] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [studentGender, setStudentGender] = useState<string>("");
  const [parentEmail, setParentEmail] = useState("");
  const [facebook, setFacebook] = useState("");
  const [address, setAddress] = useState("");
  const [dobokSizes, setDobokSizes] = useState<string[]>([]);
  const [howDidYouHear, setHowDidYouHear] = useState("");
  const [howDidYouHearOther, setHowDidYouHearOther] = useState("");

  // Additional fields (kept from our enhanced version)
  const [parentName, setParentName] = useState("");
  const [parentPhone2, setParentPhone2] = useState("");
  const [tuitionAmount, setTuitionAmount] = useState("");
  const [receivingBank, setReceivingBank] = useState("BOC");
  const [receiptFile, setReceiptFile] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [medicalConditions, setMedicalConditions] = useState("");
  const [remarks, setRemarks] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dojo options from system
  const dojosQuery = trpc.registration.getDojoOptions.useQuery();

  // Build flat list of all dojo+schedule options
  const dojoScheduleOptions = useMemo(() => {
    if (!dojosQuery.data) return [];
    const options: { id: string; label: string; dojoName: string; schedule: string; day: string }[] = [];
    for (const dojo of dojosQuery.data) {
      for (const s of dojo.schedules) {
        const schedule = `${s.day} ${s.time}`;
        const label = `${dojo.name} — ${schedule}${s.coach ? ` (${s.coach})` : ''}`;
        options.push({ id: String(s.id), label, dojoName: dojo.name, schedule, day: s.day });
      }
    }
    return options;
  }, [dojosQuery.data]);

  // 計算首堂日期選項：根據選擇的道場星期，給出前3週+後3週的對應日期
  const firstClassDateOptions = useMemo(() => {
    if (!selectedDojoId) return [];
    const selected = dojoScheduleOptions.find(o => o.id === selectedDojoId);
    if (!selected) return [];

    // 星期對應表
    const dayMap: Record<string, number> = {
      '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
      '星期四': 4, '星期五': 5, '星期六': 6,
    };
    const targetDayNum = dayMap[selected.day];
    if (targetDayNum === undefined) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 找到本週（或最近的下一個）目標星期幾
    const todayDay = today.getDay();
    let diffToNext = targetDayNum - todayDay;
    if (diffToNext < 0) diffToNext += 7;

    const dates: { value: string; label: string }[] = [];
    // 前3週 + 本週(或最近) + 後2週 = 共6個日期
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + diffToNext + i * 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;
      const label = `${yyyy}年${d.getMonth() + 1}月${d.getDate()}日 (${selected.day})`;
      dates.push({ value, label });
    }
    return dates;
  }, [selectedDojoId, dojoScheduleOptions]);

  const submitMutation = trpc.registration.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

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
    if (!studentName.trim()) errs.studentName = "請輸入學生姓名(中文)";
    if (!englishName.trim()) errs.englishName = "請輸入學生姓名(英文)";
    if (!selectedDojoId) errs.preferredDojo = "請選擇上課地點及時間";
    if (!beltLevel) errs.beltLevel = "請選擇現時色帶";
    if (!studentBirthYear || !studentBirthMonth || !studentBirthDay) errs.birthDate = "請選擇出生日期";
    if (!parentPhone.trim()) errs.parentPhone = "請輸入聯絡電話";
    else if (!/^\d{8}$/.test(parentPhone.trim())) errs.parentPhone = "請輸入8位數字電話號碼";
    if (!studentGender) errs.studentGender = "請選擇性別";
    if (!parentEmail.trim()) errs.parentEmail = "請輸入EMAIL";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) errs.parentEmail = "電郵格式不正確";
    if (!facebook.trim()) errs.facebook = "請填寫FACEBOOK（如沒有請填「沒有」）";
    if (!address.trim()) errs.address = "請輸入住址";
    if (dobokSizes.length === 0) errs.dobokSize = "請選擇跆拳道袍尺寸";
    if (!howDidYouHear && !howDidYouHearOther.trim()) errs.howDidYouHear = "請選擇從何得知課程";
    if (!selectedDojoId) {
      // skip firstClassDate check if no dojo selected
    } else if (!firstClassDate) {
      errs.firstClassDate = "請選擇首堂日期";
    } else if (firstClassDate === '__custom__' && !firstClassDateCustom) {
      errs.firstClassDate = "請選擇自選日期";
    }
    if (!receiptFile) errs.receipt = "請上傳繳費收據";
    if (!parentName.trim()) errs.parentName = "請輸入家長/監護人姓名";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // Scroll to first error
      const firstErr = document.querySelector('.border-red-400, .text-red-500');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Build birth date
    const birthDate = `${studentBirthYear}-${studentBirthMonth.padStart(2, '0')}-${studentBirthDay.padStart(2, '0')}`;
    const finalHowKnow = howDidYouHear === '其他' ? howDidYouHearOther.trim() : howDidYouHear;

    // Get selected dojo info
    const selectedOption = dojoScheduleOptions.find(o => o.id === selectedDojoId);

    submitMutation.mutate({
      studentName: studentName.trim(),
      englishName: englishName.trim() || undefined,
      referrer: referrer.trim() || undefined,
      studentGender: studentGender as 'male' | 'female' || undefined,
      studentBirthDate: birthDate,
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentPhone2: parentPhone2.trim() || undefined,
      parentEmail: parentEmail.trim() || undefined,
      preferredDojo: selectedOption?.dojoName || undefined,
      classSchedule: selectedOption?.schedule || undefined,
      preferredSchedule: selectedOption?.label || undefined,
      beltLevel: beltLevel || undefined,
      address: address.trim() || undefined,
      facebook: facebook.trim() || undefined,
      dobokSize: dobokSizes.join(', ') || undefined,
      firstClassDate: (firstClassDate === '__custom__' ? firstClassDateCustom : firstClassDate) || undefined,
      tuitionAmount: tuitionAmount ? Number(tuitionAmount) : undefined,
      receivingBank: receivingBank || undefined,
      receiptBase64: receiptFile?.base64,
      receiptMimeType: receiptFile?.mimeType,
      medicalConditions: medicalConditions.trim() || undefined,
      howDidYouHear: finalHowKnow || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
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
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
              再報名另一位學生
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#fce4ec]">
      {/* Header — matching Google Form style */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Card className="border-t-[10px] border-t-red-700 shadow-md mb-4">
          <CardContent className="pt-6 pb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">創武跆拳道館-報名表</h1>
            <div className="text-sm text-gray-600 space-y-1">
              <p>聯絡電話 / WhatsApp / Wechat：9483 9882</p>
              <p>FACEBOOK：<a href="https://www.facebook.com/chongmotkd" target="_blank" rel="noopener" className="text-blue-600 underline">www.facebook.com/chongmotkd</a></p>
              <p>Email：<a href="mailto:laisir2013@gmail.com" className="text-blue-600 underline">laisir2013@gmail.com</a></p>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500">
              <p>只用作重新整理資料 和 通知閣下有關我們的所有活動和課堂資訊，所有資料必定保密。</p>
            </div>
            <p className="mt-3 text-red-500 text-sm">* 表示必填問題</p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 學生姓名(中文) */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                學生姓名(中文) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="您的答案"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.studentName ? "border-red-400" : ""}`}
              />
              {errors.studentName && <p className="text-red-500 text-xs mt-1">{errors.studentName}</p>}
            </CardContent>
          </Card>

          {/* 學生姓名(英文) */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                學生姓名(英文) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="您的答案"
                value={englishName}
                onChange={e => setEnglishName(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.englishName ? "border-red-400" : ""}`}
              />
              {errors.englishName && <p className="text-red-500 text-xs mt-1">{errors.englishName}</p>}
            </CardContent>
          </Card>

          {/* 介紹人(如有) */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">介紹人(如有)</Label>
              <Input
                placeholder="您的答案"
                value={referrer}
                onChange={e => setReferrer(e.target.value)}
                className="mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
              />
            </CardContent>
          </Card>

          {/* 上課地點及時間 — from system dojos */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                上課地點及時間 <span className="text-red-500">*</span>
              </Label>
              {dojosQuery.isLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : (
                <RadioGroup
                  value={selectedDojoId}
                  onValueChange={v => { setSelectedDojoId(v); setFirstClassDate(''); setFirstClassDateCustom(''); }}
                  className="mt-3 space-y-3"
                >
                  {dojoScheduleOptions.map(opt => (
                    <div key={opt.id} className="flex items-center space-x-3">
                      <RadioGroupItem value={opt.id} id={`dojo-${opt.id}`} />
                      <Label htmlFor={`dojo-${opt.id}`} className="font-normal cursor-pointer text-sm">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {errors.preferredDojo && <p className="text-red-500 text-xs mt-1">{errors.preferredDojo}</p>}
            </CardContent>
          </Card>

          {/* 首堂日期 — 根據選擇的道場星期自動配對 */}
          {selectedDojoId && (
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-5">
                <Label className="text-base font-normal">
                  首堂日期（入學日） <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-400 mt-1 mb-2">請選擇第一次上課的日期</p>
                <RadioGroup
                  value={firstClassDate}
                  onValueChange={v => { setFirstClassDate(v); if (v !== '__custom__') setFirstClassDateCustom(''); }}
                  className="space-y-3"
                >
                  {firstClassDateOptions.map(opt => (
                    <div key={opt.value} className="flex items-center space-x-3">
                      <RadioGroupItem value={opt.value} id={`fcd-${opt.value}`} />
                      <Label htmlFor={`fcd-${opt.value}`} className="font-normal cursor-pointer text-sm">{opt.label}</Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="__custom__" id="fcd-custom" />
                    <Label htmlFor="fcd-custom" className="font-normal cursor-pointer text-sm">自選日期：</Label>
                    <Input
                      type="date"
                      value={firstClassDateCustom}
                      onChange={e => { setFirstClassDateCustom(e.target.value); setFirstClassDate('__custom__'); }}
                      className="flex-1 border-0 border-b border-gray-300 rounded-none px-0 h-8 focus-visible:ring-0 focus-visible:border-blue-600"
                    />
                  </div>
                </RadioGroup>
                {errors.firstClassDate && <p className="text-red-500 text-xs mt-1">{errors.firstClassDate}</p>}
              </CardContent>
            </Card>
          )}

          {/* 現時色帶 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                現時色帶 <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={beltLevel}
                onValueChange={setBeltLevel}
                className="mt-3 space-y-3"
              >
                {BELT_LEVELS.map(belt => (
                  <div key={belt} className="flex items-center space-x-3">
                    <RadioGroupItem value={belt} id={`belt-${belt}`} />
                    <Label htmlFor={`belt-${belt}`} className="font-normal cursor-pointer text-sm">{belt}</Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.beltLevel && <p className="text-red-500 text-xs mt-1">{errors.beltLevel}</p>}
            </CardContent>
          </Card>

          {/* 出生日期 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                出生日期 <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Select value={studentBirthYear} onValueChange={setStudentBirthYear}>
                  <SelectTrigger className={errors.birthDate ? "border-red-400" : ""}><SelectValue placeholder="年份" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => currentYear - i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={studentBirthMonth} onValueChange={setStudentBirthMonth}>
                  <SelectTrigger className={errors.birthDate ? "border-red-400" : ""}><SelectValue placeholder="月" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={studentBirthDay} onValueChange={setStudentBirthDay}>
                  <SelectTrigger className={errors.birthDate ? "border-red-400" : ""}><SelectValue placeholder="日" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>{d}日</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>}
            </CardContent>
          </Card>

          {/* 聯絡電話 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                聯絡電話 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="您的答案"
                value={parentPhone}
                onChange={e => setParentPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.parentPhone ? "border-red-400" : ""}`}
              />
              {errors.parentPhone && <p className="text-red-500 text-xs mt-1">{errors.parentPhone}</p>}
            </CardContent>
          </Card>

          {/* 性別 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                性別 <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={studentGender}
                onValueChange={setStudentGender}
                className="mt-3 space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="male" id="gender-male" />
                  <Label htmlFor="gender-male" className="font-normal cursor-pointer text-sm">男</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="female" id="gender-female" />
                  <Label htmlFor="gender-female" className="font-normal cursor-pointer text-sm">女</Label>
                </div>
              </RadioGroup>
              {errors.studentGender && <p className="text-red-500 text-xs mt-1">{errors.studentGender}</p>}
            </CardContent>
          </Card>

          {/* EMAIL */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                EMAIL <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="您的答案"
                value={parentEmail}
                onChange={e => setParentEmail(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.parentEmail ? "border-red-400" : ""}`}
              />
              {errors.parentEmail && <p className="text-red-500 text-xs mt-1">{errors.parentEmail}</p>}
            </CardContent>
          </Card>

          {/* FACEBOOK */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                FACEBOOK（如果沒有，請填寫沒有） <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="您的答案"
                value={facebook}
                onChange={e => setFacebook(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.facebook ? "border-red-400" : ""}`}
              />
              {errors.facebook && <p className="text-red-500 text-xs mt-1">{errors.facebook}</p>}
            </CardContent>
          </Card>

          {/* 住址 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                住址 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="您的答案"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.address ? "border-red-400" : ""}`}
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </CardContent>
          </Card>

          {/* 跆拳道袍尺寸(新生專用) — checkbox (multi-select) */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                跆拳道袍尺寸(新生專用) <span className="text-red-500">*</span>
              </Label>
              <div className="mt-3 space-y-3">
                {DOBOK_SIZES.map(size => (
                  <div key={size} className="flex items-center space-x-3">
                    <Checkbox
                      id={`dobok-${size}`}
                      checked={dobokSizes.includes(size)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDobokSizes(prev => [...prev, size]);
                        } else {
                          setDobokSizes(prev => prev.filter(s => s !== size));
                        }
                      }}
                    />
                    <Label htmlFor={`dobok-${size}`} className="font-normal cursor-pointer text-sm">{size}</Label>
                  </div>
                ))}
              </div>
              {errors.dobokSize && <p className="text-red-500 text-xs mt-1">{errors.dobokSize}</p>}
            </CardContent>
          </Card>

          {/* 請問在那裡知道我們既課程？ */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                請問在那裡知道我們既課程？ <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={howDidYouHear}
                onValueChange={v => { setHowDidYouHear(v); if (v !== '其他') setHowDidYouHearOther(''); }}
                className="mt-3 space-y-3"
              >
                {HOW_KNOW_OPTIONS.map(opt => (
                  <div key={opt} className="flex items-center space-x-3">
                    <RadioGroupItem value={opt} id={`how-${opt}`} />
                    <Label htmlFor={`how-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
                  </div>
                ))}
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="其他" id="how-other" />
                  <Label htmlFor="how-other" className="font-normal cursor-pointer text-sm">其他：</Label>
                  <Input
                    placeholder=""
                    value={howDidYouHearOther}
                    onChange={e => { setHowDidYouHearOther(e.target.value); setHowDidYouHear('其他'); }}
                    className="flex-1 border-0 border-b border-gray-300 rounded-none px-0 h-8 focus-visible:ring-0 focus-visible:border-blue-600"
                  />
                </div>
              </RadioGroup>
              {errors.howDidYouHear && <p className="text-red-500 text-xs mt-1">{errors.howDidYouHear}</p>}
            </CardContent>
          </Card>

          {/* ═══ 以下為本系統額外欄位（繳費 + 家長） ═══ */}
          <div className="pt-4 pb-2">
            <p className="text-center text-sm text-gray-600 font-medium">── 以下為繳費及家長資料 ──</p>
          </div>

          {/* 家長/監護人姓名 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                家長/監護人姓名 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="您的答案"
                value={parentName}
                onChange={e => setParentName(e.target.value)}
                className={`mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 ${errors.parentName ? "border-red-400" : ""}`}
              />
              {errors.parentName && <p className="text-red-500 text-xs mt-1">{errors.parentName}</p>}
            </CardContent>
          </Card>

          {/* 第二聯絡電話 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">第二聯絡電話（選填）</Label>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="您的答案"
                value={parentPhone2}
                onChange={e => setParentPhone2(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className="mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
              />
            </CardContent>
          </Card>

          {/* 繳費金額 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">繳費金額 (HKD)</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="例：1800"
                value={tuitionAmount}
                onChange={e => setTuitionAmount(e.target.value)}
                className="mt-2 border-0 border-b border-gray-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
              />
              <p className="text-xs text-gray-400 mt-1">請輸入已轉帳的金額</p>
            </CardContent>
          </Card>

          {/* 轉帳至 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">轉帳至</Label>
              <RadioGroup
                value={receivingBank}
                onValueChange={setReceivingBank}
                className="mt-3 space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="BOC" id="bank-boc" />
                  <Label htmlFor="bank-boc" className="font-normal cursor-pointer text-sm">中銀香港 (BOC)</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="HSBC" id="bank-hsbc" />
                  <Label htmlFor="bank-hsbc" className="font-normal cursor-pointer text-sm">滙豐銀行 (HSBC)</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="CASH" id="bank-cash" />
                  <Label htmlFor="bank-cash" className="font-normal cursor-pointer text-sm">現金</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 繳費收據 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">
                繳費收據 <span className="text-red-500">*</span>
              </Label>
              {receiptFile ? (
                <div className="relative mt-3 border rounded-lg overflow-hidden">
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
                  className={`mt-3 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors ${errors.receipt ? 'border-red-400 bg-red-50/50' : 'border-gray-300'}`}
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
              {errors.receipt && <p className="text-red-500 text-xs mt-1">{errors.receipt}</p>}
            </CardContent>
          </Card>

          {/* 特殊身體狀況 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">特殊身體狀況 / 過敏（選填）</Label>
              <Textarea
                placeholder="如有任何身體狀況、過敏或需要特別注意的事項"
                value={medicalConditions}
                onChange={e => setMedicalConditions(e.target.value)}
                rows={2}
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* 其他備註 */}
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <Label className="text-base font-normal">其他備註（選填）</Label>
              <Textarea
                placeholder="如有其他問題或特別要求"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 text-lg font-bold bg-red-700 hover:bg-red-800 shadow-lg"
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
        </form>
      </div>
    </div>
  );
}
