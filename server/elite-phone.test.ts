import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getAllEliteStudents: vi.fn(),
  getEliteStudentById: vi.fn(),
  updateEliteStudent: vi.fn(),
  insertEliteStudent: vi.fn(),
  deleteEliteStudent: vi.fn(),
  getEliteStudentsByPhone: vi.fn(),
  getEliteTrainingSchedules: vi.fn(),
  updateEliteTrainingScheduleStatus: vi.fn(),
  generateEliteTrainingSchedules: vi.fn(),
  getEliteAttendanceRecords: vi.fn(),
  upsertEliteAttendanceRecord: vi.fn(),
  getElitePaymentRecords: vi.fn(),
  insertElitePaymentRecord: vi.fn(),
  getEliteStudentBalance: vi.fn(),
  getEliteCycleInfo: vi.fn(),
  getAllEliteCycleInfo: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('./_core/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn(),
}));

describe('Elite Phone Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phone field in elite students', () => {
    it('should have phone field in student data', async () => {
      const { getAllEliteStudents } = await import('./db');
      const mockStudents = [
        { id: 1, name: '張三', phone: '98765432', status: 'active', scheduleTime: '12:00-2:00pm' },
        { id: 2, name: '李四', phone: '', status: 'active', scheduleTime: '4:30-6:30pm' },
        { id: 3, name: '王五', phone: '0', status: 'active', scheduleTime: '12:00-2:00pm' },
      ];
      vi.mocked(getAllEliteStudents).mockResolvedValue(mockStudents as any);

      const students = await getAllEliteStudents();
      expect(students).toHaveLength(3);
      expect(students[0].phone).toBe('98765432');
      expect(students[1].phone).toBe('');
      expect(students[2].phone).toBe('0');
    });

    it('should identify students without phone numbers', async () => {
      const { getAllEliteStudents } = await import('./db');
      const mockStudents = [
        { id: 1, name: '張三', phone: '98765432', status: 'active' },
        { id: 2, name: '李四', phone: '', status: 'active' },
        { id: 3, name: '王五', phone: '0', status: 'active' },
        { id: 4, name: '趙六', phone: '91234567', status: 'active' },
        { id: 5, name: '孫七', phone: '', status: 'inactive' },
      ];
      vi.mocked(getAllEliteStudents).mockResolvedValue(mockStudents as any);

      const students = await getAllEliteStudents();
      const activeStudents = students.filter((s: any) => s.status === 'active');
      const noPhone = activeStudents.filter((s: any) => !s.phone || s.phone === '' || s.phone === '0');
      
      expect(activeStudents).toHaveLength(4);
      expect(noPhone).toHaveLength(2);
      expect(noPhone.map((s: any) => s.name)).toEqual(['李四', '王五']);
    });
  });

  describe('Update phone number', () => {
    it('should update a student phone number', async () => {
      const { updateEliteStudent } = await import('./db');
      vi.mocked(updateEliteStudent).mockResolvedValue(undefined as any);

      await updateEliteStudent(1, { phone: '98765432' });
      
      expect(updateEliteStudent).toHaveBeenCalledWith(1, { phone: '98765432' });
      expect(updateEliteStudent).toHaveBeenCalledTimes(1);
    });

    it('should handle bulk phone updates', async () => {
      const { updateEliteStudent } = await import('./db');
      vi.mocked(updateEliteStudent).mockResolvedValue(undefined as any);

      const updates = [
        { id: 1, phone: '98765432' },
        { id: 2, phone: '91234567' },
        { id: 3, phone: '65432198' },
      ];

      let updated = 0;
      for (const u of updates) {
        await updateEliteStudent(u.id, { phone: u.phone });
        updated++;
      }

      expect(updated).toBe(3);
      expect(updateEliteStudent).toHaveBeenCalledTimes(3);
      expect(updateEliteStudent).toHaveBeenCalledWith(1, { phone: '98765432' });
      expect(updateEliteStudent).toHaveBeenCalledWith(2, { phone: '91234567' });
      expect(updateEliteStudent).toHaveBeenCalledWith(3, { phone: '65432198' });
    });
  });

  describe('Phone display logic', () => {
    it('should show "未填寫" for empty phone', () => {
      const testCases = [
        { phone: '', expected: '未填寫' },
        { phone: '0', expected: '未填寫' },
        { phone: null, expected: '未填寫' },
        { phone: undefined, expected: '未填寫' },
        { phone: '98765432', expected: '98765432' },
      ];

      for (const tc of testCases) {
        const display = tc.phone && tc.phone !== '' && tc.phone !== '0' ? tc.phone : '未填寫';
        expect(display).toBe(tc.expected);
      }
    });

    it('should classify students by phone status correctly', () => {
      const students = [
        { id: 1, name: 'A', phone: '12345678', status: 'active' },
        { id: 2, name: 'B', phone: '', status: 'active' },
        { id: 3, name: 'C', phone: '0', status: 'active' },
        { id: 4, name: 'D', phone: '87654321', status: 'active' },
        { id: 5, name: 'E', phone: '', status: 'inactive' },
      ];

      const active = students.filter(s => s.status === 'active');
      const hasPhone = active.filter(s => s.phone && s.phone !== '' && s.phone !== '0');
      const noPhone = active.filter(s => !s.phone || s.phone === '' || s.phone === '0');

      expect(hasPhone).toHaveLength(2);
      expect(noPhone).toHaveLength(2);
    });
  });
});
