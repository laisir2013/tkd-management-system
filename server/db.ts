import { eq, and, inArray, gte, lte, sql, or, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, students, InsertStudent, paymentRecords, InsertPaymentRecord, Student, PaymentRecord, dojos, InsertDojo, Dojo, coaches, InsertCoach, Coach, beltLevels, InsertBeltLevel, BeltLevel, trainingSchedules, InsertTrainingSchedule, TrainingSchedule, attendanceRecords, InsertAttendanceRecord, AttendanceRecord, whatsappTemplates, InsertWhatsappTemplate, WhatsappTemplate, eliteStudents, InsertEliteStudent, EliteStudent, eliteTrainingSchedules, InsertEliteTrainingSchedule, EliteTrainingSchedule, eliteAttendanceRecords, InsertEliteAttendanceRecord, EliteAttendanceRecord, elitePaymentRecords, InsertElitePaymentRecord, ElitePaymentRecord } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // 使用 mysql2 pool 並明確指定 utf8mb4 charset，確保中文正確顯示
      const pool = mysql.createPool({
        host: 'localhost',
        user: 'tkd_user',
        password: 'tkd_pass_2026',
        database: 'taekwondo',
        charset: 'UTF8MB4_GENERAL_CI',
        waitForConnections: true,
        connectionLimit: 10,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Student queries
export async function getStudentsByPhone(phone: string): Promise<Student[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(students).where(eq(students.phone, phone));
}

export async function getAllStudents(): Promise<Student[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(students);
}

export async function getStudentById(id: number): Promise<Student | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudent(id: number, data: Partial<InsertStudent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(students).set(data).where(eq(students.id, id));
}

export async function bulkInsertStudents(studentList: InsertStudent[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(students).values(studentList);
}

// ============ Payment Records ============

export async function getPaymentRecordsByStudentId(studentId: number): Promise<PaymentRecord[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(paymentRecords).where(eq(paymentRecords.studentId, studentId));
}

export async function getPaymentRecordsByStudentIds(studentIds: number[]): Promise<PaymentRecord[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (studentIds.length === 0) return [];
  
  return db.select().from(paymentRecords).where(inArray(paymentRecords.studentId, studentIds));
}

export async function getAllPaymentRecords(): Promise<PaymentRecord[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(paymentRecords);
}

export async function insertPaymentRecord(record: InsertPaymentRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(paymentRecords).values(record);
}

export async function getStudentsWithPayments() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      student: students,
      payments: sql<string>`JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', ${paymentRecords.id},
          'paymentPeriod', ${paymentRecords.paymentPeriod},
          'customMonths', ${paymentRecords.customMonths},
          'amount', ${paymentRecords.amount},
          'receiptUrl', ${paymentRecords.receiptUrl},
          'paymentDate', ${paymentRecords.paymentDate},
          'receiptTransferDate', ${paymentRecords.receiptTransferDate},
          'status', ${paymentRecords.status},
          'confirmedBy', ${paymentRecords.confirmedBy},
          'createdAt', ${paymentRecords.createdAt}
        )
      )`,
    })
    .from(students)
    .leftJoin(paymentRecords, eq(students.id, paymentRecords.studentId))
    .groupBy(students.id);
  
  return result;
}

// 計算每位學生的季度繳費狀態
export interface QuarterlyPaymentStatus {
  studentId: number;
  studentName: string;
  phone: string;
  Q1: 'paid' | 'unpaid' | 'not_due'; // 1-3月
  Q2: 'paid' | 'unpaid' | 'not_due'; // 4-6月
  Q3: 'paid' | 'unpaid' | 'not_due'; // 7-9月
  Q4: 'paid' | 'unpaid' | 'not_due'; // 10-12月
  Q1PaymentDate?: string | null;
  Q2PaymentDate?: string | null;
  Q3PaymentDate?: string | null;
  Q4PaymentDate?: string | null;
  Q1ConfirmedBy?: string | null;
  Q2ConfirmedBy?: string | null;
  Q3ConfirmedBy?: string | null;
  Q4ConfirmedBy?: string | null;
  Q1ReceiptUrl?: string | null;
  Q2ReceiptUrl?: string | null;
  Q3ReceiptUrl?: string | null;
  Q4ReceiptUrl?: string | null;
}

