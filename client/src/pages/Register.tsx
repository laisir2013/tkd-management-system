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
import { CheckCircle2, Loader2, Camera, X, User, MapPin, BookOpen, Phone, CreditCard, HelpCircle } from "lucide-react";

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
      label: `${s.day} ${s.time}${s.coach ? ` (${s.coach}教練)` : ''}`,
    }));
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
      tuitionAmount: tuitionAmount ? Number(tuitionAmount) : undefined,
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
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">報名成功！</h2>
          </div>
          <CardContent className="pt-6 pb-8 text-center space-y-4">
            <p className="text-gray-600">
              已收到 <strong>{studentName}</strong> 的報名資料及繳費收據。
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-700 leading-relaxed">
              <p className="font-medium mb-1">後續安排：</p>
              <p>管理員將於 1-2 個工作天內核實收據並確認報名，確認後會透過 WhatsApp 通知您。</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-2 rounded-full px-6">
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-lg shadow-red-500/30 mb-4">
            <span className="text-3xl">🥋</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">創武跆拳道館</h1>
          <p className="text-slate-300 text-base">新生報名表</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
            <span>📱 9483 9882</span>
            <span>•</span>
            <a href="https://www.facebook.com/chongmotkd" target="_blank" rel="noopener" className="hover:text-white transition-colors">Facebook</a>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-12 -mt-2">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ═══ Section 1: 學生資料 ═══ */}
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-white text-base font-semibold">
                <User className="w-4 h-4" /> 學生資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* 中文名 + 英文名 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">中文姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="陳大文" value={studentName} onChange={e => setStudentName(e.target.value)}
                    className={`mt-1.5 rounded-lg ${errors.studentName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="studentName" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">英文姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="Chan Tai Man" value={englishName} onChange={e => setEnglishName(e.target.value)}
                    className={`mt-1.5 rounded-lg ${errors.englishName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="englishName" />
                </div>
              </div>

              {/* 性別 + 出生日期 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">性別 <span className="text-red-500">*</span></Label>
                  <div className="flex gap-3 mt-2">
                    {[{ v: 'male', l: '男' }, { v: 'female', l: '女' }].map(g => (
                      <button key={g.v} type="button"
                        onClick={() => setStudentGender(g.v)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${studentGender === g.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {g.l}
                      </button>
                    ))}
                  </div>
                  <FieldError name="studentGender" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">出生日期 <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    <Select value={studentBirthYear} onValueChange={setStudentBirthYear}>
                      <SelectTrigger className={`rounded-lg text-xs ${errors.birthDate ? 'border-red-400' : ''}`}><SelectValue placeholder="年" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 30 }, (_, i) => currentYear - i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={studentBirthMonth} onValueChange={setStudentBirthMonth}>
                      <SelectTrigger className={`rounded-lg text-xs ${errors.birthDate ? 'border-red-400' : ''}`}><SelectValue placeholder="月" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m}月</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={studentBirthDay} onValueChange={setStudentBirthDay}>
                      <SelectTrigger className={`rounded-lg text-xs ${errors.birthDate ? 'border-red-400' : ''}`}><SelectValue placeholder="日" /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 31 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}日</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <FieldError name="birthDate" />
                </div>
              </div>

              {/* 色帶 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">現時色帶 <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {BELT_LEVELS.map(belt => (
                    <button key={belt} type="button"
                      onClick={() => setBeltLevel(belt)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all ${beltLevel === belt ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {belt}
                    </button>
                  ))}
                </div>
                <FieldError name="beltLevel" />
              </div>

              {/* 道袍尺寸 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">跆拳道袍尺寸 <span className="text-red-500">*</span></Label>
                <p className="text-xs text-slate-400 mt-0.5">新生專用，可多選</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                  {DOBOK_SIZES.map(size => (
                    <button key={size} type="button"
                      onClick={() => setDobokSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${dobokSizes.includes(size) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {size}
                    </button>
                  ))}
                </div>
                <FieldError name="dobokSize" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 2: 上課安排 ═══ */}
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-white text-base font-semibold">
                <MapPin className="w-4 h-4" /> 上課安排
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* 上課地點 — Step 1 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">上課地點 <span className="text-red-500">*</span></Label>
                {dojosQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> 載入中...</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {locationNames.map(name => (
                      <button key={name} type="button"
                        onClick={() => { setSelectedLocation(name); setSelectedDojoId(''); setFirstClassDate(''); setFirstClassDateCustom(''); }}
                        className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${selectedLocation === name ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <FieldError name="preferredDojo" />
              </div>

              {/* 上課時間 — Step 2 (cascaded from location) */}
              {selectedLocation && filteredSchedules.length > 0 && (
                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium text-slate-700">上課時間 <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2">{selectedLocation} 可選時段</p>
                  <div className="space-y-2">
                    {filteredSchedules.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setSelectedDojoId(s.id); setFirstClassDate(''); setFirstClassDateCustom(''); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm border-2 transition-all ${selectedDojoId === s.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'}`}>
                        <span className="font-medium">{s.day} {s.time}</span>
                        {s.coach && <span className="text-slate-400 ml-2">({s.coach}教練)</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 首堂日期 */}
              {selectedDojoId && (
                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium text-slate-700">首堂日期 <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2">選擇第一次上課的日期</p>
                  <div className="flex flex-wrap gap-2">
                    {firstClassDateOptions.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { setFirstClassDate(opt.value); setFirstClassDateCustom(''); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${firstClassDate === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setFirstClassDate('__custom__')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${firstClassDate === '__custom__' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        自選
                      </button>
                      {firstClassDate === '__custom__' && (
                        <Input type="date" value={firstClassDateCustom}
                          onChange={e => setFirstClassDateCustom(e.target.value)}
                          className="w-40 h-9 rounded-lg text-sm" />
                      )}
                    </div>
                  </div>
                  <FieldError name="firstClassDate" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ Section 3: 聯絡資料 ═══ */}
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-violet-600 to-purple-600 pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-white text-base font-semibold">
                <Phone className="w-4 h-4" /> 聯絡資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">家長/監護人姓名 <span className="text-red-500">*</span></Label>
                  <Input placeholder="姓名" value={parentName} onChange={e => setParentName(e.target.value)}
                    className={`mt-1.5 rounded-lg ${errors.parentName ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentName" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">聯絡電話 <span className="text-red-500">*</span></Label>
                  <Input type="tel" inputMode="numeric" placeholder="98765432" maxLength={8}
                    value={parentPhone} onChange={e => setParentPhone(e.target.value.replace(/\D/g, ''))}
                    className={`mt-1.5 rounded-lg ${errors.parentPhone ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentPhone" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">第二聯絡電話</Label>
                  <Input type="tel" inputMode="numeric" placeholder="選填" maxLength={8}
                    value={parentPhone2} onChange={e => setParentPhone2(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 rounded-lg" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="example@email.com"
                    value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                    className={`mt-1.5 rounded-lg ${errors.parentEmail ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="parentEmail" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Facebook <span className="text-red-500">*</span></Label>
                  <Input placeholder="如沒有請填「沒有」" value={facebook} onChange={e => setFacebook(e.target.value)}
                    className={`mt-1.5 rounded-lg ${errors.facebook ? 'border-red-400 bg-red-50/50' : ''}`} />
                  <FieldError name="facebook" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">介紹人</Label>
                  <Input placeholder="選填" value={referrer} onChange={e => setReferrer(e.target.value)}
                    className="mt-1.5 rounded-lg" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">住址 <span className="text-red-500">*</span></Label>
                <Input placeholder="完整住址" value={address} onChange={e => setAddress(e.target.value)}
                  className={`mt-1.5 rounded-lg ${errors.address ? 'border-red-400 bg-red-50/50' : ''}`} />
                <FieldError name="address" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 4: 繳費 ═══ */}
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-white text-base font-semibold">
                <CreditCard className="w-4 h-4" /> 繳費資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">繳費金額 (HKD)</Label>
                  <Input type="number" inputMode="numeric" placeholder="例：1800"
                    value={tuitionAmount} onChange={e => setTuitionAmount(e.target.value)}
                    className="mt-1.5 rounded-lg" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">轉帳至</Label>
                  <div className="flex gap-2 mt-1.5">
                    {[{ v: 'BOC', l: '中銀' }, { v: 'HSBC', l: '滙豐' }, { v: 'CASH', l: '現金' }].map(b => (
                      <button key={b.v} type="button" onClick={() => setReceivingBank(b.v)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-medium border-2 transition-all ${receivingBank === b.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {b.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 收據上傳 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">繳費收據 <span className="text-red-500">*</span></Label>
                {receiptFile ? (
                  <div className="relative mt-2 rounded-xl overflow-hidden border">
                    <img src={receiptFile.preview} alt="收據" className="w-full max-h-52 object-contain bg-slate-50" />
                    <button type="button"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()}
                    className={`mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-all ${errors.receipt ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                    <Camera className="w-8 h-8 mx-auto text-slate-400 mb-1.5" />
                    <p className="text-sm text-slate-600 font-medium">點擊上傳收據</p>
                    <p className="text-xs text-slate-400 mt-0.5">JPG、PNG，最大 10MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                <FieldError name="receipt" />
              </div>
            </CardContent>
          </Card>

          {/* ═══ Section 5: 其他 ═══ */}
          <Card className="rounded-2xl shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-white text-base font-semibold">
                <HelpCircle className="w-4 h-4" /> 其他資料
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* 從何得知 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">請問在那裡知道我們既課程？ <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {HOW_KNOW_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => { setHowDidYouHear(opt); setHowDidYouHearOther(''); }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${howDidYouHear === opt ? 'border-slate-700 bg-slate-100 text-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {opt}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setHowDidYouHear('其他')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${howDidYouHear === '其他' ? 'border-slate-700 bg-slate-100 text-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      其他
                    </button>
                    {howDidYouHear === '其他' && (
                      <Input placeholder="請說明" value={howDidYouHearOther}
                        onChange={e => setHowDidYouHearOther(e.target.value)}
                        className="w-32 h-9 rounded-lg text-sm" />
                    )}
                  </div>
                </div>
                <FieldError name="howDidYouHear" />
              </div>

              {/* 身體狀況 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">特殊身體狀況 / 過敏</Label>
                <Textarea placeholder="選填，如有任何需注意事項" value={medicalConditions}
                  onChange={e => setMedicalConditions(e.target.value)} rows={2}
                  className="mt-1.5 rounded-lg resize-none" />
              </div>

              {/* 備註 */}
              <div>
                <Label className="text-sm font-medium text-slate-700">其他備註</Label>
                <Textarea placeholder="選填" value={remarks} onChange={e => setRemarks(e.target.value)}
                  rows={2} className="mt-1.5 rounded-lg resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button type="submit"
            className="w-full h-13 text-base font-bold rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-xl shadow-red-500/20 transition-all"
            disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />提交中...</span>
            ) : "提交報名"}
          </Button>

          {submitMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm text-center">
              提交失敗：{submitMutation.error?.message || '請稍後再試'}
            </div>
          )}

          <p className="text-center text-xs text-slate-500 pb-4">
            所有資料只用作報名用途，絕對保密
          </p>
        </form>
      </div>
    </div>
  );
}
