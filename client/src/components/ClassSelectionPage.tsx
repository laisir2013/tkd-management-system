import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";

interface ClassInfo {
  venue: string;
  day: string;
  time: string;
  studentCount: number;
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

export function ClassSelectionPage({ classes, onSelectClass }: ClassSelectionPageProps) {
  const [generatingYear, setGeneratingYear] = useState<number | null>(null);

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

  // 按星期分組班別（同時支援中文和英文星期）
  const classesByDay = useMemo(() => {
    const grouped: Record<string, ClassInfo[]> = {};
    
    WEEKDAYS.forEach(({ keys, label }) => {
      grouped[label] = classes.filter((c) => keys.includes(c.day));
    });
    
    return grouped;
  }, [classes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">點名管理 - 選擇班別</h2>
          <p className="text-sm text-muted-foreground mt-0.5">請選擇要點名的班別</p>
        </div>
        <div className="flex gap-2">
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
            生成 {currentYear} 年全年日期
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
            生成 {currentYear + 1} 年全年日期
          </Button>
        </div>
      </div>

      {WEEKDAYS.map(({ label }) => {
        const dayClasses = classesByDay[label];
        
        if (dayClasses.length === 0) {
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
                {dayClasses.map((classInfo) => (
                  <Button
                    key={`${classInfo.venue}-${classInfo.day}-${classInfo.time}`}
                    variant="outline"
                    className="h-auto py-2.5 px-3 flex flex-col items-start justify-start text-left hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950 transition-colors"
                    onClick={() => onSelectClass(classInfo.venue, classInfo.day, classInfo.time)}
                  >
                    <div className="font-semibold text-sm">{classInfo.venue}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {classInfo.time}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                      {classInfo.studentCount} 位學生
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