export async function getQuarterlyPaymentStatuses(year?: number): Promise<QuarterlyPaymentStatus[]> {
  const db = await getDb();
  if (!db) return [];
  
  const allStudents = await getAllStudents();
  const allPayments = await getAllPaymentRecords();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const targetYear = year || currentYear; // 使用指定年份或當前年份
  
  // 判斷季度是否到期
  const isQuarterDue = (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): boolean => {
    const quarterMonths = {
      Q1: [1, 2, 3],
      Q2: [4, 5, 6],
      Q3: [7, 8, 9],
      Q4: [10, 11, 12],
    };
    const months = quarterMonths[quarter];
    return currentMonth >= months[0];
  };
  
  const statuses: QuarterlyPaymentStatus[] = allStudents.map(student => {
    // 篩選該年份的繳費紀錄
    const studentPayments = allPayments.filter(p => 
      p.studentId === student.id && 
      p.status === 'confirmed' && 
      (p.year === targetYear || (!p.year && targetYear === 2026)) // 相容舊資料（沒有 year 欄位的視為 2026）
    );
    
    const status: QuarterlyPaymentStatus = {
      studentId: student.id,
      studentName: student.name,
      phone: student.phone || '',
      Q1: 'not_due',
      Q2: 'not_due',
      Q3: 'not_due',
      Q4: 'not_due',
    };
    
    // 檢查每個季度
    (['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach(quarter => {
      // 只有查詢當前年份時才判斷是否到期，查詢歷史年份時全部視為已到期
      const isDue = targetYear < currentYear || (targetYear === currentYear && isQuarterDue(quarter));
      
      if (isDue) {
        // 已到期,檢查是否已繳費
        const payment = studentPayments.find(p => p.paymentPeriod === quarter);
        if (payment) {
          status[quarter] = 'paid';
          status[`${quarter}PaymentDate`] = payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : null;
          status[`${quarter}ConfirmedBy`] = payment.confirmedBy || null;
          status[`${quarter}ReceiptUrl`] = payment.receiptUrl || null;
        } else {
          status[quarter] = 'unpaid';
        }
      } else {
        // 未到期
        status[quarter] = 'not_due';
      }
    });
    
    return status;
  });
  
  return statuses;
}

// ============ Dojo Management ============

export async function getAllDojos(): Promise<Dojo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dojos);
}

export async function getDojoById(id: number): Promise<Dojo | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dojos).where(eq(dojos.id, id)).limit(1);
  return result[0];
}

export async function insertDojo(dojo: InsertDojo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(dojos).values(dojo);
}

export async function updateDojo(id: number, dojo: Partial<InsertDojo>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(dojos).set(dojo).where(eq(dojos.id, id));
}

export async function deleteDojo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(dojos).where(eq(dojos.id, id));
}

// ============ Coach Management ============

export async function getAllCoaches(): Promise<Coach[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coaches);
}

export async function getCoachById(id: number): Promise<Coach | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);
  return result[0];
}

export async function insertCoach(coach: InsertCoach) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(coaches).values(coach);
}

export async function updateCoach(id: number, coach: Partial<InsertCoach>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(coaches).set(coach).where(eq(coaches.id, id));
}

export async function deleteCoach(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(coaches).where(eq(coaches.id, id));
}

// ============ Belt Level Management ============

export async function getAllBeltLevels(): Promise<BeltLevel[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(beltLevels);
}

export async function getBeltLevelById(id: number): Promise<BeltLevel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(beltLevels).where(eq(beltLevels.id, id)).limit(1);
  return result[0];
}

export async function insertBeltLevel(level: InsertBeltLevel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(beltLevels).values(level);
}

export async function updateBeltLevel(id: number, level: Partial<InsertBeltLevel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(beltLevels).set(level).where(eq(beltLevels.id, id));
}

export async function deleteBeltLevel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(beltLevels).where(eq(beltLevels.id, id));
}

// ============ User Management ============

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStudentByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(students).where(eq(students.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(openId: string, role: 'admin' | 'coach' | 'user') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(users).set({ role }).where(eq(users.openId, openId));
}

export async function getAllCoachUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users).where(eq(users.role, 'coach'));
}

// ============ Statistics ============

