import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, Loader2, Calculator, Plus, X, Check, Upload } from "lucide-react";
import { calcNewStudentProRata, formatDateShort, WEEKDAY_NAMES } from "@/lib/newStudentCalc";
import { Checkbox } from "@/components/ui/checkbox";

// 跆拳道色帶順序
const BELT_ORDER = [
  '白帶', '黃帶', '黃綠帶', '綠帶', '綠藍帶',
  '藍帶', '藍紅帶', '紅帶', '紅黑帶',
  '黑帶', '黑帶1段', '黑帶2段', '黑帶3段', '黑帶4段',
];

// 教練名單
const COACH_LIST = ['賴政堡教練', '鄺富華教練', '林學曉教練', '何翰錕教練', '許悠教練'];

interface StudentAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function StudentAddDialog({ open, onOpenChange, onSuccess }: StudentAddDialogProps) {
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    venue: "",
    scheduleDay: "",
    scheduleTime: "",
    feePerQuarter: "",
    beltLevel: "",
    birthDate: "",
    coach: "賴政堡教練",
    joinDate: "", // 入學日期（第一堂課日期）
  });

  // 首期費用狀態
  const [firstPayment, setFirstPayment] = useState({
    enabled: false,
    includeTuition: true,
    includeDobok: false, // 道袍 $400
    includeMitt: false,  // 手把 $150
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [receiptFile, setReceiptFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);

  // 計算首期總金額
  const DOBOK_PRICE = 400;
  const MITT_PRICE = 150;
  const tuitionAmount = parseFloat(formData.feePerQuarter) || 0;
  const firstPaymentTotal = (
    (firstPayment.includeTuition ? tuitionAmount : 0) +
    (firstPayment.includeDobok ? DOBOK_PRICE : 0) +
    (firstPayment.includeMitt ? MITT_PRICE : 0)
  );

  // 教練分成計算
  const DOBOK_COACH_COMMISSION = 200;  // 道袍教練分 $200
  const MITT_COACH_RATE = 0.65;        // 手把教練分 65%
  const mittCoachCommission = MITT_PRICE * MITT_COACH_RATE; // $97.5
  const totalCoachCommission = (
    (firstPayment.includeDobok ? DOBOK_COACH_COMMISSION : 0) +
    (firstPayment.includeMitt ? mittCoachCommission : 0)
  );

  // 查詢所有道場資料
  const { data: dojos = [] } = trpc.dojos.getAll.useQuery();

  // 根據選擇的道場和上課日,過濾可用的上課時間
  const availableScheduleTimes = dojos
    .filter(dojo => dojo.name === formData.venue && dojo.scheduleDay === formData.scheduleDay)
    .map(dojo => dojo.scheduleTime)
    .filter((time, index, self) => time && self.indexOf(time) === index);

  // 獲取所有獨特的道場名稱
  const uniqueVenues = Array.from(new Set(dojos.map(dojo => dojo.name).filter(Boolean)));

  // 根據選擇的道場,獲取可用的上課日
  const availableScheduleDays = dojos
    .filter(dojo => dojo.name === formData.venue)
    .map(dojo => dojo.scheduleDay)
    .filter((day, index, self) => day && self.indexOf(day) === index);

  const createMutation = trpc.students.create.useMutation({
    onSuccess: async () => {
      toast.success(`成功新增學生: ${formData.name}`);

      // 刷新所有相關緩存
      await Promise.all([
        utils.students.getAll.invalidate(),
        utils.students.getAllNextUnpaidQuarters.invalidate(),
        utils.payments.getAllWithStudents.invalidate(),
      ]);

      onSuccess();
      onOpenChange(false);
      // 重置表單
      setFormData({
        name: "",
        phone: "",
        venue: "",
        scheduleDay: "",
        scheduleTime: "",
        feePerQuarter: "",
        beltLevel: "",
        birthDate: "",
        coach: "賴政堡教練",
        joinDate: "",
      });
      setFirstPayment({ enabled: false, includeTuition: true, includeDobok: false, includeMitt: false, paymentDate: new Date().toISOString().slice(0, 10) });
      setReceiptFile(null);
    },
    onError: (error) => {
      toast.error(`新增失敗: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("請輸入學生姓名");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("請輸入電話號碼");
      return;
    }
    if (!formData.venue) {
      toast.error("請選擇道場");
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      venue: formData.venue,
      scheduleDay: formData.scheduleDay || undefined,
      scheduleTime: formData.scheduleTime || undefined,
      feePerQuarter: formData.feePerQuarter || "0",
      beltLevel: formData.beltLevel || undefined,
      birthDate: formData.birthDate || null,
      coach: formData.coach || undefined,
      joinDate: formData.joinDate || null,
      // 首期費用
      firstPayment: firstPayment.enabled ? {
        includeTuition: firstPayment.includeTuition,
        tuitionAmount: firstPayment.includeTuition ? tuitionAmount : 0,
        includeDobok: firstPayment.includeDobok,
        dobokAmount: DOBOK_PRICE,
        includeMitt: firstPayment.includeMitt,
        mittAmount: MITT_PRICE,
        totalAmount: firstPaymentTotal,
        paymentDate: firstPayment.paymentDate,
        receiptBase64: receiptFile?.base64,
        receiptMimeType: receiptFile?.mimeType,
      } : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            新增學生
          </DialogTitle>
          <DialogDescription>
            填寫學生資料後點擊「確認新增」即可加入系統
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 姓名 + 電話 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">姓名 *</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: 李明"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">電話 *</Label>
              <Input
                id="add-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="例如: 90971420"
              />
            </div>
          </div>

          {/* 出生日期 + 入學日期 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-birthDate">出生日期</Label>
              <Input
                id="add-birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-joinDate">入學日期（第一堂課）</Label>
              <Input
                id="add-joinDate"
                type="date"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">新生入學日期，用於計算下一期按比例收費</p>
            </div>
          </div>

          {/* 新生費用計算預覽 */}
          {formData.joinDate && formData.scheduleDay && parseFloat(formData.feePerQuarter) > 0 && (() => {
            const calc = calcNewStudentProRata(formData.joinDate, formData.scheduleDay, parseFloat(formData.feePerQuarter));
            if (!calc) return null;
            return (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                  <Calculator className="w-4 h-4" />
                  新生費用計算
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-700">
                    <span>第 1 堂課</span>
                    <span className="font-medium">{formatDateShort(calc.firstClassDate)} (星期{WEEKDAY_NAMES[calc.firstClassDate.getDay()]})</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>第 12 堂課（循環結束）</span>
                    <span className="font-medium">{formatDateShort(calc.class12Date)} (星期{WEEKDAY_NAMES[calc.class12Date.getDay()]})</span>
                  </div>
                  <div className="border-t border-blue-200 my-1" />
                  <div className="flex justify-between text-gray-700">
                    <span>循環後第 1 堂</span>
                    <span className="font-medium">{formatDateShort(calc.nextClassAfterCycle)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>落入季度</span>
                    <span className="font-medium">{calc.nextQuarterLabel}</span>
                  </div>
                  <div className="border-t border-blue-200 my-1" />
                  {calc.isFullQuarter ? (
                    <div className="flex justify-between items-center text-green-700 font-medium">
                      <span>下期費用（整季）</span>
                      <span className="text-base">${calc.proRataFee.toLocaleString()}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-gray-700">
                        <span>計費月份</span>
                        <span className="font-medium">
                          {calc.monthsCharged} 個月（{calc.nextQuarterMonths.slice(3 - calc.monthsCharged).map(m => `${m}月`).join('、')}）
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-orange-700 font-bold">
                        <span>下期費用（按比例）</span>
                        <span className="text-base">${calc.proRataFee.toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        ${calc.monthlyFee.toLocaleString()} × {calc.monthsCharged}月{calc.overlapClasses > 0 ? ` - ${calc.overlapClasses}堂$${calc.overlapDeduction}` : ''} = ${calc.proRataFee.toLocaleString()}
                      </div>
                      {calc.feeNote && (
                        <div className="text-[10px] text-orange-600 mt-0.5">
                          {calc.feeNote}
                        </div>
                      )}
                      <p className="text-[10px] text-blue-600 mt-1">
                        * 新生首 12 堂為入門期，之後按剩餘月份收費，再下一期起正常按季繳 ${parseFloat(formData.feePerQuarter).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 色帶級數 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-beltLevel">色帶級數</Label>
              <Select
                value={formData.beltLevel || "_none"}
                onValueChange={(value) => setFormData({ ...formData, beltLevel: value === "_none" ? "" : value })}
              >
                <SelectTrigger id="add-beltLevel">
                  <SelectValue placeholder="選擇色帶" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未設定</SelectItem>
                  {BELT_ORDER.map((belt) => (
                    <SelectItem key={belt} value={belt}>{belt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 教練 */}
          <div className="space-y-2">
            <Label htmlFor="add-coach">負責教練</Label>
            <Select
              value={formData.coach || "_none"}
              onValueChange={(value) => setFormData({ ...formData, coach: value === "_none" ? "" : value })}
            >
              <SelectTrigger id="add-coach">
                <SelectValue placeholder="選擇教練" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">未指定</SelectItem>
                {COACH_LIST.map((coach) => (
                  <SelectItem key={coach} value={coach}>{coach}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 道場 */}
          <div className="space-y-2">
            <Label htmlFor="add-venue">道場 *</Label>
            <Select
              value={formData.venue || "_none"}
              onValueChange={(value) => setFormData({ ...formData, venue: value === "_none" ? "" : value, scheduleDay: "", scheduleTime: "" })}
            >
              <SelectTrigger id="add-venue">
                <SelectValue placeholder="選擇道場" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">請選擇道場</SelectItem>
                {uniqueVenues.map((venue) => (
                  <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 上課日 + 上課時間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-scheduleDay">上課日</Label>
              <Select
                value={formData.scheduleDay || "_none"}
                onValueChange={(value) => setFormData({ ...formData, scheduleDay: value === "_none" ? "" : value, scheduleTime: "" })}
                disabled={!formData.venue}
              >
                <SelectTrigger id="add-scheduleDay">
                  <SelectValue placeholder={formData.venue ? "選擇上課日" : "請先選擇道場"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未指定</SelectItem>
                  {availableScheduleDays.map((day) => (
                    <SelectItem key={day!} value={day!}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-scheduleTime">上課時間</Label>
              <Select
                value={formData.scheduleTime || "_none"}
                onValueChange={(value) => setFormData({ ...formData, scheduleTime: value === "_none" ? "" : value })}
                disabled={!formData.venue || !formData.scheduleDay}
              >
                <SelectTrigger id="add-scheduleTime">
                  <SelectValue placeholder={formData.venue && formData.scheduleDay ? "選擇上課時間" : "請先選擇道場和上課日"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未指定</SelectItem>
                  {availableScheduleTimes.map((time) => (
                    <SelectItem key={time!} value={time!}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 每季學費 */}
          <div className="space-y-2">
            <Label htmlFor="add-feePerQuarter">每季學費</Label>
            <Input
              id="add-feePerQuarter"
              value={formData.feePerQuarter}
              onChange={(e) => setFormData({ ...formData, feePerQuarter: e.target.value })}
              placeholder="例如: 1800"
            />
          </div>

          {/* 首期費用區塊 */}
          <div className="border-t pt-4 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="first-payment-enabled"
                checked={firstPayment.enabled}
                onCheckedChange={(checked) => setFirstPayment(p => ({ ...p, enabled: !!checked }))}
              />
              <Label htmlFor="first-payment-enabled" className="text-sm font-medium cursor-pointer">
                已繳交首期費用
              </Label>
            </div>

            {firstPayment.enabled && (
              <div className="space-y-3 pl-1">
                {/* 費用項目勾選 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="fp-tuition"
                        checked={firstPayment.includeTuition}
                        onCheckedChange={(checked) => setFirstPayment(p => ({ ...p, includeTuition: !!checked }))}
                      />
                      <Label htmlFor="fp-tuition" className="text-sm cursor-pointer">學費（首期）</Label>
                    </div>
                    <span className="text-sm font-medium text-blue-700">
                      {tuitionAmount > 0 ? `$${tuitionAmount.toLocaleString()}` : '請填寫學費'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-orange-50 border border-orange-100">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="fp-dobok"
                        checked={firstPayment.includeDobok}
                        onCheckedChange={(checked) => setFirstPayment(p => ({ ...p, includeDobok: !!checked }))}
                      />
                      <Label htmlFor="fp-dobok" className="text-sm cursor-pointer">道袍</Label>
                    </div>
                    <span className="text-sm font-medium text-orange-700">${DOBOK_PRICE}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-orange-50 border border-orange-100">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="fp-mitt"
                        checked={firstPayment.includeMitt}
                        onCheckedChange={(checked) => setFirstPayment(p => ({ ...p, includeMitt: !!checked }))}
                      />
                      <Label htmlFor="fp-mitt" className="text-sm cursor-pointer">練習手把</Label>
                    </div>
                    <span className="text-sm font-medium text-orange-700">${MITT_PRICE}</span>
                  </div>
                </div>

                {/* 總金額 */}
                {firstPaymentTotal > 0 && (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">首期總金額</span>
                      <span className="text-lg font-bold text-green-700">${firstPaymentTotal.toLocaleString()}</span>
                    </div>
                    {(firstPayment.includeDobok || firstPayment.includeMitt) && (
                      <div className="mt-1.5 pt-1.5 border-t border-green-200 text-[10px] text-green-600">
                        <span>教練用品分成：</span>
                        {firstPayment.includeDobok && <span className="ml-1">道袍 ${DOBOK_COACH_COMMISSION}</span>}
                        {firstPayment.includeMitt && <span className="ml-1">手把 ${mittCoachCommission}</span>}
                        <span className="ml-1 font-medium">合計 ${totalCoachCommission}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-green-600">
                      會計拆分：
                      {firstPayment.includeTuition && <span className="ml-1">學費 ${tuitionAmount.toLocaleString()}</span>}
                      {(firstPayment.includeDobok || firstPayment.includeMitt) && (
                        <span className="ml-1">用品 ${((firstPayment.includeDobok ? DOBOK_PRICE : 0) + (firstPayment.includeMitt ? MITT_PRICE : 0)).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 付款日期 */}
                <div className="space-y-1">
                  <Label className="text-xs">付款日期</Label>
                  <Input
                    type="date"
                    value={firstPayment.paymentDate}
                    onChange={(e) => setFirstPayment(p => ({ ...p, paymentDate: e.target.value }))}
                    className="h-9"
                  />
                </div>

                {/* 收據上傳 */}
                <div className="space-y-1">
                  <Label className="text-xs">上傳收據（可選）</Label>
                  {receiptFile ? (
                    <div className="flex items-center gap-2 p-2 border rounded-lg bg-green-50">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 flex-1 truncate">{receiptFile.name}</span>
                      <button type="button" onClick={() => setReceiptFile(null)} className="text-red-500 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">點擊選擇收據圖片</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast.error("檔案不能超過 10MB"); return; }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = reader.result as string;
                            const base64 = result.split(',')[1];
                            setReceiptFile({ base64, mimeType: file.type, name: file.name });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700">
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                新增中...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-1" />
                確認新增
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
