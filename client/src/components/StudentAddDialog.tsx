import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, Loader2, Calculator } from "lucide-react";
import { calcNewStudentProRata, formatDateShort, WEEKDAY_NAMES } from "@/lib/newStudentCalc";

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
                        <span className="text-base">
                          ${calc.monthlyFee.toLocaleString()} × {calc.monthsCharged} = ${calc.proRataFee.toLocaleString()}
                        </span>
                      </div>
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