export async function getCoachStatistics(coachName?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const allStudents = await getAllStudents();
  const allDojos = await getAllDojos();
  
  // 從 dojos 表獲取所有教練名稱
  const coachNames = new Set<string>();
  allDojos.forEach(dojo => {
    if (dojo.coachName) coachNames.add(dojo.coachName);
  });
  
  // 如果沒有教練，使用預設教練名稱
  if (coachNames.size === 0) {
    coachNames.add('賴政堡');
  }
  
  // 如果指定了教練名稱，只統計該教練
  if (coachName) {
    coachNames.clear();
    coachNames.add(coachName);
  }
  
  // 直接從 students 表計算所有學生的總學費
  // 因為所有學生都屬於同一位教練，不需要通過 dojos 表匹配
  const totalStudentCount = allStudents.length;
  const totalFee = allStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0);
  
  return Array.from(coachNames).map(name => ({
    coachName: name,
    studentCount: totalStudentCount,
    totalFee: totalFee,
  }));
}

export async function getQuarterlyFeeStatistics(year: number, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', coachName?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const allStudents = await getAllStudents();
  const allPayments = await getAllPaymentRecords();
  const allDojos = await getAllDojos();
  
  // 所有學生都屬於同一位教練，直接使用所有學生
  const filteredStudents = allStudents;
  
  // 計算應收總額（該季度所有學生的季度學費總和）
  const totalExpectedFee = filteredStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter), 0);
  
  // 計算實收金額（該季度實際已繳費的金額，根據 paymentPeriod 篩選）
  const paidPayments = allPayments.filter(p => 
    p.paymentPeriod === quarter && 
    p.status === 'confirmed' &&
    filteredStudents.some(s => s.id === p.studentId)
  );
  const totalPaidFee = paidPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  // 計算未收金額
  const totalUnpaidFee = totalExpectedFee - totalPaidFee;
  
  // 計算學生人數
  const totalStudents = filteredStudents.length;
  const paidStudentIds = new Set(paidPayments.map(p => p.studentId));
  const paidStudentCount = paidStudentIds.size;
  const unpaidStudentCount = totalStudents - paidStudentCount;
  
  return {
    year,
    quarter,
    totalExpectedFee,
    totalPaidFee,
    totalUnpaidFee,
    totalStudents,
    paidStudentCount,
    unpaidStudentCount,
  };
}

// ============ Training Schedules ============

export async function getTrainingSchedules(filters?: {
  venue?: string;
  scheduleDay?: string;
  scheduleTime?: string;
  year?: number;
  month?: number;
  status?: 'active' | 'cancelled';
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(trainingSchedules);
  
  const conditions = [];
  if (filters?.venue) conditions.push(eq(trainingSchedules.venue, filters.venue));
  if (filters?.scheduleDay) conditions.push(eq(trainingSchedules.scheduleDay, filters.scheduleDay));
  if (filters?.scheduleTime) conditions.push(eq(trainingSchedules.scheduleTime, filters.scheduleTime));
  if (filters?.status) conditions.push(eq(trainingSchedules.status, filters.status));
  
  if (filters?.year && filters?.month) {
    // 使用 UTC 日期避免時區偏移問題
    const startDate = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const endDate = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59));
    conditions.push(gte(trainingSchedules.trainingDate, startDate));
    conditions.push(lte(trainingSchedules.trainingDate, endDate));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const results = await query.orderBy(asc(trainingSchedules.trainingDate));
  return results;
}

export async function insertTrainingSchedule(schedule: InsertTrainingSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(trainingSchedules).values(schedule);
}

export async function updateTrainingScheduleStatus(id: number, status: 'active' | 'cancelled') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(trainingSchedules).set({ status }).where(eq(trainingSchedules.id, id));
}

// 自動生成訓練日期
export async function generateTrainingSchedules(year: number, month: number, venue: string, scheduleDay: string, scheduleTime: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 檢查是否已生成
  const existing = await getTrainingSchedules({ venue, scheduleDay, scheduleTime, year, month });
  if (existing.length > 0) {
    return existing; // 已存在，不重複生成
  }
  
  const dayMap: Record<string, number> = {
    '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
    '星期四': 4, '星期五': 5, '星期六': 6,
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6,
  };
  
  const targetDay = dayMap[scheduleDay];
  if (targetDay === undefined) {
    throw new Error(`Invalid schedule day: ${scheduleDay}`);
  }
  
  // 使用 UTC 日期避免時區偏移問題
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  
  const schedules: InsertTrainingSchedule[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === targetDay) {
      schedules.push({
        venue,
        scheduleDay,
        scheduleTime,
        trainingDate: new Date(d),
        status: 'active',
      });
    }
  }
  
  if (schedules.length > 0) {
    await db.insert(trainingSchedules).values(schedules);
  }
  
  return schedules;
}

