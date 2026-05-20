// 新生 12 週循環後按比例收費計算

// 星期對照表：「星期X」→ JS Date.getDay() (0=日, 1=一, ...)
const WEEKDAY_MAP: Record<string, number> = {
  '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
  '星期四': 4, '星期五': 5, '星期六': 6,
};

// 季度定義
const QUARTERS = [
  { label: '1-3月', months: [1, 2, 3] },
  { label: '4-6月', months: [4, 5, 6] },
  { label: '7-9月', months: [7, 8, 9] },
  { label: '10-12月', months: [10, 11, 12] },
];

function getQuarterForMonth(month: number) {
  return QUARTERS[Math.floor((month - 1) / 3)];
}

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function formatDateShort(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * 計算新生12週循環結束後，下一期需繳交的按比例費用
 * 
 * 邏輯：
 * 1. 從入學日期找到第一個上課日（星期X）
 * 2. 數 12 週 = 第 12 堂課日期
 * 3. 第 13 堂開始落入哪個季度
 * 4. 從第 13 堂的月份到該季度結束 = 需繳費的月數
 * 5. 月費 × 月數 = 按比例費用
 */
export function calcNewStudentProRata(
  joinDateStr: string,
  scheduleDayStr: string,
  feePerQuarter: number
) {
  const targetDay = WEEKDAY_MAP[scheduleDayStr];
  if (targetDay === undefined || !joinDateStr || !feePerQuarter) return null;

  const joinDate = new Date(joinDateStr + 'T00:00:00');
  if (isNaN(joinDate.getTime())) return null;

  // 找到第一個上課日（joinDate 當天或之後的第一個 scheduleDay）
  const firstClass = new Date(joinDate);
  while (firstClass.getDay() !== targetDay) {
    firstClass.setDate(firstClass.getDate() + 1);
  }

  // 計算第 12 堂課的日期（第 1 堂 = firstClass，第 12 堂 = +11 週）
  const class12Date = new Date(firstClass);
  class12Date.setDate(class12Date.getDate() + 11 * 7);

  // 12 週循環結束後，下一堂課開始日
  const nextClassAfterCycle = new Date(class12Date);
  nextClassAfterCycle.setDate(nextClassAfterCycle.getDate() + 7);

  // 找出 nextClassAfterCycle 落在哪個季度
  const nextMonth = nextClassAfterCycle.getMonth() + 1; // 1-12
  const nextQuarter = getQuarterForMonth(nextMonth);
  const quarterEndMonth = nextQuarter.months[nextQuarter.months.length - 1];

  // 計算該季度中，從 nextClassAfterCycle 的月份到季度結束有幾個月
  const monthsInQuarter = quarterEndMonth - nextMonth + 1;
  const monthlyFee = feePerQuarter / 3;
  const proRataFee = monthlyFee * monthsInQuarter;

  return {
    firstClassDate: firstClass,
    class12Date,
    nextClassAfterCycle,
    nextQuarterLabel: nextQuarter.label,
    nextQuarterMonths: nextQuarter.months,
    monthsCharged: monthsInQuarter,
    totalMonthsInQuarter: 3,
    monthlyFee,
    proRataFee,
    isFullQuarter: monthsInQuarter === 3,
  };
}
