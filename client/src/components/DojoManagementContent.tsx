import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

// Coach color configuration
const COACH_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  '賴政堡教練': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  '鄺富華教練': { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  '林學曉教練': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  '何翰錕教練': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  '許悠教練':   { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' },
};
const DEFAULT_COLOR = { bg: '', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' };
function getCoachColor(coach: string) {
  return COACH_COLORS[coach] || DEFAULT_COLOR;
}

type DojoFormData = {
  name: string;
  scheduleDay: string;
  scheduleTime: string;
  coachName: string;
  color: string;
  status: "active" | "inactive";
};

export default function DojoManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDojo, setEditingDojo] = useState<any | null>(null);
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [formData, setFormData] = useState<DojoFormData>({
    name: "",
    scheduleDay: "",
    scheduleTime: "",
    coachName: "",
    color: "#3b82f6",
    status: "active",
  });

  const { data: dojos, refetch } = trpc.dojos.getAll.useQuery();
  const { data: allStudents } = trpc.students.getAll.useQuery();
  const createMutation = trpc.dojos.create.useMutation();
  const updateMutation = trpc.dojos.update.useMutation();
  const deleteMutation = trpc.dojos.delete.useMutation();

  // Coach list from dojos
  const coachList = useMemo(() => {
    if (!dojos) return [];
    const coaches = [...new Set(dojos.map(d => d.coachName).filter(Boolean))];
    return coaches.sort();
  }, [dojos]);

  // Student count per dojo (by dojo_id)
  const studentCountByIdMap = useMemo(() => {
    const map = new Map<number, number>();
    (allStudents || []).forEach(s => {
      if (s.dojoId && s.status === 'active') {
        map.set(s.dojoId, (map.get(s.dojoId) || 0) + 1);
      }
    });
    return map;
  }, [allStudents]);

  // Student count per dojo name (fallback for students without dojo_id)
  const studentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStudents || []).forEach(s => {
      if (s.venue && s.status === 'active' && !s.dojoId) {
        map.set(s.venue, (map.get(s.venue) || 0) + 1);
      }
    });
    return map;
  }, [allStudents]);

  // Filtered dojos
  const filteredDojos = useMemo(() => {
    if (!dojos) return [];
    if (coachFilter === 'all') return dojos;
    return dojos.filter(d => d.coachName === coachFilter);
  }, [dojos, coachFilter]);

  // Get student count for a dojo
  const getDojoStudentCount = (dojo: any) => {
    return (studentCountByIdMap.get(dojo.id) || 0) + (studentCountMap.get(dojo.name) || 0);
  };

  // Summary stats
  const totalStudents = useMemo(() => {
    // Count unique active students across filtered dojos
    return filteredDojos.reduce((sum, d) => sum + getDojoStudentCount(d), 0);
  }, [filteredDojos, studentCountByIdMap, studentCountMap]);

  const handleOpenDialog = (dojo?: any) => {
    if (dojo) {
      setEditingDojo(dojo);
      setFormData({
        name: dojo.name || "",
        scheduleDay: dojo.scheduleDay || "",
        scheduleTime: dojo.scheduleTime || "",
        coachName: dojo.coachName || "",
        color: dojo.color || "#3b82f6",
        status: dojo.status || "active",
      });
    } else {
      setEditingDojo(null);
      setFormData({
        name: "",
        scheduleDay: "",
        scheduleTime: "",
        coachName: "",
        color: "#3b82f6",
        status: "active",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDojo(null);
    setFormData({
      name: "",
      scheduleDay: "",
      scheduleTime: "",
      coachName: "",
      color: "#3b82f6",
      status: "active",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDojo) {
        await updateMutation.mutateAsync({
          id: editingDojo.id,
          ...formData,
        });
        toast.success("道場已更新");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("道場已新增");
      }
      refetch();
      handleCloseDialog();
    } catch (error: any) {
      toast.error(error.message || "操作失敗");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("確定要刪除此道場嗎?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("道場已刪除");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "刪除失敗");
    }
  };

  return (
    <div className="container mx-auto py-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle>道場管理</CardTitle>
              <CardDescription>
                管理所有道場資訊 — 共 {filteredDojos.length} 個道場，{totalStudents} 位學生
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={coachFilter} onValueChange={setCoachFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部教練" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部教練</SelectItem>
                  {coachList.map((coach) => (
                    <SelectItem key={coach} value={coach!}>{coach}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                新增道場
              </Button>
            </div>
          </div>
          {/* Coach color legend */}
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {coachList.map((coach) => {
              const color = getCoachColor(coach!);
              return (
                <span key={coach} className={`px-2 py-1 rounded-full font-medium ${color.badge}`}>
                  {coach}
                </span>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>道場名稱</TableHead>
                <TableHead>上課日</TableHead>
                <TableHead>上課時間</TableHead>
                <TableHead>教練</TableHead>
                <TableHead className="text-center">學生數</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDojos.map((dojo, index) => {
                const color = getCoachColor(dojo.coachName || '');
                const count = getDojoStudentCount(dojo);
                
                return (
                <TableRow key={dojo.id} className={color.bg}>
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell className="font-medium">{dojo.name}</TableCell>
                  <TableCell className="text-sm">{dojo.scheduleDay || <span className="text-gray-400">-</span>}</TableCell>
                  <TableCell className="text-sm">{dojo.scheduleTime || <span className="text-gray-400">-</span>}</TableCell>
                  <TableCell>
                    {dojo.coachName ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color.badge}`}>
                        {dojo.coachName}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className={count > 0 ? 'font-semibold text-green-700' : 'text-gray-400'}>{count}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        dojo.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      {dojo.status === "active" ? "運作中" : "已停用"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(dojo)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(dojo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingDojo ? "編輯道場" : "新增道場"}
              </DialogTitle>
              <DialogDescription>
                填寫道場資訊
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">道場名稱 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coachName">教練</Label>
                <Input
                  id="coachName"
                  value={formData.coachName}
                  onChange={(e) =>
                    setFormData({ ...formData, coachName: e.target.value })
                  }
                  placeholder="例如：賴政堡教練"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="scheduleDay">上課日</Label>
                  <Select
                    value={formData.scheduleDay || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, scheduleDay: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇星期" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      <SelectItem value="星期一">星期一</SelectItem>
                      <SelectItem value="星期二">星期二</SelectItem>
                      <SelectItem value="星期三">星期三</SelectItem>
                      <SelectItem value="星期四">星期四</SelectItem>
                      <SelectItem value="星期五">星期五</SelectItem>
                      <SelectItem value="星期六">星期六</SelectItem>
                      <SelectItem value="星期日">星期日</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduleTime">上課時間</Label>
                  <Input
                    id="scheduleTime"
                    value={formData.scheduleTime}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduleTime: e.target.value })
                    }
                    placeholder="例如：4:00-5:00pm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color">顏色</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">狀態</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "active" | "inactive") =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">運作中</SelectItem>
                      <SelectItem value="inactive">已停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingDojo ? "更新" : "新增"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