// 自動生成全年訓練日期
export async function generateYearlyTrainingSchedules(year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allClassGroups = await getAllClassGroups();
  let totalGenerated = 0;
  
  for (const group of allClassGroups) {
    for (let month = 1; month <= 12; month++) {
      try {
        const schedules = await generateTrainingSchedules(
          year, month, group.venue, group.scheduleDay, group.scheduleTime
        );
        // generateTrainingSchedules 已經有去重檢查，如果已存在則返回現有的
        totalGenerated += schedules.length;
      } catch (e) {
        console.error(`Failed to generate schedules for ${group.venue} ${group.scheduleDay} ${group.scheduleTime} ${year}/${month}:`, e);
      }
    }
  }
  
  return totalGenerated;
}

// 自動生成單月訓練日期（為所有班別）
export async function generateMonthlyTrainingSchedules(year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allClassGroups = await getAllClassGroups();
  let totalGenerated = 0;
  
  for (const group of allClassGroups) {
    try {
      const schedules = await generateTrainingSchedules(
        year, month, group.venue, group.scheduleDay, group.scheduleTime
      );
      totalGenerated += schedules.length;
    } catch (e) {
      console.error(`Failed to generate schedules for ${group.venue} ${group.scheduleDay} ${group.scheduleTime} ${year}/${month}:`, e);
    }
  }
  
  return totalGenerated;
}

// ============ Attendance Records ============

export async function getAttendanceRecords(filters?: {
  studentId?: number;
  courseId?: number;
  venue?: string;
  scheduleDay?: string;
  scheduleTime?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(attendanceRecords);
  
  const conditions = [];
  if (filters?.studentId) conditions.push(eq(attendanceRecords.studentId, filters.studentId));
  if (filters?.courseId) conditions.push(eq(attendanceRecords.courseId, filters.courseId));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query;
}

export async function insertAttendanceRecord(record: InsertAttendanceRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(attendanceRecords).values(record);
}

export async function updateAttendanceRecordStatus(id: number, status: 'present' | 'absent' | 'late' | 'excused') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(attendanceRecords).set({ status }).where(eq(attendanceRecords.id, id));
}

// 創建或更新出席記錄
export async function upsertAttendanceRecord(studentId: number, courseId: number, attendanceDate: Date, status: 'present' | 'absent' | 'late' | 'excused') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 檢查是否已存在
  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.courseId, courseId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    // 更新
    return db
      .update(attendanceRecords)
      .set({ status })
      .where(eq(attendanceRecords.id, existing[0].id));
  } else {
    // 創建
    return db.insert(attendanceRecords).values({
      studentId,
      courseId,
      attendanceDate,
      status,
    });
  }
}

// 批量創建出席記錄
export async function bulkInsertAttendanceRecords(records: InsertAttendanceRecord[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (records.length === 0) return;
  return db.insert(attendanceRecords).values(records);
}

// 學生出席統計
export async function getStudentAttendanceStats(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const records = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.studentId, studentId));
  
  const totalClasses = records.length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const excusedCount = records.filter(r => r.status === 'excused').length;
  
  return {
    studentId,
    totalClasses,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate: totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0,
  };
}

// 根據班別查詢學生
export async function getStudentsByClass(venue: string, scheduleDay: string, scheduleTime: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(students)
    .where(
      and(
        eq(students.venue, venue),
        eq(students.scheduleDay, scheduleDay),
        eq(students.scheduleTime, scheduleTime)
      )
    );
}

// 查詢所有班別分組
export async function getAllClassGroups() {
  const db = await getDb();
  if (!db) return [];
  
  const allStudents = await getAllStudents();
  
  // 按班別分組
  const classMap = new Map<string, { venue: string; scheduleDay: string; scheduleTime: string; studentCount: number }>();
  
  allStudents.forEach(student => {
    const key = `${student.venue}-${student.scheduleDay}-${student.scheduleTime}`;
    const existing = classMap.get(key);
    if (existing) {
      existing.studentCount++;
    } else {
      classMap.set(key, {
        venue: student.venue || '',
        scheduleDay: student.scheduleDay || '',
        scheduleTime: student.scheduleTime || '',
        studentCount: 1,
      });
    }
  });
  
  return Array.from(classMap.values());
}

