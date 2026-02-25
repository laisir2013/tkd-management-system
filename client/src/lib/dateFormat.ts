/**
 * 日期格式化工具 — 全系統統一使用 日/月 格式
 */

/** 格式化為 日/月 (e.g., 25/2) */
export function formatDayMonth(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** 格式化為 日/月/年 (e.g., 25/2/2026) */
export function formatDayMonthYear(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** 格式化為 日/月 加星期 (e.g., 25/2 (三)) */
export function formatDayMonthWeekday(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getDate()}/${d.getMonth() + 1} (${weekdays[d.getDay()]})`;
}
