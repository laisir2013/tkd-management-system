import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Pencil, Trash2, Settings2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeeSettingForm {
  id?: number;
  coach_name: string;
  fee_type: 'mpf' | 'operating' | 'other';
  fee_name: string;
  rate: number;
  fixed_amount: number | null;
  calc_method: 'percentage' | 'fixed' | 'percentage_plus_fixed';
  applies_to: 'regular' | 'elite' | 'all';
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
}

const defaultForm: FeeSettingForm = {
  coach_name: '',
  fee_type: 'operating',
  fee_name: '',
  rate: 0.05,
  fixed_amount: null,
  calc_method: 'percentage',
  applies_to: 'all',
  effective_from: '2025-01-01',
  effective_to: null,
  is_active: true,
  notes: null,
};

export default function AdminFeeSettings() {
  const [filterCoach, setFilterCoach] = useState<string>('');
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FeeSettingForm>(defaultForm);
  const [isEditing, setIsEditing] = useState(false);

  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.adminFees.getAll.useQuery({ activeOnly: false });
  const { data: allRates } = trpc.adminFees.getAllRates.useQuery({});
  const upsertMutation = trpc.adminFees.upsert.useMutation({
    onSuccess: () => { utils.adminFees.getAll.invalidate(); utils.adminFees.getAllRates.invalidate(); setShowDialog(false); }
  });
  const deleteMutation = trpc.adminFees.delete.useMutation({
    onSuccess: () => { utils.adminFees.getAll.invalidate(); utils.adminFees.getAllRates.invalidate(); }
  });
  const toggleMutation = trpc.adminFees.toggle.useMutation({
    onSuccess: () => { utils.adminFees.getAll.invalidate(); utils.adminFees.getAllRates.invalidate(); }
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const coaches = [...new Set((settings || []).map(s => s.coach_name))].sort();
  const filtered = filterCoach
    ? (settings || []).filter(s => s.coach_name === filterCoach)
    : (settings || []);

  const openNew = () => {
    setForm(defaultForm);
    setIsEditing(false);
    setShowDialog(true);
  };

  const openEdit = (s: any) => {
    setForm({
      id: s.id,
      coach_name: s.coach_name,
      fee_type: s.fee_type,
      fee_name: s.fee_name,
      rate: parseFloat(s.rate),
      fixed_amount: s.fixed_amount ? parseFloat(s.fixed_amount) : null,
      calc_method: s.calc_method,
      applies_to: s.applies_to,
      effective_from: s.effective_from?.split('T')[0] || '2025-01-01',
      effective_to: s.effective_to?.split('T')[0] || null,
      is_active: !!s.is_active,
      notes: s.notes,
    });
    setIsEditing(true);
    setShowDialog(true);
  };

  const handleSave = () => {
    upsertMutation.mutate(form);
  };

  const handleDelete = (id: number) => {
    if (confirm('確定刪除此設定？')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleToggle = (id: number, current: boolean) => {
    toggleMutation.mutate({ id, isActive: !current });
  };

  const feeTypeLabel = (t: string) => {
    switch (t) {
      case 'mpf': return 'MPF 強積金';
      case 'operating': return '公司營運費';
      case 'other': return '其他費用';
      default: return t;
    }
  };

  const appliesLabel = (a: string) => {
    switch (a) {
      case 'regular': return '恆常班';
      case 'elite': return '精英班';
      case 'all': return '全部';
      default: return a;
    }
  };

  return (
    <div className="space-y-6">
      {/* 概覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coaches.map(coach => {
          const rates = allRates?.[coach];
          return (
            <Card key={coach} className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-3">
                <p className="font-semibold text-sm">{coach}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>MPF 強積金</span>
                    <span className="font-mono font-semibold text-red-600">{rates ? (rates.mpfRate * 100).toFixed(0) : '10'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>公司營運費</span>
                    <span className="font-mono font-semibold text-orange-600">{rates ? (rates.operatingRate * 100).toFixed(0) : '5'}%</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span>教練實收比例</span>
                    <span className="font-mono font-semibold text-green-600">
                      {rates ? ((1 - rates.mpfRate - rates.operatingRate) * 100).toFixed(0) : '85'}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 工具列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterCoach} onValueChange={setFilterCoach}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="全部教練" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部教練</SelectItem>
              {coaches.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">共 {filtered.length} 項設定</span>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> 新增費率設定
        </Button>
      </div>

      {/* 設定表格 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> 行政費率設定
          </CardTitle>
          <CardDescription>管理各教練的 MPF、營運費及其他扣除費率。修改後即時影響財務報表、教練統計及出糧計算。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>教練</TableHead>
                <TableHead>費用類型</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="text-right">費率</TableHead>
                <TableHead>適用</TableHead>
                <TableHead>生效日期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className={!s.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium text-sm">{s.coach_name}</TableCell>
                  <TableCell>
                    <Badge variant={s.fee_type === 'mpf' ? 'default' : s.fee_type === 'operating' ? 'secondary' : 'outline'} className="text-xs">
                      {feeTypeLabel(s.fee_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.fee_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {s.calc_method === 'fixed' 
                      ? `$${parseFloat(String(s.fixed_amount || 0)).toLocaleString()}`
                      : `${(parseFloat(String(s.rate)) * 100).toFixed(1)}%`
                    }
                  </TableCell>
                  <TableCell className="text-xs">{appliesLabel(s.applies_to)}</TableCell>
                  <TableCell className="text-xs">
                    {s.effective_from?.split('T')[0]}
                    {s.effective_to && ` ~ ${s.effective_to.split('T')[0]}`}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!s.is_active}
                      onCheckedChange={() => handleToggle(s.id, !!s.is_active)}
                      className="scale-75"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          修改費率後，<strong>教練統計</strong>、<strong>每月財務報表</strong>及<strong>出糧系統</strong>會即時使用新費率計算。歷史已出糧記錄不受影響。
        </AlertDescription>
      </Alert>

      {/* 編輯對話框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? '編輯費率設定' : '新增費率設定'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>教練</Label>
              <Select value={form.coach_name} onValueChange={v => setForm({...form, coach_name: v})}>
                <SelectTrigger><SelectValue placeholder="選擇教練" /></SelectTrigger>
                <SelectContent>
                  {['鄺富華教練', '林學曉教練', '賴政堡教練'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>費用類型</Label>
              <Select value={form.fee_type} onValueChange={v => setForm({...form, fee_type: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpf">MPF 強積金</SelectItem>
                  <SelectItem value="operating">公司營運費</SelectItem>
                  <SelectItem value="other">其他費用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>費用名稱</Label>
              <Input 
                value={form.fee_name} 
                onChange={e => setForm({...form, fee_name: e.target.value})}
                placeholder="例：MPF 強積金、公司營運費"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>計算方式</Label>
                <Select value={form.calc_method} onValueChange={v => setForm({...form, calc_method: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">百分比</SelectItem>
                    <SelectItem value="fixed">固定金額</SelectItem>
                    <SelectItem value="percentage_plus_fixed">百分比+固定</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>費率 (%)</Label>
                <Input 
                  type="number" 
                  step="0.1"
                  value={(form.rate * 100).toFixed(1)} 
                  onChange={e => setForm({...form, rate: parseFloat(e.target.value) / 100 || 0})}
                />
              </div>
            </div>
            {(form.calc_method === 'fixed' || form.calc_method === 'percentage_plus_fixed') && (
              <div>
                <Label>固定金額 ($)</Label>
                <Input 
                  type="number" 
                  value={form.fixed_amount || ''} 
                  onChange={e => setForm({...form, fixed_amount: parseFloat(e.target.value) || null})}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>適用範圍</Label>
                <Select value={form.applies_to} onValueChange={v => setForm({...form, applies_to: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部收入</SelectItem>
                    <SelectItem value="regular">恆常班</SelectItem>
                    <SelectItem value="elite">精英班</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>生效日期</Label>
                <Input 
                  type="date" 
                  value={form.effective_from} 
                  onChange={e => setForm({...form, effective_from: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input 
                value={form.notes || ''} 
                onChange={e => setForm({...form, notes: e.target.value || null})}
                placeholder="可選"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!form.coach_name || !form.fee_name || upsertMutation.isPending}>
              {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isEditing ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