// ============ 精英班堂數追蹤 ============

export async function getEliteClassBalance(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const student = await getStudentById(studentId);
  if (!student || student.venue !== '精英班道場') return null;
  
  // 計算已繳堂數（所有 classCount 的總和）
  const payments = await getPaymentRecordsByStudentId(studentId);
  const paidClasses = payments
    .filter(p => p.status === 'confirmed' && p.classCount)
    .reduce((sum, p) => sum + (p.classCount || 0), 0);
  
  // 計算已上堂數（出席記錄）
  const attendanceList = await getAttendanceRecords({ studentId });
  const attendedClasses = attendanceList.filter(a => a.status === 'present').length;
  
  // 計算剩餘堂數
  const remainingClasses = paidClasses - attendedClasses;
  
  return {
    studentId,
    studentName: student.name,
    paidClasses,
    attendedClasses,
    remainingClasses,
  };
}

export async function getAllEliteClassBalances() {
  const db = await getDb();
  if (!db) return [];
  
  const allStudents = await getAllStudents();
  const eliteStudents = allStudents.filter(s => s.venue === '精英班道場');
  
  const balances = await Promise.all(
    eliteStudents.map(s => getEliteClassBalance(s.id))
  );
  
  return balances.filter(b => b !== null);
}

export async function getEliteClassStatistics() {
  const db = await getDb();
  if (!db) return null;
  
  const balances = await getAllEliteClassBalances();
  
  const totalStudents = balances.length;
  const totalPaidClasses = balances.reduce((sum, b) => sum + (b?.paidClasses || 0), 0);
  const totalAttendedClasses = balances.reduce((sum, b) => sum + (b?.attendedClasses || 0), 0);
  const totalRemainingClasses = balances.reduce((sum, b) => sum + (b?.remainingClasses || 0), 0);
  
  return {
    totalStudents,
    totalPaidClasses,
    totalAttendedClasses,
    totalRemainingClasses,
    averageAttendanceRate: totalPaidClasses > 0 ? (totalAttendedClasses / totalPaidClasses) * 100 : 0,
  };
}

// ============ WhatsApp Templates ============

export async function getAllWhatsappTemplates(): Promise<WhatsappTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappTemplates).orderBy(desc(whatsappTemplates.createdAt));
}

export async function getActiveWhatsappTemplates(): Promise<WhatsappTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappTemplates).where(eq(whatsappTemplates.isActive, true)).orderBy(desc(whatsappTemplates.createdAt));
}

export async function getWhatsappTemplateById(id: number): Promise<WhatsappTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.id, id)).limit(1);
  return result[0];
}

export async function createWhatsappTemplate(template: InsertWhatsappTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(whatsappTemplates).values(template);
}

export async function updateWhatsappTemplate(id: number, template: Partial<InsertWhatsappTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(whatsappTemplates).set(template).where(eq(whatsappTemplates.id, id));
}

export async function deleteWhatsappTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, id));
}

// ============ 精英班管理 ============

// --- 精英班學生 ---
export async function getAllEliteStudents(): Promise<EliteStudent[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eliteStudents).orderBy(asc(eliteStudents.name));
}

export async function getEliteStudentById(id: number): Promise<EliteStudent | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(eliteStudents).where(eq(eliteStudents.id, id)).limit(1);
  return result[0];
}

export async function getEliteStudentsByPhone(phone: string): Promise<EliteStudent[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eliteStudents).where(eq(eliteStudents.phone, phone));
}

export async function insertEliteStudent(data: InsertEliteStudent): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(eliteStudents).values(data);
  return result[0].insertId;
}

export async function updateEliteStudent(id: number, data: Partial<InsertEliteStudent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(eliteStudents).set(data).where(eq(eliteStudents.id, id));
}

export async function deleteEliteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 先刪除相關的出席記錄和繳費記錄
  await db.delete(eliteAttendanceRecords).where(eq(eliteAttendanceRecords.studentId, id));
  await db.delete(elitePaymentRecords).where(eq(elitePaymentRecords.studentId, id));
  return db.delete(eliteStudents).where(eq(eliteStudents.id, id));
}

