import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

// 跆拳道色帶順序
const BELT_ORDER = [
  '白帶', '黃帶', '黃綠帶', '綠帶', '綠藍帶',
  '藍帶', '藍紅帶', '紅帶', '紅黑帶',
  '黑帶', '黑帶1段', '黑帶2段', '黑帶3段', '黑帶4段',
];

// 教練名單
const COACH_LIST = ['賴政堡教練', '鄺富華教練', '林學曉教練', '何翰錕教練', '許悠教練'];

interface StudentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  onSuccess: () => void;
}

export function StudentEditDialog({ open, onOpenChange, student, onSuccess }: StudentEditDialogProps) {
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
    coach: "",
    joinDate: "", // 入學日期（第一堂課日期）
  });

  // 查詢所有道場資料
  const { data: dojos = [] } = trpc.dojos.getAll.useQuery();

  // 根據選擇的道場和上課日,過濾可用的上課時間
  const availableScheduleTimes = dojos
    .filter(dojo => dojo.name === formData.venue && dojo.scheduleDay === formData.scheduleDay)
    .map(dojo => dojo.scheduleTime)
    .filter((time, index, self) => time && self.indexOf(time) === index); // 去重

  // 獲取所有獨特的道場名稱
  const uniqueVenues = Array.from(new Set(dojos.map(dojo => dojo.name).filter(Boolean)));

  // 根據選擇的道場,獲取可用的上課日
  const availableScheduleDays = dojos
    .filter(dojo => dojo.name === formData.venue)
    .map(dojo => dojo.scheduleDay)
    .filter((day, index, self) => day && self.indexOf(day) === index); // 去重

  const updateMutation = trpc.students.update.useMutation({
    onSuccess: async () => {
      toast.success("學生資料已更新，全系統已同步");

      // 全面刷新所有相關緩存，確保全系統同步
      await Promise.all([
        utils.students.getAll.invalidate(),
        utils.students.getAllNextUnpaidQuarters.invalidate(),
        utils.payments.getAllWithStudents.invalidate(),
        utils.payments.getQuarterlyStatuses.invalidate(),
        utils.payments.getMonthlyStatuses.invalidate(),
        utils.users.getQuarterlyStats.invalidate(),
        utils.users.getUnpaidStudentsForQuarter.invalidate(),
        utils.coachStats.getAll.invalidate(),
        utils.coachStats.getMonthlyFinance.invalidate(),
      ]);

      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || "",
        phone: student.phone || "",
        venue: student.venue || "",
        scheduleDay: student.scheduleDay || "",
        scheduleTime: student.scheduleTime || "",
        feePerQuarter: student.feePerQuarter || "",
        beltLevel: student.beltLevel || "",
        birthDate: student.birthDate ? new Date(student.birthDate).toISOString().split('T')[0] : "",
        coach: student.coach || "",
        joinDate: student.joinDate ? new Date(student.joinDate).toISOString().split('T')[0] : "",
      });
    }
  }, [student]);

  const handleSubmit = () => {
    if (!student) return;
    if (!formData.name.trim()) {
      toast.error("請輸入學生姓名");
      return;
    }

    updateMutation.mutate({
      id: student.id,
      ...formData,
      birthDate: formData.birthDate || null,
      joinDate: formData.joinDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            編輯學生資料 — {student?.name}
          </DialogTitle>
          <DialogDescription>
            修改後將即時同步至全系統（繳費記錄、教練統計、財務報表等）
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 姓名 + 電話 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話 *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* 出生日期 + 入學日期 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">出生日期</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinDate">入學日期（第一堂課）</Label>
              <Input
                id="joinDate"
                type="date"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              />
              {formData.joinDate && (() => {
                const join = new Date(formData.joinDate);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
                const weeksElapsed = Math.floor(diffDays / 7);
                const classesEstimate = Math.min(weeksElapsed, 12);
                return (
                  <p className="text-xs text-muted-foreground">
                    入學 {diffDays} 天，約 {classesEstimate}/12 堂
                    {classesEstimate >= 12 && ' ✅ 已完成一期'}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* 色帶級數 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="beltLevel">色帶級數</Label>
              <Select
                value={formData.beltLevel || "_none"}
                onValueChange={(value) => setFormData({ ...formData, beltLevel: value === "_none" ? "" : value })}
              >
                <SelectTrigger id="beltLevel">
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
            <Label htmlFor="coach">負責教練</Label>
            <Select
              value={formData.coach || "_none"}
              onValueChange={(value) => setFormData({ ...formData, coach: value === "_none" ? "" : value })}
            >
              <SelectTrigger id="coach">
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
            <Label htmlFor="venue">道場 *</Label>
            <Select
              value={formData.venue}
              onValueChange={(value) => setFormData({ ...formData, venue: value, scheduleDay: "", scheduleTime: "" })}
            >
              <SelectTrigger id="venue">
                <SelectValue placeholder="選擇道場" />
              </SelectTrigger>
              <SelectContent>
                {uniqueVenues.map((venue) => (
                  <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 上課日 + 上課時間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduleDay">上課日</Label>
              <Select
                value={formData.scheduleDay}
                onValueChange={(value) => setFormData({ ...formData, scheduleDay: value, scheduleTime: "" })}
                disabled={!formData.venue}
              >
                <SelectTrigger id="scheduleDay">
                  <SelectValue placeholder={formData.venue ? "選擇上課日" : "請先選擇道場"} />
                </SelectTrigger>
                <SelectContent>
                  {availableScheduleDays.map((day) => (
                    <SelectItem key={day!} value={day!}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleTime">上課時間</Label>
              <Select
                value={formData.scheduleTime}
                onValueChange={(value) => setFormData({ ...formData, scheduleTime: value })}
                disabled={!formData.venue || !formData.scheduleDay}
              >
                <SelectTrigger id="scheduleTime">
                  <SelectValue placeholder={formData.venue && formData.scheduleDay ? "選擇上課時間" : "請先選擇道場和上課日"} />
                </SelectTrigger>
                <SelectContent>
                  {availableScheduleTimes.map((time) => (
                    <SelectItem key={time!} value={time!}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 每季學費 */}
          <div className="space-y-2">
            <Label htmlFor="feePerQuarter">每季學費 *</Label>
            <Input
              id="feePerQuarter"
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
          <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                更新中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                儲存變更
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
