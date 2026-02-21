import { describe, it, expect } from "vitest";
import { getQuarterlyPaymentStatuses } from "./db";

describe("Quarterly Payment Status", () => {
  it("should return quarterly payment statuses for all students", async () => {
    const statuses = await getQuarterlyPaymentStatuses();
    
    expect(statuses).toBeDefined();
    expect(Array.isArray(statuses)).toBe(true);
    
    if (statuses.length > 0) {
      const firstStatus = statuses[0];
      
      // 檢查必要欄位
      expect(firstStatus).toHaveProperty('studentId');
      expect(firstStatus).toHaveProperty('studentName');
      expect(firstStatus).toHaveProperty('phone');
      expect(firstStatus).toHaveProperty('Q1');
      expect(firstStatus).toHaveProperty('Q2');
      expect(firstStatus).toHaveProperty('Q3');
      expect(firstStatus).toHaveProperty('Q4');
      
      // 檢查季度狀態值
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q1);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q2);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q3);
      expect(['paid', 'unpaid', 'not_due']).toContain(firstStatus.Q4);
    }
  });

  it("should mark quarters as 'not_due' for future quarters", async () => {
    const statuses = await getQuarterlyPaymentStatuses();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    
    if (statuses.length > 0) {
      const firstStatus = statuses[0];
      
      // 根據當前月份檢查未到期的季度
      if (currentMonth < 4) {
        // 如果現在是 1-3 月，Q2、Q3、Q4 應該是未到期
        expect(firstStatus.Q2).toBe('not_due');
        expect(firstStatus.Q3).toBe('not_due');
        expect(firstStatus.Q4).toBe('not_due');
      } else if (currentMonth < 7) {
        // 如果現在是 4-6 月，Q3、Q4 應該是未到期
        expect(firstStatus.Q3).toBe('not_due');
        expect(firstStatus.Q4).toBe('not_due');
      } else if (currentMonth < 10) {
        // 如果現在是 7-9 月，Q4 應該是未到期
        expect(firstStatus.Q4).toBe('not_due');
      }
    }
  });

  it("should include payment date for paid quarters", async () => {
    const statuses = await getQuarterlyPaymentStatuses();
    
    if (statuses.length > 0) {
      const paidStudent = statuses.find(s => s.Q1 === 'paid' || s.Q2 === 'paid' || s.Q3 === 'paid' || s.Q4 === 'paid');
      
      if (paidStudent) {
        // 如果有已繳費的季度，應該有對應的繳費日期
        if (paidStudent.Q1 === 'paid') {
          expect(paidStudent.Q1PaymentDate).toBeDefined();
        }
        if (paidStudent.Q2 === 'paid') {
          expect(paidStudent.Q2PaymentDate).toBeDefined();
        }
        if (paidStudent.Q3 === 'paid') {
          expect(paidStudent.Q3PaymentDate).toBeDefined();
        }
        if (paidStudent.Q4 === 'paid') {
          expect(paidStudent.Q4PaymentDate).toBeDefined();
        }
      }
    }
  });
});