// --- 精英班訓練日期 ---
export async function getEliteTrainingSchedules(params: { year?: number; month?: number; status?: string } = {}): Promise<EliteTrainingSchedule[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (params.year && params.month) {
    const startDate = new Date(Date.UTC(params.year, params.month - 1, 1));
    const endDate = new Date(Date.UTC(params.year, params.month, 0, 23, 59, 59));
    conditions.push(gte(eliteTrainingSchedules.trainingDate, startDate));
    conditions.push(lte(eliteTrainingSchedules.trainingDate, endDate));
  }
  if (params.status) {
    conditions.push(eq(eliteTrainingSchedules.status, params.status as any));
  }
  if (conditions.length > 0) {
    return db.select().from(eliteTrainingSchedules).where(and(...conditions)).orderBy(asc(eliteTrainingSchedules.trainingDate));
  }
  return db.select().from(eliteTrainingSchedules).orderBy(asc(eliteTrainingSchedules.trainingDate));
}

export async function insertEliteTrainingSchedule(data: InsertEliteTrainingSchedule): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(eliteTrainingSchedules).values(data);
  return result[0].insertId;
}

export async function updateEliteTrainingScheduleStatus(id: number, status: 'active' | 'cancelled') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(eliteTrainingSchedules).set({ status }).where(eq(eliteTrainingSchedules.id, id));
}

export async function generateEliteTrainingSchedules(params: {
  year: number;
  month: number;
  scheduleDay: string;
  scheduleTime: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const dayMap: Record<string, number> = {
    '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
    '星期四': 4, '星期五': 5, '星期六': 6,
  };
  const targetDay = dayMap[params.scheduleDay];
  if (targetDay === undefined) throw new Error(`Invalid day: ${params.scheduleDay}`);
  
  const dates: Date[] = [];
  const daysInMonth = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(params.year, params.month - 1, d));
    if (date.getUTCDay() === targetDay) {
      dates.push(date);
    }
  }
  
  if (dates.length === 0) return [];
  
  // 檢查是否已存在
  const existing = await getEliteTrainingSchedules({ year: params.year, month: params.month });
  const existingDates = new Set(existing.map(s => s.trainingDate.toISOString().split('T')[0]));
  
  const newDates = dates.filter(d => !existingDates.has(d.toISOString().split('T')[0]));
  if (newDates.length === 0) return [];
  
  const values = newDates.map(d => ({
    trainingDate: d,
    scheduleDay: params.scheduleDay,
    scheduleTime: params.scheduleTime,
  }));
  
  await db.insert(eliteTrainingSchedules).values(values);
  return values;
}

// --- 精英班出席記錄 ---
export async function getEliteAttendanceRecords(params: { scheduleId?: number; studentId?: number; year?: number; month?: number } = {}): Promise<EliteAttendanceRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (params.scheduleId) {
    conditions.push(eq(eliteAttendanceRecords.scheduleId, params.scheduleId));
  }
  if (params.studentId) {
    conditions.push(eq(eliteAttendanceRecords.studentId, params.studentId));
  }
  if (conditions.length > 0) {
    return db.select().from(eliteAttendanceRecords).where(and(...conditions));
  }
  return db.select().from(eliteAttendanceRecords);
}

