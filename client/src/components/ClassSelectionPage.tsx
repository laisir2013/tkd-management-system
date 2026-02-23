import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";

interface ClassInfo {
  venue: string;
  day: string;
  time: string;
  studentCount: number;
  coach?: string;
}

interface ClassSelectionPageProps {
  classes: ClassInfo[];
  onSelectClass: (venue: string, day: string, time: string) => void;
}

const WEEKDAYS = [
  { keys: ["Monday", "星期一"], label: "星期一" },
  { keys: ["Tuesday", "星期二"], label: "星期二" },
  { keys: ["Wednesday", "星期三"], label: "星期三" },
  { keys: ["Thursday", "星期四"], label: "星期四" },
  { keys: ["Friday", "星期五"], label: "星期五" },
  { keys: ["Saturday", "星期六"], label: "星期六" },
  { keys: ["Sunday", "星期日"], label: "星期日" },
];

// 教練顏色配置
const COACH_COLORS: Record<string, { bg: string; border: string; hover: string; text: string; badge: string }> = {
  '賴政堡教練': { bg: 'bg-blue-50', border: 'border-blue-300', hover: 'hover:bg-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  '鄺富華教練': { bg: 'bg-emerald-50', border: 'border-emerald-300', hover: 'hover:bg-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  '林學曉教練': { bg: 'bg-purple-50', border: 'border-purple-300', hover: 'hover:bg-purple-100', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  '何翰錕教練': { bg: 'bg-orange-50', border: 'border-orange-300', hover: 'hover:bg-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  '許悠教練':   { bg: 'bg-rose-50', border: 'border-rose-300', hover: 'hover:bg-rose-100', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' },
};
const DEFAULT_COLOR = { bg: 'bg-gray-50', border: 'border-gray-300', hover: 'hover:bg-gray-100', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' };

function getCoachColor(coach: string) {
  return COACH_COLORS[coach] || DEFAULT_COLOR;
}

export function ClassSelectionPage({ classes, onSelectClass }: ClassSelectionPageProps) {
  const [generatingYear, setGeneratingYear] = useState<number | null>(null);
  const [coachFilter, setCoachFilter] = useState<string>("all");

  const generateYearly = trpc.attendance.generateYearlySchedules.useMutation({
    onSuccess: (data) => {
      toast.success(`已為所有班別生成 ${generatingYear} 年全年訓練日期，共 ${data.totalGenerated} 個日期`);
      setGeneratingYear(null);
    },
    onError: (error) => {
      toast.error(`生成失敗: ${error.message}`);
      setGeneratingYear(null);
    },
  });

  const handleGenerateYearly = (year: number) => {
    setGeneratingYear(year);
    generateYearly.mutate({ year });
  };

  const currentYear = new Date().getFullYear();

  // 取得教練列表
  const coachList = useMemo(() => {
    const coaches = [...new Set(classes.map(c => c.coach).filter(Boolean))];
    return coaches.sort();
  }, [classes]);

  // 篩選班別
  const filteredClasses = useMemo(() => {
    if (coachFilter === 'all') return classes;
    return classes.filter(c => c.coach === coachFilter);
  }, [classes, coachFilter]);

  // 按星期分組班別（同時支援中文和英文星期）
  const classesByDay = useMemo(() => {
    const grouped: Record<string, ClassInfo[]> = {};
    
    WEEKDAYS.forEach(({ keys, label }) => {
      grouped[label] = filteredClasses.filter((c) => keys.includes(c.day));
    });
    
    return grouped;
  }, [filteredClasses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">點名管理 - 選擇班別</h2>
          <p className="text-sm text-muted-foreground mt-0.5">請選擇要點名的班別</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* 教練篩選 */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateYearly(currentYear)}
            disabled={generateYearly.isPending}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            {generateYearly.isPending && generatingYear === currentYear ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-1.5 h-4 w-4" />
            )}
            生成 {currentYear} 年
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateYearly(currentYear + 1)}
            disabled={generateYearly.isPending}
            className="text-purple-600 border-purple-300 hover:bg-purple-50"
          >
            {generateYearly.isPending && generatingYear === currentYear + 1 ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-1.5 h-4 w-4" />
            )}
            生成 {currentYear + 1} 年
          </Button>
        </div>
      </div>

      {/* 教練顏色圖例 */}
      <div className="flex flex-wrap gap-2 text-xs">
        {coachList.map((coach) => {
          const color = getCoachColor(coach!);
          return (
            <span key={coach} className={`px-2 py-1 rounded-full font-medium ${color.badge}`}>
              {coach}
            </span>
          );
        })}
      </div>

      {WEEKDAYS.map(({ label }) => {
        const dayClasses = classesByDay[label];
        
        if (!dayClasses || dayClasses.length === 0) {
          return null;
        }

        return (
          <Card key={label} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="text-xs">共 {dayClasses.length} 個班別</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {dayClasses.map((classInfo) => {
                  const color = getCoachColor(classInfo.coach || '');
                  return (
                    <Button
                      key={`${classInfo.venue}-${classInfo.day}-${classInfo.time}`}
                      variant="outline"
                      className={`h-auto py-2.5 px-3 flex flex-col items-start justify-start text-left transition-colors ${color.bg} ${color.border} ${color.hover}`}
                      onClick={() => onSelectClass(classInfo.venue, classInfo.day, classInfo.time)}
                    >
                      <div className="font-semibold text-sm">{classInfo.venue}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {classInfo.time}
                      </div>
                      <div className="flex items-center justify-between w-full mt-1">
                        <span className="text-xs text-blue-600 font-medium">
                          {classInfo.studentCount} 位學生
                        </span>
                        {classInfo.coach && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${color.badge} font-medium`}>
                            {classInfo.coach.replace('教練', '')}
                          </span>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
