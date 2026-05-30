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
 * 4. 計算該季度中需繳費的月份數和重疊堂數
 * 5. 月費 × 月數 - 重疊堂數 × 每堂費用 = 按比例費用
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
  const quarterStartMonth = nextQuarter.months[0];
  const quarterEndMonth = nextQuarter.months[nextQuarter.months.length - 1];

  // 計算該季度中，從 nextClassAfterCycle 的月份到季度結束有幾個月
  const monthsInQuarter = quarterEndMonth - nextMonth + 1;
  const monthlyFee = feePerQuarter / 3;
  const perClassFee = monthlyFee / 4; // 每堂費用（假設每月4堂）

  // 計算重疊堂數：第13堂所在月份中，第13堂之前的上課日數量
  let overlapClasses = 0;
  if (nextMonth > quarterStartMonth || nextClassAfterCycle.getDate() > 1) {
    const monthStart = new Date(nextClassAfterCycle.getFullYear(), nextMonth - 1, 1);
    const checkDate = new Date(monthStart);
    while (checkDate < nextClassAfterCycle) {
      if (checkDate.getDay() === targetDay) {
        overlapClasses++;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
  }

  // 被12堂覆蓋的整月數量
  const coveredWholeMonths = nextMonth - quarterStartMonth;

  // 最終費用 = 需繳月份 × 月費 - 重疊堂數 × 每堂費用
  const overlapDeduction = Math.round(perClassFee * overlapClasses);
  const proRataFee = monthlyFee * monthsInQuarter - overlapDeduction;

  // 構建說明 — 使用具體月份名稱
  const notes: string[] = [];
  if (coveredWholeMonths > 0) {
    // 列出被覆蓋的具體月份，例如「7月仍在12堂週期內」
    const coveredMonthNames = [];
    for (let i = 0; i < coveredWholeMonths; i++) {
      coveredMonthNames.push(`${quarterStartMonth + i}月`);
    }
    notes.push(`${coveredMonthNames.join('、')}仍在12堂週期內`);
  }
  if (overlapClasses > 0) {
    notes.push(`${nextMonth}月已含${overlapClasses}堂在週期內，扣$${overlapDeduction}`);
  }

  return {
    firstClassDate: firstClass,
    class12Date,
    nextClassAfterCycle,
    nextQuarterLabel: nextQuarter.label,
    nextQuarterMonths: nextQuarter.months,
    monthsCharged: monthsInQuarter,
    totalMonthsInQuarter: 3,
    monthlyFee,
    perClassFee,
    proRataFee: Math.round(proRataFee),
    isFullQuarter: monthsInQuarter === 3 && overlapClasses === 0,
    overlapClasses,
    overlapDeduction,
    coveredWholeMonths,
    feeNote: notes.length > 0 ? notes.join('，') : undefined,
  };
}
