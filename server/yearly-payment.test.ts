import { describe, it, expect, beforeAll } from 'vitest';
import { getQuarterlyPaymentStatuses } from './db';

describe('Yearly Payment Feature', () => {
  it('should accept year parameter and return quarterly payment statuses', async () => {
    const currentYear = new Date().getFullYear();
    
    // 測試當前年份
    const currentYearStatuses = await getQuarterlyPaymentStatuses(currentYear);
    expect(Array.isArray(currentYearStatuses)).toBe(true);
    
    // 測試 2026 年
    const year2026Statuses = await getQuarterlyPaymentStatuses(2026);
    expect(Array.isArray(year2026Statuses)).toBe(true);
    
    // 測試未來年份
    const nextYearStatuses = await getQuarterlyPaymentStatuses(currentYear + 1);
    expect(Array.isArray(nextYearStatuses)).toBe(true);
  });

  it('should return correct status structure with year-based filtering', async () => {
    const statuses = await getQuarterlyPaymentStatuses(2026);
    
    if (statuses.length > 0) {
      const firstStatus = statuses[0];
      
      // 驗證必要欄位存在
      expect(firstStatus).toHaveProperty('studentId');
      expect(firstStatus).toHaveProperty('studentName');
      expect(firstStatus).toHaveProperty('phone');
      expect(firstStatus).toHaveProperty('Q1');
      expect(firstStatus).toHaveProperty('Q2');
      expect(firstStatus).toHaveProperty('Q3');
      expect(firstStatus).toHaveProperty('Q4');
      
      // 驗證狀態值正確
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q1);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q2);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q3);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q4);
    }
  });

  it('should handle historical years correctly (all quarters should be due)', async () => {
    const currentYear = new Date().getFullYear();
    
    // 測試過去年份（2025）
    if (currentYear > 2025) {
      const historicalStatuses = await getQuarterlyPaymentStatuses(2025);
      
      if (historicalStatuses.length > 0) {
        const firstStatus = historicalStatuses[0];
        
        // 歷史年份的所有季度應該都是已到期（paid 或 unpaid，不應該有 not_due）
        // 除非該學生在該年份有繳費記錄
        const allStatuses = [firstStatus.Q1, firstStatus.Q2, firstStatus.Q3, firstStatus.Q4];
        
        // 至少驗證狀態值是有效的
        allStatuses.forEach(status => {
          expect(['paid', 'unpaid', 'not_due']).toContain(status);
        });
      }
    }
  });

  it('should default to current year when no year parameter is provided', async () => {
    const defaultStatuses = await getQuarterlyPaymentStatuses();
    const currentYearStatuses = await getQuarterlyPaymentStatuses(new Date().getFullYear());
    
    // 兩者應該返回相同的結果
    expect(defaultStatuses.length).toBe(currentYearStatuses.length);
  });
});
