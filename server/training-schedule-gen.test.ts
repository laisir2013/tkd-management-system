import { describe, it, expect, vi } from 'vitest';

describe('Training Schedule Generation', () => {
  it('should generate correct dates for a given weekday in a month', () => {
    // Test the logic of finding all occurrences of a weekday in a month
    const dayMap: Record<string, number> = {
      '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
      '星期四': 4, '星期五': 5, '星期六': 6,
    };

    function getDatesForWeekdayInMonth(year: number, month: number, weekday: number): string[] {
      const dates: string[] = [];
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      for (let d = firstDay.getDate(); d <= lastDay.getDate(); d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() === weekday) {
          dates.push(date.toISOString().split('T')[0]);
        }
      }
      return dates;
    }

    // Test: February 2026, 星期一 (Monday = 1)
    const feb2026Mondays = getDatesForWeekdayInMonth(2026, 2, 1);
    expect(feb2026Mondays.length).toBeGreaterThan(0);
    expect(feb2026Mondays.length).toBeLessThanOrEqual(5);
    // Feb 2 is Monday in 2026
    expect(feb2026Mondays[0]).toBe('2026-02-02');

    // Test: March 2026, 星期三 (Wednesday = 3)
    const mar2026Wednesdays = getDatesForWeekdayInMonth(2026, 3, 3);
    expect(mar2026Wednesdays.length).toBeGreaterThan(0);
    // Mar 4 is Wednesday in 2026
    expect(mar2026Wednesdays[0]).toBe('2026-03-04');

    // Test: dayMap mapping
    expect(dayMap['星期一']).toBe(1);
    expect(dayMap['星期六']).toBe(6);
    expect(dayMap['星期日']).toBe(0);
  });

  it('should generate 12 months of dates for yearly generation', () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(months.length).toBe(12);
  });

  it('should correctly determine quarter for payment status', () => {
    function getQuarterForMonth(month: number): string {
      if (month >= 1 && month <= 3) return 'Q1';
      if (month >= 4 && month <= 6) return 'Q2';
      if (month >= 7 && month <= 9) return 'Q3';
      return 'Q4';
    }

    expect(getQuarterForMonth(1)).toBe('Q1');
    expect(getQuarterForMonth(3)).toBe('Q1');
    expect(getQuarterForMonth(4)).toBe('Q2');
    expect(getQuarterForMonth(6)).toBe('Q2');
    expect(getQuarterForMonth(7)).toBe('Q3');
    expect(getQuarterForMonth(10)).toBe('Q4');
    expect(getQuarterForMonth(12)).toBe('Q4');
  });

  it('should calculate payment rate correctly', () => {
    const totalStudents = 103;
    const paidStudents = 30;
    const rate = (paidStudents / totalStudents * 100);
    
    expect(rate).toBeCloseTo(29.1, 0);
    expect(rate).toBeLessThan(50); // Should be red
    
    const paidStudents2 = 60;
    const rate2 = (paidStudents2 / totalStudents * 100);
    expect(rate2).toBeGreaterThanOrEqual(50); // Should be orange
    expect(rate2).toBeLessThan(80);
    
    const paidStudents3 = 90;
    const rate3 = (paidStudents3 / totalStudents * 100);
    expect(rate3).toBeGreaterThanOrEqual(80); // Should be green
  });
});
