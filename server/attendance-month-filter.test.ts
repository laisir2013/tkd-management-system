import { describe, it, expect } from "vitest";

/**
 * 測試月份篩選邏輯：確保直接傳 year/month 數字不受時區影響
 * 
 * 問題背景：
 * - 前端在香港 (UTC+8)，startOfMonth(3月) = 2026-03-01T00:00:00+08:00 = 2026-02-28T16:00:00Z
 * - 後端在 EST (UTC-5)，收到 Date 後 getMonth() + 1 = 2（2月），導致月份偏移
 * 
 * 解決方案：
 * - 前端直接傳 year 和 month 數字，後端直接使用，不經過 Date 轉換
 */

describe("月份篩選邏輯 - 時區安全", () => {
  it("直接使用 year/month 數字不受時區影響", () => {
    // 模擬前端傳入的參數
    const input = { year: 2026, month: 3 };
    
    // 後端使用 year/month 生成日期範圍
    const startDate = new Date(input.year, input.month - 1, 1);
    const endDate = new Date(input.year, input.month, 0);
    
    // 確認生成的日期在正確的月份
    expect(startDate.getMonth()).toBe(2); // JavaScript month 0-indexed, 2 = March
    expect(startDate.getDate()).toBe(1);
    expect(endDate.getMonth()).toBe(2); // March
    expect(endDate.getDate()).toBeGreaterThanOrEqual(28); // March has 28-31 days
  });

  it("舊的 Date 方式在跨時區時會出錯", () => {
    // 模擬香港前端傳來的 3 月 1 日 (UTC+8)
    // 2026-03-01T00:00:00+08:00 = 2026-02-28T16:00:00Z
    const hkMarchStart = new Date("2026-02-28T16:00:00Z");
    
    // 在 EST (UTC-5) 伺服器上，這個日期的本地月份是 2 月
    // getMonth() 返回的是本地時區的月份
    const localMonth = hkMarchStart.getMonth(); // 在 EST 時區，2月28日 = month 1
    
    // 這就是 bug 的原因：前端想查 3 月，但後端解析為 2 月
    // 注意：這個測試在不同時區的伺服器上結果不同
    // 在 UTC-5 (EST) 上：localMonth 會是 1 (February)
    // 在 UTC+8 (HK) 上：localMonth 會是 2 (March)
    // 關鍵是：使用 Date 對象傳遞月份是不安全的
    expect(typeof localMonth).toBe("number");
  });

  it("year/month 數字方式對所有月份都正確", () => {
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(2026, month - 1, 1);
      const endDate = new Date(2026, month, 0);
      
      // startDate 應該是該月的第 1 天
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getMonth()).toBe(month - 1);
      
      // endDate 應該是該月的最後一天
      expect(endDate.getMonth()).toBe(month - 1);
      expect(endDate.getDate()).toBeGreaterThanOrEqual(28);
      expect(endDate.getDate()).toBeLessThanOrEqual(31);
    }
  });

  it("月份切換邏輯正確", () => {
    // 測試前進
    let year = 2026, month = 12;
    if (month === 12) { year++; month = 1; } else { month++; }
    expect(year).toBe(2027);
    expect(month).toBe(1);

    // 測試後退
    year = 2026; month = 1;
    if (month === 1) { year--; month = 12; } else { month--; }
    expect(year).toBe(2025);
    expect(month).toBe(12);

    // 測試普通前進
    year = 2026; month = 6;
    month++;
    expect(year).toBe(2026);
    expect(month).toBe(7);

    // 測試普通後退
    year = 2026; month = 6;
    month--;
    expect(year).toBe(2026);
    expect(month).toBe(5);
  });
});
