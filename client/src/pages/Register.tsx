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
import { CheckCircle2, Loader2, Camera, X, User, MapPin, BookOpen, Phone, CreditCard, HelpCircle, Copy } from "lucide-react";

// ── 色帶列表 ──
const BELT_LEVELS = [
  "白帶 / 新生", "黃帶", "黃綠帶", "綠帶", "綠藍帶",
  "藍帶", "藍紅帶", "紅帶", "紅黑帶", "黑帶",
];

// ── 道袍尺寸 ──
const DOBOK_SIZES = [
  "90CM", "100CM", "110CM", "120CM", "130CM", "140CM",
  "150CM", "160CM", "170CM", "180CM", "190CM", "200CM",
];

// ── 從何得知 ──
const HOW_KNOW_OPTIONS = ["朋友介紹", "FACEBOOK", "傳單", "街招", "Google"];

export default function Register() {
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [studentName, setStudentName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [referrer, setReferrer] = useState("");
  const [firstClassDate, setFirstClassDate] = useState("");
  const [firstClassDateCustom, setFirstClassDateCustom] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDojoId, setSelectedDojoId] = useState("");
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
  const [parentName, setParentName] = useState("");
  const [parentPhone2, setParentPhone2] = useState("");
  const [tuitionAmount, setTuitionAmount] = useState("");
  const [receivingBank, setReceivingBank] = useState("BOC");
  const [receiptFile, setReceiptFile] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [medicalConditions, setMedicalConditions] = useState("");
  const [remarks, setRemarks] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedAccount, setCopiedAccount] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dojo options from system
  const dojosQuery = trpc.registration.getDojoOptions.useQuery();
  // Fetch payment methods from system
  const paymentMethodsQuery = trpc.registration.getPaymentMethods.useQuery();

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

  // Unique location names for step 1
  const locationNames = useMemo(() => {
    if (!dojosQuery.data) return [];
    return dojosQuery.data.map(d => d.name);
  }, [dojosQuery.data]);

  // Filtered time slots for selected location (step 2)
  const filteredSchedules = useMemo(() => {
    if (!selectedLocation || !dojosQuery.data) return [];
    const dojo = dojosQuery.data.find(d => d.name === selectedLocation);
    if (!dojo) return [];
    return dojo.schedules.map(s => ({
      id: String(s.id),
      day: s.day,
      time: s.time,
      coach: s.coach || '',
      label: `${s.day} ${s.time}`,
    }));
  }, [selectedLocation, dojosQuery.data]);

  // 費用自動計算（道袍+手把為必買項目）
  const feeBreakdown = useMemo(() => {
    if (!selectedLocation || !dojosQuery.data) return null;
    const dojo = dojosQuery.data.find(d => d.name === selectedLocation);
    if (!dojo) return null;
    const tuition = dojo.quarterlyFee;
    const dobok = 400;
    const mitts = 150;
    const total = tuition + dobok + mitts;
    return { tuition, dobok, mitts, total };
  }, [selectedLocation, dojosQuery.data]);

  // 計算首堂日期選項：前3週 + 後3週
  const firstClassDateOptions = useMemo(() => {
    if (!selectedDojoId) return [];
    const selected = dojoScheduleOptions.find(o => o.id === selectedDojoId);
    if (!selected) return [];

    const dayMap: Record<string, number> = {
      '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
      '星期四': 4, '星期五': 5, '星期六': 6,
    };
    const targetDayNum = dayMap[selected.day];
    if (targetDayNum === undefined) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    let diffToNext = targetDayNum - todayDay;
    if (diffToNext < 0) diffToNext += 7;

    const dates: { value: string; label: string }[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + diffToNext + i * 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;
      const label = `${d.getDate()}/${d.getMonth() + 1} (${selected.day})`;
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
      setReceiptFile({ base64, mimeType: file.type, preview: URL.createObjectURL(file) });
      setErrors(prev => { const { receipt, ...rest } = prev; return rest; });
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!studentName.trim()) errs.studentName = "必填";
    if (!englishName.trim()) errs.englishName = "必填";
    if (!selectedDojoId) errs.preferredDojo = "請選擇上課地點及時間";
    if (selectedDojoId && !firstClassDate) errs.firstClassDate = "請選擇首堂日期";
    else if (firstClassDate === '__custom__' && !firstClassDateCustom) errs.firstClassDate = "請選擇日期";
    if (!beltLevel) errs.beltLevel = "必填";
    if (!studentBirthYear || !studentBirthMonth || !studentBirthDay) errs.birthDate = "必填";
    if (!parentPhone.trim()) errs.parentPhone = "必填";
    else if (!/^\d{8}$/.test(parentPhone.trim())) errs.parentPhone = "請輸入8位數字";
    if (!studentGender) errs.studentGender = "必填";
    if (!parentEmail.trim()) errs.parentEmail = "必填";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) errs.parentEmail = "格式不正確";
    if (!facebook.trim()) errs.facebook = "必填（如沒有請填「沒有」）";
    if (!address.trim()) errs.address = "必填";
    if (dobokSizes.length === 0) errs.dobokSize = "必填";
    if (!howDidYouHear && !howDidYouHearOther.trim()) errs.howDidYouHear = "必填";
    if (!receiptFile) errs.receipt = "請上傳收據";
    if (!parentName.trim()) errs.parentName = "必填";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setTimeout(() => {
        document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    const birthDate = `${studentBirthYear}-${studentBirthMonth.padStart(2, '0')}-${studentBirthDay.padStart(2, '0')}`;
    const finalHowKnow = howDidYouHear === '其他' ? howDidYouHearOther.trim() : howDidYouHear;
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
      tuitionAmount: feeBreakdown?.total || undefined,
      receivingBank: receivingBank || undefined,
      receiptBase64: receiptFile?.base64,
      receiptMimeType: receiptFile?.mimeType,
      medicalConditions: medicalConditions.trim() || undefined,
      howDidYouHear: finalHowKnow || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border border-slate-200/80 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center">
            <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 border border-white/30">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white">報名成功！</h2>
          </div>
          <CardContent className="pt-8 pb-10 px-8 text-center space-y-5">
            <p className="text-gray-600 text-base">
              已收到 <strong className="text-slate-900">{studentName}</strong> 的報名資料及繳費收據。
            </p>
            <div className="bg-slate-50 rounded-2xl p-5 text-left text-sm text-slate-700 leading-relaxed border border-slate-100">
              <p className="font-bold mb-2 text-slate-900">後續安排：</p>
              <p>管理員將於 1-2 個工作天內核實收據並確認報名，確認後會透過 WhatsApp 通知您。</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-3 rounded-full px-8 h-11 font-semibold border-2">
              再報名另一位學生
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  // ── Error indicator helper ──
  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? <p className="text-red-500 text-xs mt-1" data-error>{errors[name]}</p> : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(239,68,68,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(251,146,60,0.2) 0%, transparent 40%)'}} />
        <div className="relative max-w-2xl mx-auto px-4 pt-12 pb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl mb-5">
            <span className="text-4xl">🥋</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">創武跆拳道館</h1>
          <p className="text-lg text-white/70 font-medium">新生報名表</p>
          <div className="mt-5 inline-flex items-center gap-4 text-sm text-white/50">
            <span className="flex items-center gap-1.5">📱 9483 9882</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <a href="https://www.facebook.com/chongmotkd" target="_blank" rel="noopener" className="hover:text-white/80 transition-colors">Facebook</a>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-16 -mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ═══ Section 1: 學生資料 ═══ */}
          <Card className="rounded-3xl shadow-lg shadow-blue-500/5 border border-slate-200/80 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 pb-3 pt-5 px-6">
              <CardTitle className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                學生資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 bg-white">
              {/* 中文名 + 英文名 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">中文姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="陳大文" value={studentName} onChange={e => setStudentName(e.target.value)}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 ${errors.studentName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="studentName" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">英文姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="Chan Tai Man" value={englishName} onChange={e => setEnglishName(e.target.value)}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 ${errors.englishName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="englishName" />
                </div>
              </div>

              {/* 性別 + 出生日期 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">性別 <span className="text-red-500">*</span></Label>
                  <div className="flex gap-3 mt-2">
                    {[{ v: 'male', l: '男', icon: '👦' }, { v: 'female', l: '女', icon: '👧' }].map(g => (
                      <button key={g.v} type="button"
                        onClick={() => setStudentGender(g.v)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${studentGender === g.v ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <span className="mr-1">{g.icon}</span> {g.l}
                      </button>
                    ))}
                  </div>
                  <FieldError name="studentGender" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">出生日期 <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    <Select value={studentBirthYear} onValueChange={setStudentBirthYear}>
                      <SelectTrigger className={`rounded-xl h-11 text-sm ${errors.birthDate ? 'border-red-400' : 'border-slate-200'}`}><SelectValue placeholder="年" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 30 }, (_, i) => currentYear - i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={studentBirthMonth} onValueChange={setStudentBirthMonth}>
                      <SelectTrigger className={`rounded-xl h-11 text-sm ${errors.birthDate ? 'border-red-400' : 'border-slate-200'}`}><SelectValue placeholder="月" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m}月</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={studentBirthDay} onValueChange={setStudentBirthDay}>
                      <SelectTrigger className={`rounded-xl h-11 text-sm ${errors.birthDate ? 'border-red-400' : 'border-slate-200'}`}><SelectValue placeholder="日" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 31 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}日</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <FieldError name="birthDate" />
                </div>
              </div>

              {/* 色帶 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">現時色帶 <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {BELT_LEVELS.map(belt => (
                    <button key={belt} type="button"
                      onClick={() => setBeltLevel(belt)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${beltLevel === belt ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {belt}
                    </button>
                  ))}
                </div>
                <FieldError name="beltLevel" />
              </div>

              {/* 道袍尺寸 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">跆拳道袍尺寸 <span className="text-red-500">*</span></Label>
                <p className="text-xs text-slate-400 mt-0.5">新生專用，可多選</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                  {DOBOK_SIZES.map(size => (
                    <button key={size} type="button"
                      onClick={() => setDobokSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                      className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${dobokSizes.includes(size) ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {size}
                    </button>
                  ))}
                </div>
                <FieldError name="dobokSize" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 2: 上課安排 ═══ */}
          <Card className="rounded-3xl shadow-lg shadow-emerald-500/5 border border-slate-200/80 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 pb-3 pt-5 px-6">
              <CardTitle className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                上課安排
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 bg-white">
              {/* 上課地點 — Step 1 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">上課地點 <span className="text-red-500">*</span></Label>
                {dojosQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> 載入中...</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                    {locationNames.map(name => (
                      <button key={name} type="button"
                        onClick={() => { setSelectedLocation(name); setSelectedDojoId(''); setFirstClassDate(''); setFirstClassDateCustom(''); }}
                        className={`px-4 py-3.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${selectedLocation === name ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-500/10' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <FieldError name="preferredDojo" />
              </div>

              {/* 上課時間 — Step 2 */}
              {selectedLocation && filteredSchedules.length > 0 && (
                <div className="pt-4 border-t border-dashed border-slate-200">
                  <Label className="text-sm font-semibold text-slate-700">上課時間 <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-400 mt-0.5 mb-3">{selectedLocation} 可選時段</p>
                  <div className="space-y-2">
                    {filteredSchedules.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setSelectedDojoId(s.id); setFirstClassDate(''); setFirstClassDateCustom(''); }}
                        className={`w-full text-left px-5 py-3.5 rounded-xl text-sm border-2 transition-all duration-200 ${selectedDojoId === s.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-500/10' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <span className="font-semibold">{s.day} {s.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 首堂日期 */}
              {selectedDojoId && (
                <div className="pt-4 border-t border-dashed border-slate-200">
                  <Label className="text-sm font-semibold text-slate-700">首堂日期 <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-400 mt-0.5 mb-3">選擇第一次上課的日期</p>
                  <div className="flex flex-wrap gap-2">
                    {firstClassDateOptions.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { setFirstClassDate(opt.value); setFirstClassDateCustom(''); }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${firstClassDate === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setFirstClassDate('__custom__')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${firstClassDate === '__custom__' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        自選日期
                      </button>
                      {firstClassDate === '__custom__' && (
                        <Input type="date" value={firstClassDateCustom}
                          onChange={e => setFirstClassDateCustom(e.target.value)}
                          className="w-40 h-10 rounded-xl text-sm border-slate-200" />
                      )}
                    </div>
                  </div>
                  <FieldError name="firstClassDate" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ Section 3: 聯絡資料 ═══ */}
          <Card className="rounded-3xl shadow-lg shadow-violet-500/5 border border-slate-200/80 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 pb-3 pt-5 px-6">
              <CardTitle className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-violet-600" />
                </div>
                聯絡資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">家長/監護人姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="姓名" value={parentName} onChange={e => setParentName(e.target.value)}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 ${errors.parentName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentName" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">聯絡電話 <span className="text-red-500">*</span></Label>
                  <Input type="tel" inputMode="numeric" placeholder="98765432" maxLength={8}
                    value={parentPhone} onChange={e => setParentPhone(e.target.value.replace(/\D/g, ''))}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 ${errors.parentPhone ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentPhone" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">第二聯絡電話</Label>
                  <Input type="tel" inputMode="numeric" placeholder="選填" maxLength={8}
                    value={parentPhone2} onChange={e => setParentPhone2(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 h-11 rounded-xl border-slate-200" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Email <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="example@email.com"
                    value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 ${errors.parentEmail ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentEmail" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Facebook <span className="text-red-500">*</span></Label>
                  <Input placeholder="如沒有請填「沒有」" value={facebook} onChange={e => setFacebook(e.target.value)}
                    className={`mt-1.5 h-11 rounded-xl border-slate-200 ${errors.facebook ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="facebook" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">介紹人</Label>
                  <Input placeholder="選填" value={referrer} onChange={e => setReferrer(e.target.value)}
                    className="mt-1.5 h-11 rounded-xl border-slate-200" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">住址 <span className="text-red-500">*</span></Label>
                <Input placeholder="完整住址" value={address} onChange={e => setAddress(e.target.value)}
                  className={`mt-1.5 h-11 rounded-xl border-slate-200 ${errors.address ? 'border-red-400 bg-red-50/50' : ''}`} />
                <FieldError name="address" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 4: 繳費 ═══ */}
          <Card className="rounded-3xl shadow-lg shadow-amber-500/5 border border-slate-200/80 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 pb-3 pt-5 px-6">
              <CardTitle className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                </div>
                繳費資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 bg-white">
              {/* 費用明細 */}
              {feeBreakdown && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 px-5 py-3">
                    <p className="text-sm font-bold text-white">費用明細</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">學費（3個月）</span>
                      <span className="font-semibold text-slate-800">${feeBreakdown.tuition.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">道袍</span>
                      <span className="font-semibold text-slate-800">$400</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">手把</span>
                      <span className="font-semibold text-slate-800">$150</span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between items-center">
                      <span className="text-base font-bold text-slate-900">合計</span>
                      <span className="text-2xl font-black text-red-600">${feeBreakdown.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 轉帳資料 */}
              {paymentMethodsQuery.data && paymentMethodsQuery.data.length > 0 && (
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-5">
                  <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white text-[10px] font-bold">$</span>
                    轉帳資料
                  </p>
                  <div className="space-y-3">
                    {paymentMethodsQuery.data.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white/80 rounded-xl p-3 border border-blue-100">
                        <span className="mt-0.5 bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap">
                          {m.type === 'fps' ? 'FPS' : '銀行'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 font-semibold text-sm">{m.bankName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-slate-800 font-mono text-base font-bold tracking-wide">{m.account}</p>
                            <button type="button"
                              onClick={() => { navigator.clipboard.writeText(m.account); setCopiedAccount(m.account); setTimeout(() => setCopiedAccount(''), 2000); }}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-200">
                              {copiedAccount === m.account
                                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                : <Copy className="w-4 h-4 text-blue-600" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-blue-700/70 mt-2">帳戶名稱：{paymentMethodsQuery.data[0]?.name}</p>
                  </div>
                </div>
              )}

              {/* 轉帳方式 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">轉帳至哪間銀行？</Label>
                <div className="flex gap-3 mt-2">
                  {[{ v: 'BOC', l: '中國銀行' }, { v: 'HSBC', l: '匯豐銀行' }].map(b => (
                    <button key={b.v} type="button" onClick={() => setReceivingBank(b.v)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${receivingBank === b.v ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm shadow-amber-500/10' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {b.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 收據上傳 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">繳費收據 <span className="text-red-500">*</span></Label>
                <p className="text-xs text-slate-400 mt-0.5">轉帳後請上傳截圖或收據照片</p>
                {receiptFile ? (
                  <div className="relative mt-3 rounded-2xl overflow-hidden border-2 border-slate-200">
                    <img src={receiptFile.preview} alt="收據" className="w-full max-h-60 object-contain bg-slate-50" />
                    <button type="button"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()}
                    className={`mt-3 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-all ${errors.receipt ? 'border-red-300 bg-red-50/30' : 'border-slate-300'}`}>
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center mb-3">
                      <Camera className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 font-semibold">點擊上傳收據</p>
                    <p className="text-xs text-slate-400 mt-1">支援 JPG、PNG，最大 10MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                <FieldError name="receipt" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 5: 其他 ═══ */}
          <Card className="rounded-3xl shadow-lg shadow-slate-500/5 border border-slate-200/80 overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 pb-3 pt-5 px-6">
              <CardTitle className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-slate-600" />
                </div>
                其他資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 bg-white">
              {/* 從何得知 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">請問在那裡知道我們既課程？ <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {HOW_KNOW_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => { setHowDidYouHear(opt); setHowDidYouHearOther(''); }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${howDidYouHear === opt ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {opt}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setHowDidYouHear('其他')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${howDidYouHear === '其他' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                      其他
                    </button>
                    {howDidYouHear === '其他' && (
                      <Input placeholder="請說明" value={howDidYouHearOther}
                        onChange={e => setHowDidYouHearOther(e.target.value)}
                        className="w-36 h-10 rounded-xl text-sm border-slate-200" />
                    )}
                  </div>
                </div>
                <FieldError name="howDidYouHear" />
              </div>

              {/* 身體狀況 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">特殊身體狀況 / 過敏</Label>
                <Textarea placeholder="選填，如有任何需注意事項" value={medicalConditions}
                  onChange={e => setMedicalConditions(e.target.value)} rows={2}
                  className="mt-1.5 rounded-xl resize-none border-slate-200" />
              </div>

              {/* 備註 */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">其他備註</Label>
                <Textarea placeholder="選填" value={remarks} onChange={e => setRemarks(e.target.value)}
                  rows={2} className="mt-1.5 rounded-xl resize-none border-slate-200" />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button type="submit"
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-700 hover:via-red-600 hover:to-orange-600 shadow-xl shadow-red-500/25 transition-all duration-200 border-0"
            disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />提交中...</span>
            ) : "提交報名 →"}
          </Button>

          {submitMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm text-center">
              提交失敗：{submitMutation.error?.message || '請稍後再試'}
            </div>
          )}

          <p className="text-center text-xs text-slate-400 pb-6">
            所有資料只用作報名用途，絕對保密
          </p>
        </form>
      </div>
    </div>
  );
}