export async function upsertEliteAttendanceRecord(data: { scheduleId: number; studentId: number; status: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(eliteAttendanceRecords)
    .where(and(
      eq(eliteAttendanceRecords.scheduleId, data.scheduleId),
      eq(eliteAttendanceRecords.studentId, data.studentId)
    )).limit(1);
  
  if (existing.length > 0) {
    await db.update(eliteAttendanceRecords)
      .set({ status: data.status as any })
      .where(eq(eliteAttendanceRecords.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(eliteAttendanceRecords).values({
      scheduleId: data.scheduleId,
      studentId: data.studentId,
      status: data.status as any,
    });
    return result[0].insertId;
  }
}

// --- 精英班繳費記錄 ---
export async function getElitePaymentRecords(studentId?: number): Promise<ElitePaymentRecord[]> {
  const db = await getDb();
  if (!db) return [];
  if (studentId) {
    return db.select().from(elitePaymentRecords).where(eq(elitePaymentRecords.studentId, studentId)).orderBy(desc(elitePaymentRecords.paymentDate));
  }
  return db.select().from(elitePaymentRecords).orderBy(desc(elitePaymentRecords.paymentDate));
}

export async function insertElitePaymentRecord(data: InsertElitePaymentRecord): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(elitePaymentRecords).values(data);
  
  // 更新學生的剩餘堂數
  if (data.status === 'confirmed') {
    const student = await getEliteStudentById(data.studentId);
    if (student) {
      await db.update(eliteStudents)
        .set({ remainingClasses: student.remainingClasses + data.classCount })
        .where(eq(eliteStudents.id, data.studentId));
    }
  }
  
  return result[0].insertId;
}

export async function getEliteStudentBalance(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const student = await getEliteStudentById(studentId);
  if (!student) return null;
  
  // 計算已繳堂數
  const payments = await getElitePaymentRecords(studentId);
  const paidClasses = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.classCount, 0);
  
  // 計算已上堂數
  const attendance = await getEliteAttendanceRecords({ studentId });
  const attendedClasses = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  
  // 計算應繳費用：當上到已繳費的第 10 堂時，要交下一期 $2400
  // 邏輯：每 12 堂為一期，當 remaining <= 2（即已用到第 10 堂或以上）就觸發
  const remainingClasses = paidClasses - attendedClasses;
  const FEE_PER_CYCLE = 2400;
  const CYCLE_SIZE = 12;
  // 計算應繳期數：ceil((attended - paid + 3) / 12)，最少 0
  const owedPeriods = attendedClasses === 0 ? 0 : Math.max(0, Math.ceil((attendedClasses - paidClasses + 3) / CYCLE_SIZE));
  const amountDue = owedPeriods * FEE_PER_CYCLE;

  return {
    studentId,
    studentName: student.name,
    paidClasses,
    attendedClasses,
    remainingClasses,
    totalPaid: payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0),
    amountDue,
    owedPeriods,
  };
}

// ============ 精英班 12 堂循環計算 ============
export async function getEliteCycleInfo(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const student = await getEliteStudentById(studentId);
  if (!student) return null;
  
  // 取得所有出席記錄，並 join 訓練日期以獲取日期排序
  const attendanceWithDates = await db.select({
    attendanceId: eliteAttendanceRecords.id,
    scheduleId: eliteAttendanceRecords.scheduleId,
    status: eliteAttendanceRecords.status,
    trainingDate: eliteTrainingSchedules.trainingDate,
  })
    .from(eliteAttendanceRecords)
    .innerJoin(eliteTrainingSchedules, eq(eliteAttendanceRecords.scheduleId, eliteTrainingSchedules.id))
    .where(eq(eliteAttendanceRecords.studentId, studentId))
    .orderBy(asc(eliteTrainingSchedules.trainingDate));
  
  // 只算 present 和 late
  const attendedRecords = attendanceWithDates.filter(a => a.status === 'present' || a.status === 'late');
  const attendedCount = attendedRecords.length;
  
  // 計算當前循環中的堂數 (1-12)
  const cycleNumber = attendedCount === 0 ? 0 : ((attendedCount - 1) % 12) + 1;
  // 計算已完成的完整循環數
  const completedCycles = Math.floor(attendedCount / 12);
  // 是否需要繳費提醒 (第 10-12 堂)
  const needPaymentReminder = cycleNumber >= 10;
  
  // 今期第 1 堂的日期
  let cycleStartDate: string | null = null;
  if (attendedCount > 0) {
    const cycleStartIndex = completedCycles * 12;
    if (cycleStartIndex < attendedRecords.length) {
      cycleStartDate = attendedRecords[cycleStartIndex].trainingDate?.toISOString() || null;
    }
  }
  
  return {
    studentId,
    studentName: student.name,
    phone: student.phone,
    totalAttended: attendedCount,
    cycleNumber,
    completedCycles,
    needPaymentReminder,
    cycleStartDate,
    feePerCycle: 2400, // 每 12 堂 $2,400
  };
}

export async function getAllEliteCycleInfo() {
  const students = await getAllEliteStudents();
  const activeStudents = students.filter(s => s.status === 'active');
  const results = await Promise.all(activeStudents.map(s => getEliteCycleInfo(s.id)));
  return results.filter(r => r !== null);
}

