import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [formData, setFormData] = useState<DojoFormData>({
    name: "",
    scheduleDay: "",
    scheduleTime: "",
    coachName: "",
    color: "#3b82f6",
    status: "active",
  });

  const { data: dojos, refetch } = trpc.dojos.getAll.useQuery();
  const createMutation = trpc.dojos.create.useMutation();
  const updateMutation = trpc.dojos.update.useMutation();
  const deleteMutation = trpc.dojos.delete.useMutation();

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
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>道場管理</CardTitle>
              <CardDescription>管理所有道場資訊</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              新增道場
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>道場名稱</TableHead>
                <TableHead>星期</TableHead>
                <TableHead>時段</TableHead>
                <TableHead>教練</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dojos?.map((dojo, index) => {
                // 道場顏色映射
                const venueColors: Record<string, string> = {
                  "寶林道場": "bg-blue-50",
                  "蒲崗村道場": "bg-green-50",
                  "至善道場": "bg-amber-50",
                  "賢林道場": "bg-purple-50",
                };
                const bgColor = venueColors[dojo.name] || "";
                
                return (
                <TableRow key={dojo.id} className={bgColor}>
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell className="font-medium">{dojo.name}</TableCell>
                  <TableCell>{dojo.scheduleDay || "-"}</TableCell>
                  <TableCell>{dojo.scheduleTime || "-"}</TableCell>
                  <TableCell>{dojo.coachName || "-"}</TableCell>
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
                <Label htmlFor="scheduleDay">星期</Label>
                <Input
                  id="scheduleDay"
                  value={formData.scheduleDay}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduleDay: e.target.value })
                  }
                  placeholder="例如：星期一"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduleTime">時段</Label>
                <Input
                  id="scheduleTime"
                  value={formData.scheduleTime}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduleTime: e.target.value })
                  }
                  placeholder="例如：4:00-5:00pm"
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
                  placeholder="例如：賴教練"
                />
              </div>
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
