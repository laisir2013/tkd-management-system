import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module
vi.mock('./db', () => ({
  getParentEliteInfo: vi.fn(),
}));

import { getParentEliteInfo } from './db';

const mockGetParentEliteInfo = vi.mocked(getParentEliteInfo);

describe('Parent Elite Info Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when phone has no elite students', async () => {
    mockGetParentEliteInfo.mockResolvedValue(null);
    const result = await getParentEliteInfo('99999999');
    expect(result).toBeNull();
  });

  it('should return elite student info with attendance details', async () => {
    const mockData = [
      {
        student: {
          id: 1,
          name: '郭俊康',
          scheduleDay: '日',
          scheduleTime: '10:00',
          beltLevel: '黑帶',
          status: 'active' as const,
        },
        totalAttended: 138,
        cycleNumber: 6,
        completedCycles: 11,
        needPaymentReminder: false,
        paidClasses: 138,
        remainingClasses: 0,
        needPayment: true,
        payments: [
          { id: 1, classCount: 12, amount: 2400, paymentDate: new Date('2025-07-27'), status: 'confirmed' },
        ],
        attendanceDetails: [
          { classNumber: 1, date: new Date('2022-07-10'), cycleNumber: 1, cycleIndex: 1 },
          { classNumber: 2, date: new Date('2022-07-17'), cycleNumber: 2, cycleIndex: 1 },
        ],
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('12345678');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].student.name).toBe('郭俊康');
    expect(result![0].totalAttended).toBe(138);
    expect(result![0].paidClasses).toBe(138);
    expect(result![0].remainingClasses).toBe(0);
    expect(result![0].needPayment).toBe(true);
    expect(result![0].attendanceDetails).toHaveLength(2);
    expect(result![0].attendanceDetails[0].classNumber).toBe(1);
  });

  it('should calculate remaining classes correctly', async () => {
    const mockData = [
      {
        student: {
          id: 2,
          name: '劉玥',
          scheduleDay: '日',
          scheduleTime: '10:00',
          beltLevel: null,
          status: 'active' as const,
        },
        totalAttended: 17,
        cycleNumber: 5,
        completedCycles: 1,
        needPaymentReminder: false,
        paidClasses: 12,
        remainingClasses: -5,
        needPayment: true,
        payments: [],
        attendanceDetails: Array.from({ length: 17 }, (_, i) => ({
          classNumber: i + 1,
          date: new Date(`2025-02-${16 + i}`),
          cycleNumber: ((i) % 12) + 1,
          cycleIndex: Math.floor(i / 12) + 1,
        })),
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('12345678');
    expect(result![0].remainingClasses).toBe(-5);
    expect(result![0].needPayment).toBe(true);
    expect(result![0].totalAttended).toBe(17);
    expect(result![0].paidClasses).toBe(12);
  });

  it('should handle student with sufficient paid classes', async () => {
    const mockData = [
      {
        student: {
          id: 3,
          name: '鄧穎翹',
          scheduleDay: null,
          scheduleTime: null,
          beltLevel: null,
          status: 'active' as const,
        },
        totalAttended: 4,
        cycleNumber: 4,
        completedCycles: 0,
        needPaymentReminder: false,
        paidClasses: 12,
        remainingClasses: 8,
        needPayment: false,
        payments: [],
        attendanceDetails: Array.from({ length: 4 }, (_, i) => ({
          classNumber: i + 1,
          date: new Date(`2026-01-${11 + i * 7}`),
          cycleNumber: i + 1,
          cycleIndex: 1,
        })),
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('12345678');
    expect(result![0].remainingClasses).toBe(8);
    expect(result![0].needPayment).toBe(false);
  });

  it('should return multiple students for same phone number', async () => {
    const mockData = [
      {
        student: { id: 10, name: '鄒曉澄', scheduleDay: '日', scheduleTime: '10:00', beltLevel: null, status: 'active' as const },
        totalAttended: 135,
        cycleNumber: 3,
        completedCycles: 11,
        needPaymentReminder: false,
        paidClasses: 135,
        remainingClasses: 0,
        needPayment: true,
        payments: [],
        attendanceDetails: [],
      },
      {
        student: { id: 11, name: '鄒詩雅', scheduleDay: '日', scheduleTime: '10:00', beltLevel: null, status: 'active' as const },
        totalAttended: 135,
        cycleNumber: 3,
        completedCycles: 11,
        needPaymentReminder: false,
        paidClasses: 135,
        remainingClasses: 0,
        needPayment: true,
        payments: [],
        attendanceDetails: [],
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('92266599');
    expect(result).toHaveLength(2);
    expect(result![0].student.name).toBe('鄒曉澄');
    expect(result![1].student.name).toBe('鄒詩雅');
  });

  it('should include attendance details with correct cycle info', async () => {
    const mockData = [
      {
        student: { id: 5, name: '林諾天', scheduleDay: null, scheduleTime: null, beltLevel: null, status: 'active' as const },
        totalAttended: 151,
        cycleNumber: 7,
        completedCycles: 12,
        needPaymentReminder: false,
        paidClasses: 126,
        remainingClasses: -25,
        needPayment: true,
        payments: [],
        attendanceDetails: [
          { classNumber: 1, date: new Date('2022-07-10'), cycleNumber: 1, cycleIndex: 1 },
          { classNumber: 12, date: new Date('2022-10-09'), cycleNumber: 12, cycleIndex: 1 },
          { classNumber: 13, date: new Date('2022-10-16'), cycleNumber: 1, cycleIndex: 2 },
        ],
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('12345678');
    const details = result![0].attendanceDetails;
    // First class of first cycle
    expect(details[0].cycleNumber).toBe(1);
    expect(details[0].cycleIndex).toBe(1);
    // Last class of first cycle
    expect(details[1].cycleNumber).toBe(12);
    expect(details[1].cycleIndex).toBe(1);
    // First class of second cycle
    expect(details[2].cycleNumber).toBe(1);
    expect(details[2].cycleIndex).toBe(2);
  });

  it('should correctly identify payment reminder threshold', async () => {
    const mockData = [
      {
        student: { id: 6, name: '蔡宏鑫', scheduleDay: null, scheduleTime: null, beltLevel: null, status: 'active' as const },
        totalAttended: 10,
        cycleNumber: 10,
        completedCycles: 0,
        needPaymentReminder: true, // cycleNumber >= 10
        paidClasses: 12,
        remainingClasses: 2,
        needPayment: false,
        payments: [],
        attendanceDetails: [],
      },
    ];
    mockGetParentEliteInfo.mockResolvedValue(mockData);

    const result = await getParentEliteInfo('12345678');
    expect(result![0].needPaymentReminder).toBe(true);
    expect(result![0].cycleNumber).toBe(10);
  });
});
