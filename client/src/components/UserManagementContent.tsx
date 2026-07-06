import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDayMonthYear } from "@/lib/dateFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, Shield, UserCog, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function UserManagementContent() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'coach' | 'staff' | 'examiner'>('user');
  const [coachName, setCoachName] = useState('');

  const { data: users, refetch } = trpc.users.getAll.useQuery();
  const updateRoleMutation = trpc.users.updateRole.useMutation();

  const handleOpenDialog = (user: any) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setCoachName(user.coachName || '');
    setIsDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      await updateRoleMutation.mutateAsync({
        userId: selectedUser.id,
        role: newRole,
        coachName: newRole === 'coach' ? coachName : undefined,
      });

      toast.success('用戶角色已更新');
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error('更新失敗');
      console.error(error);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: '管理員', icon: Shield, color: 'bg-red-100 text-red-800' },
      coach: { label: '教練', icon: UserCog, color: 'bg-blue-100 text-blue-800' },
      examiner: { label: '考官', icon: ShieldCheck, color: 'bg-amber-100 text-amber-800' },
      staff: { label: '工作人員', icon: UserCog, color: 'bg-green-100 text-green-800' },
      user: { label: '一般用戶', icon: Users, color: 'bg-gray-100 text-gray-800' },
    };

    const badge = badges[role as keyof typeof badges] || badges.user;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            用戶管理
          </CardTitle>
          <CardDescription>
            管理系統用戶角色,將用戶設定為管理員或教練
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>教練姓名</TableHead>
                  <TableHead>最後登入</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{(user as any).coachName || '-'}</TableCell>
                    <TableCell>
                      {user.lastSignedIn 
                        ? formatDayMonthYear(user.lastSignedIn)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(user)}
                      >
                        編輯角色
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯用戶角色</DialogTitle>
            <DialogDescription>
              修改 {selectedUser?.name} 的系統角色
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="role">角色</Label>
              <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">一般用戶</SelectItem>
                  <SelectItem value="staff">工作人員（點名/成績/時間表/合格）</SelectItem>
                  <SelectItem value="examiner">考官（工作人員 + 評分表）</SelectItem>
                  <SelectItem value="coach">教練</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRole === 'coach' && (
              <div>
                <Label htmlFor="coachName">教練姓名</Label>
                <Input
                  id="coachName"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="請輸入教練姓名(用於匹配道場資料)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  此姓名必須與道場資料中的教練姓名完全一致
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateRole} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? '更新中...' : '確認更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