// ============ 家長出席查詢 ============
export async function getParentAttendanceRecords(phone: string, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 先找到該電話號碼的所有學生
  const studentList = await db.select().from(students).where(eq(students.phone, phone));
  if (studentList.length === 0) return [];
  
  const studentIds = studentList.map(s => s.id);
  
  // 找到該月份所有訓練日期（根據學生的班別）
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  
  // 取得所有相關的訓練日期
  const schedules = await db.select().from(trainingSchedules)
    .where(
      and(
        gte(trainingSchedules.trainingDate, startDate),
        lte(trainingSchedules.trainingDate, endDate),
      )
    );
  
  // 取得所有出席記錄
  const records = await db.select().from(attendanceRecords)
    .where(
      and(
        inArray(attendanceRecords.studentId, studentIds),
        gte(attendanceRecords.attendanceDate, startDate),
        lte(attendanceRecords.attendanceDate, endDate),
      )
    );
  
  // 組合結果：每個學生的每個訓練日期的出席狀態
  return studentList.map(student => {
    // 找到該學生班別的訓練日期
    const studentSchedules = schedules.filter(s => 
      s.venue === student.venue && 
      s.scheduleDay === student.scheduleDay && 
      s.scheduleTime === student.scheduleTime
    );
    
    return {
      student: {
        id: student.id,
        name: student.name,
        venue: student.venue,
        scheduleDay: student.scheduleDay,
        scheduleTime: student.scheduleTime,
      },
      schedules: studentSchedules.map(schedule => {
        const record = records.find(r => 
          r.studentId === student.id && r.courseId === schedule.id
        );
        return {
          scheduleId: schedule.id,
          date: schedule.trainingDate,
          status: schedule.status, // active or cancelled
          attendanceStatus: record?.status || null, // present/absent/late/excused or null (not recorded)
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  });
}


// ============ 家長頁面整合：精英班資料 ============
export async function getParentEliteInfo(phone: string) {
  const db = await getDb();
  if (!db) return null;

  // 找到該電話號碼的精英班學生
  const eliteStudentList = await db.select().from(eliteStudents)
    .where(eq(eliteStudents.phone, phone));
  
  if (eliteStudentList.length === 0) return null;

  const results = [];
  
  for (const student of eliteStudentList) {
    // 取得所有出席記錄（含訓練日期資訊）
    const attendanceList = await db.select({
      attendanceId: eliteAttendanceRecords.id,
      scheduleId: eliteAttendanceRecords.scheduleId,
      status: eliteAttendanceRecords.status,
      trainingDate: eliteTrainingSchedules.trainingDate,
    })
    .from(eliteAttendanceRecords)
    .innerJoin(eliteTrainingSchedules, eq(eliteAttendanceRecords.scheduleId, eliteTrainingSchedules.id))
    .where(eq(eliteAttendanceRecords.studentId, student.id))
    .orderBy(asc(eliteTrainingSchedules.trainingDate));

    // 只計算出席的（present）
    const presentRecords = attendanceList.filter(a => a.status === 'present');
    const totalAttended = presentRecords.length;
    
    // 計算當前循環中的堂數 (1-12)
    const cycleNumber = totalAttended === 0 ? 0 : ((totalAttended - 1) % 12) + 1;
    const completedCycles = Math.floor(totalAttended / 12);
    const needPaymentReminder = cycleNumber >= 10;

    // 取得繳費記錄
    const payments = await db.select().from(elitePaymentRecords)
      .where(eq(elitePaymentRecords.studentId, student.id))
      .orderBy(desc(elitePaymentRecords.paymentDate));
    
    const paidClasses = payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.classCount, 0);
    
    const remainingClasses = paidClasses - totalAttended;
    const needPayment = remainingClasses <= 0;

    // 出席詳情列表：第1堂、第2堂...
    const attendanceDetails = presentRecords.map((record, index) => ({
      classNumber: index + 1,
      date: record.trainingDate,
      cycleNumber: ((index) % 12) + 1, // 在12堂循環中的位置
      cycleIndex: Math.floor(index / 12) + 1, // 第幾期
    }));

    results.push({
      student: {
        id: student.id,
        name: student.name,
        scheduleDay: student.scheduleDay,
        scheduleTime: student.scheduleTime,
        beltLevel: student.beltLevel,
        status: student.status,
      },
      totalAttended,
      cycleNumber,
      completedCycles,
      needPaymentReminder,
      paidClasses,
      remainingClasses,
      needPayment,
      payments: payments.map(p => ({
        id: p.id,
        classCount: p.classCount,
        amount: p.amount,
        paymentDate: p.paymentDate,
        status: p.status,
      })),
      attendanceDetails,
    });
  }

  return results;
}
