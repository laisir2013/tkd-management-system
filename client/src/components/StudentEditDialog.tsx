import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
      toast.success("學生資料已更新");
      await utils.students.getAll.invalidate();
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
      });
    }
  }, [student]);

  const handleSubmit = () => {
    if (!student) return;

    updateMutation.mutate({
      id: student.id,
      ...formData,
      birthDate: formData.birthDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯學生資料</DialogTitle>
          <DialogDescription>
            修改學生的基本資料和班別資訊
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
              <Label htmlFor="beltLevel">級數</Label>
              <Input
                id="beltLevel"
                value={formData.beltLevel}
                onChange={(e) => setFormData({ ...formData, beltLevel: e.target.value })}
                placeholder="例如: 白帶、黃帶"
              />
            </div>
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="feePerQuarter">每季學費 *</Label>
            <Input
              id="feePerQuarter"
              value={formData.feePerQuarter}
              onChange={(e) => setFormData({ ...formData, feePerQuarter: e.target.value })}
              placeholder="例如: 2400"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "更新中..." : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
