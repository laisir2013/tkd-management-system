import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export function WhatsAppTemplates() {
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    isDefault: false,
    isActive: true,
  });

  const { data: templates, isLoading, refetch } = trpc.whatsappTemplates.getAll.useQuery();
  const createMutation = trpc.whatsappTemplates.create.useMutation();
  const updateMutation = trpc.whatsappTemplates.update.useMutation();
  const deleteMutation = trpc.whatsappTemplates.delete.useMutation();

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      isDefault: template.isDefault,
      isActive: template.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      content: "",
      isDefault: false,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          id: editingTemplate.id,
          ...formData,
        });
        toast.success("範本已更新");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("範本已創建");
      }
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("確定要刪除此範本嗎?")) return;
    
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("範本已刪除");
      refetch();
    } catch (error) {
      toast.error("刪除失敗");
    }
  };

  if (isLoading) {
    return <div className="p-4">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp 訊息範本</h2>
          <p className="text-muted-foreground">管理繳費通知的訊息範本</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新增範本
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{template.name}</span>
                {template.isDefault && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">預設</span>
                )}
              </CardTitle>
              <CardDescription>
                {template.isActive ? "啟用中" : "已停用"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                  {template.content}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    編輯
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    刪除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "編輯範本" : "新增範本"}
            </DialogTitle>
            <DialogDescription>
              支援變數: {"{"}{"{"} studentName {"}"}{"}"}, {"{"}{"{"} feeAmount {"}"}{"}"}, {"{"}{"{"} phone {"}"}{"}"}, {"{"}{"{"} systemUrl {"}"}{"}"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">範本名稱</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：標準繳費通知"
              />
            </div>
            <div>
              <Label htmlFor="content">訊息內容</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="輸入訊息內容，可使用變數..."
                rows={10}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span className="text-sm">設為預設範本</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span className="text-sm">啟用此範本</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                {editingTemplate ? "更新" : "創建"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
