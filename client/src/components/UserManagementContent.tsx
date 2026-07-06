import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDayMonthYear } from "@/lib/dateFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, Shield, UserCog, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: 'coach', label: '教練', desc: '學生管理・點名・收據' },
  { value: 'examiner', label: '考官', desc: '考試系統全功能（含評分）' },
  { value: 'staff', label: '工作人員', desc: '考試系統（不含評分）' },
  { value: 'admin', label: '管理員', desc: '系統全功能' },
] as const;

export default function UserManagementContent() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [coachName, setCoachName] = useState('');

  const { data: users, refetch } = trpc.users.getAll.useQuery();
  const updateRoleMutation = trpc.users.updateRole.useMutation();

  const handleOpenDialog = (user: any) => {
    setSelectedUser(user);
    const roles = user.roles || [user.role];
    setSelectedRoles(roles.filter((r: string) => r !== 'user'));
    setCoachName(user.coachName || '');
    setIsDialogOpen(true);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    const roles = selectedRoles.length > 0 ? selectedRoles : ['user'];
    // 主要角色優先級：admin > coach > examiner > staff > user
    const primaryRole = roles.includes('admin') ? 'admin' :
      roles.includes('coach') ? 'coach' :
      roles.includes('examiner') ? 'examiner' :
      roles.includes('staff') ? 'staff' : 'user';

    try {
      await updateRoleMutation.mutateAsync({
        userId: selectedUser.id,
        role: primaryRole as any,
        roles: roles as any,
        coachName: roles.includes('coach') ? coachName : undefined,
      });

      toast.success('用戶角色已更新');
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error('更新失敗');
      console.error(error);
    }
  };

  const getRoleBadges = (user: any) => {
    const roles: string[] = user.roles || [user.role];
    const badges: Record<string, { label: string; icon: any; color: string }> = {
      admin: { label: '管理員', icon: Shield, color: 'bg-red-100 text-red-800' },
      coach: { label: '教練', icon: UserCog, color: 'bg-blue-100 text-blue-800' },
      examiner: { label: '考官', icon: ShieldCheck, color: 'bg-amber-100 text-amber-800' },
      staff: { label: '工作人員', icon: UserCog, color: 'bg-green-100 text-green-800' },
      user: { label: '一般用戶', icon: Users, color: 'bg-gray-100 text-gray-800' },
    };

    return (
      <div className="flex flex-wrap gap-1">
        {roles.map(role => {
          const badge = badges[role] || badges.user;
          const Icon = badge.icon;
          return (
            <span key={role} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
              <Icon className="w-3 h-3" />
              {badge.label}
            </span>
          );
        })}
      </div>
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
            管理系統用戶角色，每位用戶可擁有多個角色
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>電話</TableHead>
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
                    <TableCell>{(user as any).phone || '-'}</TableCell>
                    <TableCell>{getRoleBadges(user)}</TableCell>
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
              修改 {selectedUser?.name} 的系統角色（可多選）
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">角色（可多選）</Label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRoles.includes(opt.value) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(opt.value)}
                      onChange={() => toggleRole(opt.value)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {selectedRoles.includes('coach') && (
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
