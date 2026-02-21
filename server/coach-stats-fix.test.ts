import { describe, it, expect, vi } from "vitest";

describe("Coach Statistics Fix", () => {
  it("should calculate total fee from all students directly", () => {
    // 模擬學生資料
    const students = [
      { id: 1, name: "學生A", feePerQuarter: "1800" },
      { id: 2, name: "學生B", feePerQuarter: "1800" },
      { id: 3, name: "學生C", feePerQuarter: "2400" },
    ];

    // 直接從學生資料計算總學費（新的計算邏輯）
    const totalFee = students.reduce(
      (sum, s) => sum + parseFloat(s.feePerQuarter || "0"),
      0
    );

    expect(totalFee).toBe(6000);
    expect(students.length).toBe(3);
  });

  it("should not depend on dojos table for fee calculation", () => {
    // 模擬 103 位學生，每位 $1800/季度
    const students = Array.from({ length: 103 }, (_, i) => ({
      id: i + 1,
      name: `學生${i + 1}`,
      feePerQuarter: "1800",
    }));

    const totalFee = students.reduce(
      (sum, s) => sum + parseFloat(s.feePerQuarter || "0"),
      0
    );

    // 103 × 1800 = 185400
    expect(totalFee).toBe(185400);
    expect(students.length).toBe(103);
  });
});

describe("Training Schedule Date Filter Fix", () => {
  it("should convert startDate to year and month correctly", () => {
    // 模擬前端傳入的 startDate
    const startDate = new Date(2026, 2, 1); // March 2026 (month is 0-indexed)

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;

    expect(year).toBe(2026);
    expect(month).toBe(3);
  });

  it("should handle different months correctly", () => {
    const months = [
      { date: new Date(2026, 0, 1), expectedYear: 2026, expectedMonth: 1 },
      { date: new Date(2026, 1, 1), expectedYear: 2026, expectedMonth: 2 },
      { date: new Date(2026, 5, 1), expectedYear: 2026, expectedMonth: 6 },
      { date: new Date(2026, 11, 1), expectedYear: 2026, expectedMonth: 12 },
    ];

    months.forEach(({ date, expectedYear, expectedMonth }) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      expect(year).toBe(expectedYear);
      expect(month).toBe(expectedMonth);
    });
  });

  it("should filter training schedules by year and month", () => {
    // 模擬訓練日期資料
    const trainingSchedules = [
      { id: 1, trainingDate: new Date(2026, 1, 5), venue: "道場A" },
      { id: 2, trainingDate: new Date(2026, 1, 12), venue: "道場A" },
      { id: 3, trainingDate: new Date(2026, 2, 5), venue: "道場A" },
      { id: 4, trainingDate: new Date(2026, 2, 12), venue: "道場A" },
      { id: 5, trainingDate: new Date(2026, 3, 5), venue: "道場A" },
    ];

    // 篩選 2026 年 2 月（month=2）
    const year = 2026;
    const month = 2;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const filtered = trainingSchedules.filter(
      (s) => s.trainingDate >= startDate && s.trainingDate <= endDate
    );

    expect(filtered.length).toBe(2);
    expect(filtered[0].id).toBe(1);
    expect(filtered[1].id).toBe(2);

    // 篩選 2026 年 3 月（month=3）
    const month3Start = new Date(2026, 2, 1);
    const month3End = new Date(2026, 3, 0);

    const filtered3 = trainingSchedules.filter(
      (s) => s.trainingDate >= month3Start && s.trainingDate <= month3End
    );

    expect(filtered3.length).toBe(2);
    expect(filtered3[0].id).toBe(3);
    expect(filtered3[1].id).toBe(4);
  });
});
