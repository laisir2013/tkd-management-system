import { eq, and, inArray, gte, lte, sql, or, desc, asc, isNull, between } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, students, InsertStudent, paymentRecords, InsertPaymentRecord, Student, PaymentRecord, dojos, InsertDojo, Dojo, coaches, InsertCoach, Coach, beltLevels, InsertBeltLevel, BeltLevel, trainingSchedules, InsertTrainingSchedule, TrainingSchedule, attendanceRecords, InsertAttendanceRecord, AttendanceRecord, whatsappTemplates, InsertWhatsappTemplate, WhatsappTemplate, eliteStudents, InsertEliteStudent, EliteStudent, eliteTrainingSchedules, InsertEliteTrainingSchedule, EliteTrainingSchedule, eliteAttendanceRecords, InsertEliteAttendanceRecord, EliteAttendanceRecord, elitePaymentRecords, InsertElitePaymentRecord, ElitePaymentRecord, accountingRecords, InsertAccountingRecord, AccountingRecord, events, InsertEvent, Event, eventRegistrations, InsertEventRegistration, EventRegistration, examSessions, InsertExamSession, ExamSession, examCandidates, InsertExamCandidate, ExamCandidate, examScoringItems, InsertExamScoringItem, ExamScoringItem, examScores, InsertExamScore, ExamScore, examSchedules, InsertExamSchedule, ExamSchedule, chartOfAccounts, journalEntries, journalEntryLines, mappingRules, systemConfig, bankStatements, InsertBankStatement, BankStatement, bankStatementTransactions, InsertBankStatementTransaction, BankStatementTransaction, studentLeaveMonths, examPayments, InsertExamPayment, ExamPayment } from "../drizzle/schema";
import { ENV } from './_core/env';

// 安全解析 customMonths JSON：防止 double-parse 和無效格式
function safeParseCustomMonths(value: any): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { 
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
  return null;
}

/**
 * 從 customMonths 值提取月份數字列表（通用函數）
 * 處理所有可能的格式：
 *   ["1月","2月","3月","4月","5月","6月"]  — 標準陣列
 *   ["1月，2月，3月，4月，5月，6月"]       — 全形逗號分隔的單字串
 *   ["2025年12月，2026年1-3月"]           — 跨年/範圍格式
 * 
 * @param customMonths - raw customMonths 欄位值（string | string[] | null）
 * @param targetYear - 目標年份（用於跨年格式過濾）
 * @returns 月份數字陣列（1-12）
 */
export function extractMonthNumbers(customMonths: any, targetYear?: number): number[] {
  const arr = safeParseCustomMonths(customMonths);
  if (!arr || !Array.isArray(arr)) return [];
  
  const monthNums: number[] = [];
  
  // 展平：把所有元素用全形/半形逗號拆開
  const parts: string[] = [];
  arr.forEach((item: string) => {
    item.split(/[，,]/).forEach(p => parts.push(p.trim()));
  });
  
  parts.forEach(part => {
    if (!part) return;
    
    // 格式：「2025年12月」或「2026年1-3月」
    const yearMatch = part.match(/(\d{4})年(\d{1,2})(?:\s*[-~]\s*(\d{1,2}))?月/);
    if (yearMatch) {
      const partYear = parseInt(yearMatch[1]);
      if (!targetYear || partYear === targetYear) {
        const startM = parseInt(yearMatch[2]);
        const endM = yearMatch[3] ? parseInt(yearMatch[3]) : startM;
        for (let m = startM; m <= endM; m++) {
          if (m >= 1 && m <= 12) monthNums.push(m);
        }
      }
      return;
    }
    
    // 格式：「1月」「2月」「1-3月」等（不帶年份）
    const simpleMatch = part.match(/(\d{1,2})(?:\s*[-~]\s*(\d{1,2}))?月/);
    if (simpleMatch) {
      const startM = parseInt(simpleMatch[1]);
      const endM = simpleMatch[2] ? parseInt(simpleMatch[2]) : startM;
      for (let m = startM; m <= endM; m++) {
        if (m >= 1 && m <= 12) monthNums.push(m);
      }
      return;
    }
    
    // 最後嘗試：純數字
    const num = parseInt(part.replace(/[^0-9]/g, ''));
    if (num >= 1 && num <= 12) monthNums.push(num);
  });
  
  return [...new Set(monthNums)]; // 去重
}

let _db: ReturnType<typeof drizzle> | null = null;
let _rawPool: mysql.Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // 使用 mysql2 pool 並明確指定 utf8mb4 charset，確保中文正確顯示
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
      });
      // 確保每個連接都使用 utf8mb4
      pool.on('connection', (connection: any) => {
        connection.query('SET NAMES utf8mb4');
      });
      _db = drizzle(pool);
      // Auto-migrate: 確保 receivingBank 欄位存在
      try {
        await pool.promise().query(`ALTER TABLE paymentRecords ADD COLUMN receivingBank VARCHAR(100) NULL AFTER bank`).catch(() => {});
        await pool.promise().query(`ALTER TABLE accounting_records ADD COLUMN receiving_bank VARCHAR(100) NULL AFTER bank`).catch(() => {});
        console.log("[Database] receivingBank columns ensured");
      } catch (migErr) {
        // Column already exists or other non-critical error
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Raw mysql2 pool for direct SQL queries (used by receipt review, duplicate detection, etc.)
export async function getRawPool() {
  if (!_rawPool && process.env.DATABASE_URL) {
    _rawPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return _rawPool;
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

export async function getPaymentRecordById(id: number): Promise<PaymentRecord | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(paymentRecords).where(eq(paymentRecords.id, id)).limit(1);
  return results[0] || null;
}

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

export async function insertPaymentRecord(record: InsertPaymentRecord): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(paymentRecords).values(record);
  return result[0].insertId;
}

/**
 * 批准待審核的繳費記錄（將 pending 改為 confirmed）
 */
export async function approvePaymentRecord(recordId: number, approvedBy: string = 'admin_approved') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(paymentRecords)
    .set({ status: 'confirmed', confirmedBy: approvedBy })
    .where(eq(paymentRecords.id, recordId));
}

/**
 * 撤銷繳費：刪除指定學生/年/月的繳費記錄
 * - 單月繳費(MONTHLY)：直接刪除 paymentMonth = month 的記錄
 * - 季度繳費(Q1-Q4)：刪除整筆季度記錄（同時影響該季3個月）
 * - 自選月份(CUSTOM)：刪除包含該月的 CUSTOM 記錄
 */
export async function deletePaymentForMonth(studentId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 找出哪個季度
  let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  if (month <= 3) quarter = 'Q1';
  else if (month <= 6) quarter = 'Q2';
  else if (month <= 9) quarter = 'Q3';
  else quarter = 'Q4';

  // 1. 刪除 MONTHLY 記錄（精確匹配月份）
  await db.delete(paymentRecords).where(
    and(
      eq(paymentRecords.studentId, studentId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.paymentPeriod, 'MONTHLY'),
      eq(paymentRecords.paymentMonth, month),
    )
  );

  // 2. 刪除對應季度的記錄（Q1/Q2/Q3/Q4）
  await db.delete(paymentRecords).where(
    and(
      eq(paymentRecords.studentId, studentId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.paymentPeriod, quarter),
    )
  );

  // 3. 刪除包含該月的 CUSTOM 記錄
  // CUSTOM 的 customMonths JSON 可能包含 "2026-01" 或 "1月" 等格式
  const customRecords = await db.select().from(paymentRecords).where(
    and(
      eq(paymentRecords.studentId, studentId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.paymentPeriod, 'CUSTOM'),
    )
  );
  
  for (const rec of customRecords) {
    if (!rec.customMonths) continue;
    const monthNums = extractMonthNumbers(rec.customMonths, year);
    const matchesMonth = monthNums.includes(month);
    
    if (matchesMonth) {
      await db.delete(paymentRecords).where(eq(paymentRecords.id, rec.id));
    }
  }

  return { success: true };
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
  venue: string;
  coach: string;
  feePerQuarter: string;
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
  Q1PaymentRecordId?: number | null;
  Q2PaymentRecordId?: number | null;
  Q3PaymentRecordId?: number | null;
  Q4PaymentRecordId?: number | null;
  Q1Bank?: string | null;
  Q2Bank?: string | null;
  Q3Bank?: string | null;
  Q4Bank?: string | null;
  Q1ReceivingBank?: string | null;
  Q2ReceivingBank?: string | null;
  Q3ReceivingBank?: string | null;
  Q4ReceivingBank?: string | null;
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

  // 載入該年份的請假記錄
  const allLeaves = await getLeaveMonths(targetYear);
  const leaveMap = new Map<number, Set<number>>();
  for (const lv of allLeaves) {
    if (!leaveMap.has(lv.studentId)) leaveMap.set(lv.studentId, new Set());
    leaveMap.get(lv.studentId)!.add(lv.month);
  }
  
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
      venue: student.venue || '',
      coach: (student as any).coach || '',
      feePerQuarter: String(student.feePerQuarter || '0'),
      Q1: 'not_due',
      Q2: 'not_due',
      Q3: 'not_due',
      Q4: 'not_due',
    };
    
    // 檢查每個季度
    const quarterMonthsMap: Record<string, number[]> = {
      Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
    };

    // 建立月繳記錄的 map（用於檢查月繳覆蓋季度的情況）
    const monthlyPaidMap = new Map<number, typeof studentPayments[0]>();
    studentPayments.forEach(p => {
      if (p.paymentPeriod === 'MONTHLY' && p.paymentMonth) {
        monthlyPaidMap.set(p.paymentMonth, p);
      }
      // CUSTOM 繳費也可能覆蓋某些月份
      if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
        const months = extractMonthNumbers(p.customMonths, targetYear);
        months.forEach((m: number) => monthlyPaidMap.set(m, p));
      }
    });

    (['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach(quarter => {
      // 只有查詢當前年份時才判斷是否到期，查詢歷史年份時全部視為已到期
      const isDue = targetYear < currentYear || (targetYear === currentYear && isQuarterDue(quarter));
      
      if (isDue) {
        // 1. 先檢查是否有季度繳費記錄（paymentPeriod === 'Q1' 等）
        const quarterPayment = studentPayments.find(p => p.paymentPeriod === quarter);
        if (quarterPayment) {
          status[quarter] = 'paid';
          status[`${quarter}PaymentDate`] = quarterPayment.paymentDate ? new Date(quarterPayment.paymentDate).toISOString().split('T')[0] : null;
          status[`${quarter}ConfirmedBy`] = quarterPayment.confirmedBy || null;
          status[`${quarter}ReceiptUrl`] = quarterPayment.receiptUrl || null;
          status[`${quarter}PaymentRecordId`] = quarterPayment.id || null;
          status[`${quarter}Bank`] = (quarterPayment as any).bank || null;
          status[`${quarter}ReceivingBank`] = (quarterPayment as any).receivingBank || null;
        } else {
          // 2. 沒有季度記錄 → 檢查該季度的已到期月份是否全部有月繳/CUSTOM記錄
          //    某些學生該季度只上2個月，排除了1個月後以月繳方式入帳
          //    只要所有「已到期月份」都有繳費記錄就視為已繳
          const qMonths = quarterMonthsMap[quarter];
          const dueMonthsInQuarter = qMonths.filter(m => 
            targetYear < currentYear || (targetYear === currentYear && m <= currentMonth)
          );
          
          if (dueMonthsInQuarter.length > 0) {
            const studentLeaves = leaveMap.get(student.id) || new Set<number>();
            // 請假月視同已覆蓋（不算未繳）
            const allDueMonthsPaid = dueMonthsInQuarter.every(m => monthlyPaidMap.has(m) || studentLeaves.has(m));
            if (allDueMonthsPaid) {
              // 用最後一筆月繳記錄的資訊
              const lastMonthPayment = monthlyPaidMap.get(dueMonthsInQuarter[dueMonthsInQuarter.length - 1])!;
              status[quarter] = 'paid';
              status[`${quarter}PaymentDate`] = lastMonthPayment.paymentDate ? new Date(lastMonthPayment.paymentDate).toISOString().split('T')[0] : null;
              status[`${quarter}ConfirmedBy`] = lastMonthPayment.confirmedBy || null;
              status[`${quarter}ReceiptUrl`] = lastMonthPayment.receiptUrl || null;
              status[`${quarter}PaymentRecordId`] = lastMonthPayment.id || null;
              status[`${quarter}Bank`] = (lastMonthPayment as any).bank || null;
              status[`${quarter}ReceivingBank`] = (lastMonthPayment as any).receivingBank || null;
            } else {
              // 檢查是否有部分月份已繳或請假（部分付款狀態）
              const somePaidOrLeave = dueMonthsInQuarter.some(m => monthlyPaidMap.has(m) || studentLeaves.has(m));
              status[quarter] = somePaidOrLeave ? 'paid' : 'unpaid';
              if (somePaidOrLeave) {
                // 取第一筆已繳月份的資訊
                const firstPaidMonth = dueMonthsInQuarter.find(m => monthlyPaidMap.has(m))!;
                const paidRecord = monthlyPaidMap.get(firstPaidMonth)!;
                status[`${quarter}PaymentDate`] = paidRecord.paymentDate ? new Date(paidRecord.paymentDate).toISOString().split('T')[0] : null;
                status[`${quarter}ConfirmedBy`] = paidRecord.confirmedBy || null;
                status[`${quarter}ReceiptUrl`] = paidRecord.receiptUrl || null;
                status[`${quarter}PaymentRecordId`] = paidRecord.id || null;
                status[`${quarter}Bank`] = (paidRecord as any).bank || null;
                status[`${quarter}ReceivingBank`] = (paidRecord as any).receivingBank || null;
              }
            }
          } else {
            status[quarter] = 'unpaid';
          }
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

// ============ Monthly Payment Statuses (月份顯示) ============

export interface MonthlyPaymentStatus {
  studentId: number;
  studentName: string;
  phone: string;
  venue: string;
  coach: string;
  feePerQuarter: string; // 季度學費（用於計算月費 = feePerQuarter / 3）
  months: {
    [key: number]: { // 1-12
      status: 'paid' | 'unpaid' | 'not_due' | 'pending' | 'leave';
      paymentDate?: string | null;
      confirmedBy?: string | null;
      receiptUrl?: string | null;
      paymentType?: 'quarterly' | 'monthly' | null; // 繳費方式
      amount?: string | null; // OCR 識別金額
      paymentRecordId?: number | null; // 繳費記錄 ID（用於審核）
      bank?: string | null; // 付款銀行
      receivingBank?: string | null; // 收款銀行
      leaveClasses?: number; // 請假堂數（0=整月, 1-5=具體堂數）
    };
  };
}

export async function getMonthlyPaymentStatuses(year?: number): Promise<MonthlyPaymentStatus[]> {
  const db = await getDb();
  if (!db) return [];
  
  const allStudents = await getAllStudents();
  const allPayments = await getAllPaymentRecords();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const targetYear = year || currentYear;

  // 載入該年份的請假記錄，建立 studentId → Set<month> 的快速查詢
  const allLeaves = await getLeaveMonths(targetYear);
  const leaveMap = new Map<number, Map<number, number>>(); // studentId → month → leaveClasses
  for (const lv of allLeaves) {
    if (!leaveMap.has(lv.studentId)) leaveMap.set(lv.studentId, new Map());
    leaveMap.get(lv.studentId)!.set(lv.month, lv.leaveClasses);
  }
  
  const statuses: MonthlyPaymentStatus[] = allStudents
    .filter(s => s.status === 'active' && s.venue !== '精英班道場')
    .map(student => {
      // 篩選該年份的繳費紀錄（包括已確認和待審核的）
      const studentPayments = allPayments.filter(p => 
        p.studentId === student.id && 
        (p.status === 'confirmed' || p.status === 'pending') && 
        (p.year === targetYear || (!p.year && targetYear === 2026))
      );
      
      // 建立已付款的月份 map
      const paidMonths = new Map<number, { paymentDate: string | null; confirmedBy: string | null; receiptUrl: string | null; paymentType: 'quarterly' | 'monthly'; isPending: boolean; amount: string | null; paymentRecordId: number | null; bank: string | null; receivingBank: string | null }>();
      
      studentPayments.forEach(p => {
        const paymentDate = p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : null;
        const confirmedBy = (p as any).confirmedBy || null;
        const receiptUrl = p.receiptUrl || null;
        const isPending = p.status === 'pending';
        const amount = p.amount || null;
        const paymentRecordId = p.id || null;
        const bank = (p as any).bank || null;
        const receivingBank = (p as any).receivingBank || null;
        
        if (p.paymentPeriod === 'MONTHLY' && p.paymentMonth) {
          // 單月繳費
          paidMonths.set(p.paymentMonth, { paymentDate, confirmedBy, receiptUrl, paymentType: 'monthly', isPending, amount, paymentRecordId, bank, receivingBank });
        } else if (p.paymentPeriod === 'Q1' || p.paymentPeriod === 'Q2' || p.paymentPeriod === 'Q3' || p.paymentPeriod === 'Q4') {
          // 季度繳費 → 覆蓋該季度的 3 個月
          const quarterMonths: Record<string, number[]> = {
            Q1: [1, 2, 3],
            Q2: [4, 5, 6],
            Q3: [7, 8, 9],
            Q4: [10, 11, 12],
          };
          const months = quarterMonths[p.paymentPeriod];
          months.forEach(m => {
            paidMonths.set(m, { paymentDate, confirmedBy, receiptUrl, paymentType: 'quarterly', isPending, amount, paymentRecordId, bank, receivingBank });
          });
        } else if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
          // 自選月份繳費
          const months = extractMonthNumbers(p.customMonths, targetYear);
          months.forEach((monthNum: number) => {
            paidMonths.set(monthNum, { paymentDate, confirmedBy, receiptUrl, paymentType: 'monthly', isPending, amount, paymentRecordId, bank, receivingBank });
          });
        }
      });
      
      // 建立 12 個月的狀態
      const months: MonthlyPaymentStatus['months'] = {};
      for (let m = 1; m <= 12; m++) {
        const paid = paidMonths.get(m);
        if (paid) {
          months[m] = {
            status: paid.isPending ? 'pending' : 'paid',
            paymentDate: paid.paymentDate,
            confirmedBy: paid.confirmedBy,
            receiptUrl: paid.receiptUrl,
            paymentType: paid.paymentType,
            amount: paid.amount,
            paymentRecordId: paid.paymentRecordId,
            bank: paid.bank,
            receivingBank: paid.receivingBank,
          };
        } else {
          // 判斷是否到期：查過去年份全部到期；查當年只有當月或之前的到期
          const isDue = targetYear < currentYear || (targetYear === currentYear && m <= currentMonth);
          // 檢查是否為請假月份
          const leaveClassesVal = leaveMap.get(student.id)?.get(m);
          const isLeave = leaveClassesVal !== undefined;
          months[m] = {
            status: isLeave ? 'leave' : (isDue ? 'unpaid' : 'not_due'),
            ...(isLeave ? { leaveClasses: leaveClassesVal } : {}),
          };
        }
      }
      
      return {
        studentId: student.id,
        studentName: student.name,
        phone: student.phone || '',
        venue: student.venue || '',
        coach: (student as any).coach || '',
        feePerQuarter: String(student.feePerQuarter || '0'),
        months,
      };
    });
  
  return statuses;
}

// ============ Student Leave Months (請假月份) ============

/** 查詢指定年份的所有請假記錄 */
export async function getLeaveMonths(year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(studentLeaveMonths).where(eq(studentLeaveMonths.year, year));
}

/** 查詢某位學生指定年份的請假月份 */
export async function getLeaveMonthsByStudent(studentId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(studentLeaveMonths).where(
    and(eq(studentLeaveMonths.studentId, studentId), eq(studentLeaveMonths.year, year))
  );
}

/** 星期對照表 */
const WEEKDAY_MAP_DB: Record<string, number> = {
  '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3,
  '星期四': 4, '星期五': 5, '星期六': 6,
};

/** 計算某月某星期幾的所有日期 */
function getDatesForWeekdayInMonth(year: number, month: number, weekday: number): Date[] {
  const dates: Date[] = [];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const d = new Date(monthStart);
  while (d <= monthEnd) {
    if (d.getDay() === weekday) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** 計算請假扣減金額和描述 */
function calculateLeaveDeduction(
  feePerQuarter: number,
  scheduleDay: string | null | undefined,
  year: number,
  month: number,
  leaveClasses: number,
): { deduction: number; actualClasses: number; totalClasses: number; leaveDates: string[]; description: string } {
  const monthlyFee = feePerQuarter / 3;
  const perClassFee = monthlyFee / 4;

  // 計算該月實際有幾堂課及日期
  const weekday = scheduleDay ? WEEKDAY_MAP_DB[scheduleDay] : undefined;
  let totalClasses = 4;
  let classDates: Date[] = [];
  if (weekday !== undefined) {
    classDates = getDatesForWeekdayInMonth(year, month, weekday);
    totalClasses = classDates.length;
  }

  // leaveClasses=0 = 整月請假
  const actualClasses = leaveClasses === 0
    ? totalClasses
    : Math.min(leaveClasses, totalClasses);

  const deduction = Math.round(perClassFee * actualClasses);

  // 生成日期字串
  let leaveDates: string[] = [];
  if (classDates.length > 0) {
    // 取最後 N 個日期作為請假日（假設從月底往前請假）
    // 整月則全部日期
    if (leaveClasses === 0) {
      leaveDates = classDates.map(d => `${d.getMonth() + 1}/${d.getDate()}`);
    } else {
      // 取最後 N 堂
      leaveDates = classDates.slice(-actualClasses).map(d => `${d.getMonth() + 1}/${d.getDate()}`);
    }
  }

  const dateStr = leaveDates.length > 0 ? ` (${leaveDates.join(', ')})` : '';
  const description = leaveClasses === 0
    ? `${month}月整月請假${actualClasses}堂${dateStr}，扣$${deduction}`
    : `${month}月請假${actualClasses}堂${dateStr}，扣$${deduction}`;

  return { deduction, actualClasses, totalClasses, leaveDates, description };
}

/** 標記請假（leaveClasses: 0=整月, 1-4=具體堂數）+ 自動同步會計紀錄 */
export async function insertLeaveMonth(studentId: number, year: number, month: number, leaveClasses: number = 0, notes?: string) {
  const db = await getDb();
  if (!db) return;

  // 1. upsert leave record
  await db.insert(studentLeaveMonths).values({ studentId, year, month, leaveClasses, notes: notes || null })
    .onDuplicateKeyUpdate({ set: { leaveClasses, notes: notes || null } });

  // 2. 同步會計紀錄 (accounting_records + journal_entries)
  try {
    const student = await getStudentById(studentId);
    if (!student) return;

    const feePerQuarter = parseFloat(String(student.feePerQuarter || '0'));
    if (feePerQuarter <= 0) return; // 無學費設定，跳過

    const scheduleDay = (student as any).scheduleDay || (student as any).schedule_day;
    const { deduction, actualClasses, totalClasses, leaveDates, description: leaveDesc } = calculateLeaveDeduction(
      feePerQuarter, scheduleDay, year, month, leaveClasses
    );

    if (deduction <= 0) return;

    const studentName = student.name;
    const dateStr = leaveDates.length > 0 ? ` (${leaveDates.join(', ')})` : '';
    const arDescription = `${studentName} ${year}年${month}月請假扣減 — ${leaveClasses === 0 ? '整月' : `${actualClasses}堂`}${dateStr}`;

    // 先刪除舊的同步紀錄（如果有）— 避免重複
    const existingAr = await db.select().from(accountingRecords)
      .where(and(
        eq(accountingRecords.studentName, studentName),
        eq(accountingRecords.category, 'leave_deduction'),
        sql`YEAR(${accountingRecords.transactionDate}) = ${year}`,
        sql`MONTH(${accountingRecords.transactionDate}) = ${month}`,
      )).limit(1);

    if (existingAr.length > 0) {
      const oldAr = existingAr[0];
      // 刪除舊的 JE 和 JEL
      if (oldAr.journalEntryId) {
        await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, oldAr.journalEntryId));
        await db.delete(journalEntries).where(eq(journalEntries.id, oldAr.journalEntryId));
      }
      await db.delete(accountingRecords).where(eq(accountingRecords.id, oldAr.id));
    }

    // 插入 AR（type=expense, category=leave_deduction）
    const transactionDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const arResult = await db.insert(accountingRecords).values({
      transactionDate,
      amount: deduction.toString(),
      type: 'expense',
      category: 'leave_deduction',
      description: arDescription,
      studentName,
      source: 'auto_sync',
    } as any);
    const arId = Number((arResult as any)[0].insertId);

    // 插入 JE + JEL：Dr. 4001 (沖銷學費收入) / Cr. 2003 (應付請假扣減)
    const fiscalYear = year;
    const fiscalMonth = month;

    const jeId = await db.transaction(async (tx: any) => {
      // 生成 entry number
      const yearMonth = `${fiscalYear}${fiscalMonth.toString().padStart(2, '0')}`;
      const result = await tx.execute(sql`
        SELECT entry_number FROM journal_entries
        WHERE fiscal_year = ${fiscalYear} AND fiscal_month = ${fiscalMonth}
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `);
      let seq = 1;
      const rows = (result[0] as Array<{ entry_number: string }>);
      if (rows.length > 0) {
        const parts = rows[0].entry_number.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      const entryNumber = `JE-${yearMonth}-${seq.toString().padStart(4, '0')}`;

      const insertResult = await tx.insert(journalEntries).values({
        entryNumber,
        entryDate: transactionDate,
        description: arDescription,
        sourceType: 'auto_sync',
        sourceId: arId,
        sourceTable: 'accounting_records',
        fiscalYear,
        fiscalMonth,
        isPosted: true,
        postedAt: new Date(),
        postedBy: 'system',
      });
      const newJeId = Number(insertResult[0].insertId);

      // Dr. 4001 學費收入（沖銷）/ Cr. 1001 銀行（未來少收）
      await tx.insert(journalEntryLines).values([
        {
          journalEntryId: newJeId,
          accountCode: '4001',
          debit: deduction.toString(),
          credit: '0.00',
          description: `請假扣減 — ${studentName} ${year}年${month}月`,
        },
        {
          journalEntryId: newJeId,
          accountCode: '1001',
          debit: '0.00',
          credit: deduction.toString(),
          description: `請假扣減 — ${studentName} ${year}年${month}月`,
        },
      ]);

      return newJeId;
    });

    // 連結 AR → JE
    await db.update(accountingRecords).set({ journalEntryId: jeId } as any).where(eq(accountingRecords.id, arId));

    console.log(`[LeaveSync] ${studentName} ${year}年${month}月請假 → AR#${arId} + JE#${jeId}，扣$${deduction}`);
  } catch (err) {
    console.error('[LeaveSync] 同步會計紀錄失敗:', err);
    // 不阻擋請假紀錄本身的儲存
  }
}

/** 取消請假 + 自動刪除對應會計紀錄 */
export async function deleteLeaveMonth(studentId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return;

  // 1. 刪除 leave record
  await db.delete(studentLeaveMonths).where(
    and(
      eq(studentLeaveMonths.studentId, studentId),
      eq(studentLeaveMonths.year, year),
      eq(studentLeaveMonths.month, month),
    )
  );

  // 2. 刪除對應的會計紀錄
  try {
    const student = await getStudentById(studentId);
    if (!student) return;

    const existingAr = await db.select().from(accountingRecords)
      .where(and(
        eq(accountingRecords.studentName, student.name),
        eq(accountingRecords.category, 'leave_deduction'),
        sql`YEAR(${accountingRecords.transactionDate}) = ${year}`,
        sql`MONTH(${accountingRecords.transactionDate}) = ${month}`,
      )).limit(1);

    if (existingAr.length > 0) {
      const ar = existingAr[0];
      // 刪除 JE + JEL
      if (ar.journalEntryId) {
        await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, ar.journalEntryId));
        await db.delete(journalEntries).where(eq(journalEntries.id, ar.journalEntryId));
      }
      // 刪除 AR
      await db.delete(accountingRecords).where(eq(accountingRecords.id, ar.id));
      console.log(`[LeaveSync] 取消 ${student.name} ${year}年${month}月請假 → 已刪除 AR#${ar.id}`);
    }
  } catch (err) {
    console.error('[LeaveSync] 刪除會計紀錄失敗:', err);
  }
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
  
  // 從學生的 coach 欄位取得所有教練名稱
  const COACHES_FALLBACK = ['賴政堡教練', '鄺富華教練', '林學曉教練', '何翰錕教練', '許悠教練'];
  const coachNames = new Set<string>(COACHES_FALLBACK);
  allStudents.forEach(s => {
    if (s.coach) coachNames.add(s.coach);
  });

  // 如果指定了教練名稱，只統計該教練
  if (coachName) {
    coachNames.clear();
    coachNames.add(coachName);
  }
  
  // 只計算活躍學生，排除精英班道場
  const activeRegularStudents = allStudents.filter(s => s.status === 'active' && s.venue !== '精英班道場');
  
  return Array.from(coachNames).map(name => {
    // 直接用學生的 coach 欄位過濾
    const coachStudents = activeRegularStudents.filter(s => s.coach === name);
    
    return {
      coachName: name,
      studentCount: coachStudents.length,
      totalFee: coachStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0),
    };
  });
}

export async function getQuarterlyFeeStatistics(year: number, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', coachName?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const allStudents = await getAllStudents();
  const allPayments = await getAllPaymentRecords();
  
  // 根據教練名稱過濾學生：直接用學生的 coach 欄位
  let filteredStudents = allStudents.filter(s => s.status === 'active' && s.venue !== '精英班道場');
  if (coachName) {
    filteredStudents = filteredStudents.filter(s => s.coach === coachName);
  }
  
  // 該季度對應的月份
  const quarterMonths: Record<string, number[]> = {
    Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
  };
  const months = quarterMonths[quarter];

  // 載入該年份的請假記錄
  const allLeaves = await getLeaveMonths(year);
  const studentLeaveSet = new Map<number, Set<number>>();
  for (const lv of allLeaves) {
    if (!studentLeaveSet.has(lv.studentId)) studentLeaveSet.set(lv.studentId, new Set());
    studentLeaveSet.get(lv.studentId)!.add(lv.month);
  }

  // 計算應收總額（扣除請假月份）
  let totalExpectedFee = 0;
  filteredStudents.forEach(s => {
    const feePerQuarter = parseFloat(s.feePerQuarter || '0');
    const leaves = studentLeaveSet.get(s.id);
    if (leaves) {
      const leaveInQuarter = months.filter(m => leaves.has(m)).length;
      const activeMonths = 3 - leaveInQuarter;
      totalExpectedFee += (feePerQuarter / 3) * activeMonths;
    } else {
      totalExpectedFee += feePerQuarter;
    }
  });
  totalExpectedFee = Math.round(totalExpectedFee * 100) / 100;
  
  // 篩選該年度已確認的繳費記錄
  const yearPayments = allPayments.filter(p =>
    p.status === 'confirmed' &&
    p.year === year &&
    filteredStudents.some(s => s.id === p.studentId)
  );
  
  // 建立每個學生在該季度已繳的月份集合
  const studentPaidMonths = new Map<number, Set<number>>();
  
  yearPayments.forEach(p => {
    if (!studentPaidMonths.has(p.studentId)) {
      studentPaidMonths.set(p.studentId, new Set());
    }
    const paid = studentPaidMonths.get(p.studentId)!;
    
    // 季繳：整季 3 個月
    if (['Q1','Q2','Q3','Q4'].includes(p.paymentPeriod)) {
      const qm = quarterMonths[p.paymentPeriod];
      if (qm) qm.forEach(m => paid.add(m));
    }
    // 月繳：單月
    else if (p.paymentPeriod === 'MONTHLY' && p.paymentMonth) {
      paid.add(p.paymentMonth);
    }
    // 自選月份
    else if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
      const months = extractMonthNumbers(p.customMonths, year);
      months.forEach(m => paid.add(m));
    }
  });
  
  // 判斷每位學生是否已繳齊該季度 3 個月 → 計算實收金額
  let totalPaidFee = 0;
  const paidStudentIds = new Set<number>();
  const partialPaidStudentIds = new Set<number>();
  
  filteredStudents.forEach(s => {
    const paid = studentPaidMonths.get(s.id);
    const leaves = studentLeaveSet.get(s.id);
    
    // 該季度需要繳費的月份（排除請假月）
    const activeMonths = months.filter(m => !(leaves?.has(m)));
    
    if (activeMonths.length === 0) {
      // 整季都請假 → 視為已繳（無需付費）
      paidStudentIds.add(s.id);
      return;
    }
    
    if (!paid) return;
    
    const paidInQuarter = activeMonths.filter(m => paid.has(m));
    if (paidInQuarter.length === activeMonths.length) {
      // 所有需繳費的月份都已繳 → 計已繳金額
      const monthlyFee = parseFloat(s.feePerQuarter || '0') / 3;
      totalPaidFee += monthlyFee * paidInQuarter.length;
      paidStudentIds.add(s.id);
    } else if (paidInQuarter.length > 0) {
      // 部分月份已繳 → 按比例計算
      const monthlyFee = parseFloat(s.feePerQuarter || '0') / 3;
      totalPaidFee += monthlyFee * paidInQuarter.length;
      partialPaidStudentIds.add(s.id);
    }
  });
  
  totalPaidFee = Math.round(totalPaidFee * 100) / 100;
  
  // 計算未收金額
  const totalUnpaidFee = Math.round((totalExpectedFee - totalPaidFee) * 100) / 100;
  
  // 計算學生人數（完全已繳 + 部分已繳 都算已繳）
  const totalStudents = filteredStudents.length;
  const paidStudentCount = paidStudentIds.size + partialPaidStudentIds.size;
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
  scheduleId?: number;
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
  if (filters?.scheduleId) conditions.push(eq(attendanceRecords.scheduleId, filters.scheduleId));
  if (filters?.courseId) conditions.push(eq(attendanceRecords.courseId, filters.courseId));
  if (filters?.startDate) conditions.push(gte(attendanceRecords.attendanceDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(attendanceRecords.attendanceDate, filters.endDate));
  
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

// 創建或更新出席記錄 — 使用 scheduleId (training_schedules.id) + studentId 定位唯一記錄
export async function upsertAttendanceRecord(studentId: number, scheduleId: number, attendanceDate: Date, status: 'present' | 'absent' | 'late' | 'excused') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 用 scheduleId + studentId 做唯一定位
  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.scheduleId, scheduleId),
        eq(attendanceRecords.studentId, studentId)
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
    // 創建 — courseId 設為 null（legacy 欄位不再使用）
    return db.insert(attendanceRecords).values({
      scheduleId,
      studentId,
      attendanceDate,
      status,
    });
  }
}

// 刪除出席記錄 — 用 scheduleId + studentId 定位
export async function deleteAttendanceRecord(studentId: number, scheduleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .delete(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.scheduleId, scheduleId),
        eq(attendanceRecords.studentId, studentId)
      )
    );
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
  
  // 計算已上堂數（使用精英班出席記錄，而非恆常班）
  const attendanceList = await getEliteAttendanceRecords({ studentId });
  const attendedClasses = attendanceList.filter(a => a.status === 'present' || a.status === 'late').length;
  
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

export async function deleteElitePaymentRecord(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(elitePaymentRecords).where(eq(elitePaymentRecords.id, id));
}

export async function insertElitePaymentRecord(data: InsertElitePaymentRecord): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(elitePaymentRecords).values(data);
  
  // 注意：不再手動更新 eliteStudents.remainingClasses，
  // 改由 getEliteStudentBalance() 從付款與出席記錄即時計算，
  // 避免雙重記帳造成資料不一致。
  
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

// ============ 教練統計（含精英班） ============
export async function getCoachStatsWithElite(year?: number, quarter?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 動態從學生資料取得教練名稱
  const allStudents = await getAllStudents();
  const coachNameSet = new Set<string>();
  allStudents.forEach(s => { if (s.coach) coachNameSet.add(s.coach); });
  const COACHES = Array.from(coachNameSet);
  const allEliteStudents = await getAllEliteStudents();
  const allElitePayments = await db.select().from(elitePaymentRecords).orderBy(desc(elitePaymentRecords.paymentDate));
  
  const allRegularStudents = allStudents.filter(s => s.venue !== '精英班道場' && s.status === 'active');
  const regularStudentIdSet = new Set(allRegularStudents.map(s => s.id));
  
  // 按入帳日期歸季：以 receiptTransferDate（收據轉帳日期）為準，fallback 到 paymentDate
  const quarterMonths: Record<number, number[]> = { 1: [1,2,3], 2: [4,5,6], 3: [7,8,9], 4: [10,11,12] };
  
  /** 取得付款的入帳日期（優先使用收據轉帳日期） */
  function getEntryDate(p: any): Date | null {
    if (p.receiptTransferDate) return new Date(p.receiptTransferDate);
    if (p.paymentDate) return new Date(p.paymentDate);
    return null;
  }
  
  /**
   * 計算某筆付款在指定季度中應佔的金額
   * - Q1/Q2/Q3/Q4 標準付款：按 receiptTransferDate（收據轉帳日期）歸季，全額計入
   * - CUSTOM 付款：按 customMonths 覆蓋的月份比例分攤到各季
   */
  function getPaymentAmountForQuarter(p: any, targetYear: number, targetQuarter: number): number {
    const amount = parseFloat(p.amount || '0');
    if (amount <= 0) return 0;
    
    const months = quarterMonths[targetQuarter];
    
    if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
      // CUSTOM 付款：根據 customMonths 覆蓋月份按比例分攤
      const coveredMonths = extractMonthNumbers(p.customMonths, targetYear);
      if (coveredMonths.length === 0) return 0;
      const monthsInThisQuarter = coveredMonths.filter(m => months.includes(m)).length;
      if (monthsInThisQuarter === 0) return 0;
      // 按比例分攤
      return amount * (monthsInThisQuarter / coveredMonths.length);
    } else {
      // Q1/Q2/Q3/Q4 標準付款：用 receiptTransferDate 歸季（fallback paymentDate）
      const d = getEntryDate(p);
      if (!d) return 0;
      if (d.getFullYear() === targetYear && months.includes(d.getMonth() + 1)) {
        return amount;
      }
      return 0;
    }
  }
  
  /**
   * 判斷某筆付款是否屬於指定季度（用於計算已繳人數）
   */
  function isPaymentInQuarter(p: any, targetYear: number, targetQuarter: number): boolean {
    return getPaymentAmountForQuarter(p, targetYear, targetQuarter) > 0;
  }
  
  // 取得恆常班所有已確認繳費記錄
  let allConfirmedPayments: any[] = [];
  if (year && quarter) {
    const allPayments = await getAllPaymentRecords();
    allConfirmedPayments = allPayments.filter(p => {
      if (p.status !== 'confirmed') return false;
      if (!regularStudentIdSet.has(p.studentId)) return false;
      return true;
    });
  }
  
  return COACHES.map(coachName => {
    const regularStudents = allRegularStudents.filter(s => s.coach === coachName);
    const regularStudentCount = regularStudents.length;
    const regularExpectedFee = regularStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter || '0'), 0);
    
    // 恆常班「實收」= 按付款期歸季的金額總和（CUSTOM 按比例分攤）
    let regularPaidFee = regularExpectedFee;
    let regularPaidStudentCount = regularStudentCount;
    if (year && quarter) {
      const coachStudentIds = new Set(regularStudents.map(s => s.id));
      const coachPayments = allConfirmedPayments.filter(p => coachStudentIds.has(p.studentId));
      regularPaidFee = coachPayments.reduce((sum: number, p: any) => {
        return sum + getPaymentAmountForQuarter(p, year, quarter);
      }, 0);
      regularPaidFee = Math.round(regularPaidFee * 100) / 100;
      // 計算已繳費學生人數
      const paidStudentIds = new Set<number>();
      coachPayments.forEach((p: any) => {
        if (isPaymentInQuarter(p, year, quarter)) {
          paidStudentIds.add(p.studentId);
        }
      });
      regularPaidStudentCount = paidStudentIds.size;
    }
    
    // 精英班
    const eliteStudentsForCoach = allEliteStudents.filter(s => 
      s.status === 'active' && s.coach === coachName
    );
    const eliteStudentCount = eliteStudentsForCoach.length;
    const eliteStudentIds = new Set(eliteStudentsForCoach.map(s => s.id));
    let eliteConfirmedPayments = allElitePayments.filter(p => 
      eliteStudentIds.has(p.studentId) && 
      p.status === 'confirmed' &&
      p.classCount !== 99999
    );
    if (year && quarter) {
      const months = quarterMonths[quarter];
      eliteConfirmedPayments = eliteConfirmedPayments.filter(p => {
        // 精英班也用 receiptTransferDate 優先
        const d = (p as any).receiptTransferDate ? new Date((p as any).receiptTransferDate) 
                  : p.paymentDate ? new Date(p.paymentDate) : null;
        if (!d) return false;
        return d.getFullYear() === year && months.includes(d.getMonth() + 1);
      });
    }
    const eliteTotalPaid = eliteConfirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount as any || '0'), 0);
    const eliteTotalClasses = eliteConfirmedPayments.reduce((sum, p) => sum + (p.classCount || 0), 0);
    
    return {
      coachName,
      regularStudentCount,
      regularExpectedFee,
      regularTotalFee: regularPaidFee,
      regularPaidStudentCount,
      eliteStudentCount,
      eliteTotalPaid,
      eliteTotalClasses,
      eliteStudents: eliteStudentsForCoach.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        beltLevel: s.beltLevel,
      })),
      totalStudentCount: regularStudentCount + eliteStudentCount,
      totalRevenue: regularPaidFee + eliteTotalPaid,
    };
  });
}

/**
 * 每月財務報表：按教練、按月份計算恆常班 + 精英班的收入/支出/結餘
 * 核心邏輯：
 * - Q1/Q2/Q3/Q4 標準付款：整筆計入入帳月份
 * - CUSTOM 付款：按 customMonths 覆蓋月份按比例分攤到各月
 * 扣除：MPF 10% + 公司營運 5%
 */
export async function getMonthlyFinanceReport(year: number) {
  const db = await getDb();
  if (!db) return [];

  // 恆常班學生 + 繳費
  const allStudents = await getAllStudents();
  const allPayments = await getAllPaymentRecords();
  const regularStudents = allStudents.filter(s => s.status === 'active' && s.venue !== '精英班道場');
  const regularStudentIdSet = new Set(regularStudents.map(s => s.id));

  // 動態從學生資料取得教練名稱
  const coachNameSet = new Set<string>();
  allStudents.forEach(s => { if (s.coach) coachNameSet.add(s.coach); });
  const COACHES = Array.from(coachNameSet);

  // 精英班學生 + 繳費
  const allEliteStudents = await getAllEliteStudents();
  const allElitePayments = await db.select().from(elitePaymentRecords)
    .where(eq(elitePaymentRecords.status, 'confirmed'));

  // 恆常班：取得所有已確認且屬於恆常班的繳費
  const confirmedRegularPayments = allPayments.filter(p => {
    if (p.status !== 'confirmed') return false;
    if (!regularStudentIdSet.has(p.studentId)) return false;
    return true;
  });

  /** 取得付款的入帳日期（優先使用收據轉帳日期） */
  function getEntryDateForMonth(p: any): Date | null {
    if (p.receiptTransferDate) return new Date(p.receiptTransferDate);
    if (p.paymentDate) return new Date(p.paymentDate);
    return null;
  }

  /**
   * 計算某筆付款在指定月份的金額（用於月報）
   * - Q1/Q2/Q3/Q4：按 receiptTransferDate（收據轉帳日期）歸月，全額計入
   * - CUSTOM：按 customMonths 覆蓋月份按比例分攤
   */
  function getPaymentAmountForMonth(p: any, targetYear: number, targetMonth: number): number {
    const amount = parseFloat(p.amount || '0');
    if (amount <= 0) return 0;
    
    if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
      const monthNums = extractMonthNumbers(p.customMonths, targetYear);
      if (monthNums.length === 0) return 0;
      if (!monthNums.includes(targetMonth)) return 0;
      return amount / monthNums.length;
    } else {
      // 標準付款：用 receiptTransferDate 歸月（fallback paymentDate）
      const d = getEntryDateForMonth(p);
      if (!d) return 0;
      if (d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
        return amount;
      }
      return 0;
    }
  }

  // 精英班：按入帳月份分組繳費記錄（用 receiptTransferDate 優先）
  const elitePaymentsByMonth = new Map<number, typeof allElitePayments>();
  allElitePayments.forEach(p => {
    // 優先使用收據轉帳日期，fallback 到 paymentDate
    const entryDate = (p as any).receiptTransferDate ? new Date((p as any).receiptTransferDate)
                      : p.paymentDate ? new Date(p.paymentDate) : null;
    if (!entryDate) return;
    if (entryDate.getFullYear() !== year) return;
    if (p.classCount === 99999) return; // 排除免學費
    const month = entryDate.getMonth() + 1;
    if (!elitePaymentsByMonth.has(month)) elitePaymentsByMonth.set(month, []);
    elitePaymentsByMonth.get(month)!.push(p);
  });

  return COACHES.map(coachName => {
    const coachRegularStudents = regularStudents.filter(s => s.coach === coachName);
    const coachStudentIds = new Set(coachRegularStudents.map(s => s.id));
    const coachEliteStudents = allEliteStudents.filter(s => s.status === 'active' && s.coach === coachName);
    const eliteStudentIds = new Set(coachEliteStudents.map(s => s.id));
    
    // 該教練的恆常班付款
    const coachRegularPayments = confirmedRegularPayments.filter(p => coachStudentIds.has(p.studentId));

    const months: Record<number, {
      regularIncome: number;
      regularStudentCount: number;
      regularPaidCount: number;
      eliteIncome: number;
      eliteClassCount: number;
      totalIncome: number;
      mpf: number;
      operating: number;
      netSalary: number;
      lateEntries: { studentName: string; amount: number; originalMonth: number; processedDate: string }[];
    }> = {};

    for (let m = 1; m <= 12; m++) {
      // 恆常班：按付款期歸月的金額（CUSTOM 按比例分攤）
      let regularIncome = 0;
      const paidStudentIds = new Set<number>();
      const lateEntries: { studentName: string; amount: number; originalMonth: number; processedDate: string }[] = [];
      
      coachRegularPayments.forEach((p: any) => {
        const amt = getPaymentAmountForMonth(p, year, m);
        if (amt > 0) {
          regularIncome += amt;
          paidStudentIds.add(p.studentId);
          
          // 偵測逾期入帳：收據轉帳日期（入帳月份）與處理日期（paymentDate）不同月
          const entryDate = getEntryDateForMonth(p);
          const processDate = p.paymentDate ? new Date(p.paymentDate) : null;
          if (entryDate && processDate) {
            const entryMonth = entryDate.getMonth() + 1;
            const processMonth = processDate.getMonth() + 1;
            const entryYr = entryDate.getFullYear();
            const processYr = processDate.getFullYear();
            // 如果處理日期比入帳日期晚一個月以上，標記為逾期入帳
            if (processYr > entryYr || (processYr === entryYr && processMonth > entryMonth)) {
              const student = coachRegularStudents.find(s => s.id === p.studentId);
              lateEntries.push({
                studentName: student?.name || `學生${p.studentId}`,
                amount: amt,
                originalMonth: entryMonth,
                processedDate: processDate.toISOString().split('T')[0],
              });
            }
          }
        }
      });
      regularIncome = Math.round(regularIncome * 100) / 100;
      const regularPaidCount = paidStudentIds.size;

      // 精英班：該月入帳的已確認付款
      const monthElitePayments = (elitePaymentsByMonth.get(m) || [])
        .filter(p => eliteStudentIds.has(p.studentId));
      const eliteIncome = monthElitePayments.reduce((sum, p) => sum + parseFloat(p.amount as any || '0'), 0);
      const eliteClassCount = monthElitePayments.reduce((sum, p) => sum + (p.classCount || 0), 0);

      const totalIncome = regularIncome + eliteIncome;
      const mpf = Math.round(totalIncome * 0.10);
      const operating = Math.round(totalIncome * 0.05);
      const netSalary = totalIncome - mpf - operating;

      months[m] = {
        regularIncome,
        regularStudentCount: coachRegularStudents.length,
        regularPaidCount,
        eliteIncome,
        eliteClassCount,
        totalIncome,
        mpf,
        operating,
        netSalary,
        lateEntries,
      };
    }

    return { coachName, months };
  });
}

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
  
  // 最近一次上堂日期
  const lastAttendedDate = attendedCount > 0
    ? attendedRecords[attendedCount - 1].trainingDate?.toISOString() || null
    : null;

  // 當期循環的詳細出席記錄（含日期和狀態）
  // cycleStartIndex = 在 attendedRecords 中的起始位置（只含 present/late）
  const cycleStartIndex = completedCycles * 12;
  // 找到當期第一堂的日期，用它從 attendanceWithDates（含 absent）中篩選
  const cycleStartDateObj = cycleStartIndex < attendedRecords.length
    ? attendedRecords[cycleStartIndex].trainingDate
    : null;
  
  const cycleDetails: Array<{ date: string; status: string }> = [];
  if (cycleStartDateObj) {
    // 取得從 cycleStartDate 起至今所有有出席記錄的日期（含 absent）
    for (const rec of attendanceWithDates) {
      if (rec.trainingDate && rec.trainingDate >= cycleStartDateObj) {
        const d = rec.trainingDate;
        cycleDetails.push({
          date: `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`,
          status: rec.status as string,
        });
      }
    }
  }

  // 取得最近一次繳費日期
  const payments = await getElitePaymentRecords(studentId);
  const confirmedPayments = payments
    .filter(p => p.status === 'confirmed')
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  const lastPaymentDate = confirmedPayments.length > 0
    ? new Date(confirmedPayments[0].paymentDate).toISOString()
    : null;

  return {
    studentId,
    studentName: student.name,
    phone: student.phone,
    totalAttended: attendedCount,
    cycleNumber,
    completedCycles,
    needPaymentReminder,
    cycleStartDate,
    lastAttendedDate,
    lastPaymentDate,
    cycleDetails,
    feePerCycle: 2400, // 每 12 堂 $2,400
  };
}

export async function getAllEliteCycleInfo() {
  const students = await getAllEliteStudents();
  const activeStudents = students.filter(s => s.status === 'active');
  const results = await Promise.all(activeStudents.map(s => getEliteCycleInfo(s.id)));
  return results.filter(r => r !== null);
}

/**
 * 取得精英班學生的完整期數明細（WhatsApp 通知用）
 * 回傳每一期的：出席日期、請假日期、是否已繳費
 * 以及「當前進行中的期」的進度
 */
export async function getElitePeriodsBreakdown(studentId: number) {
  const db = await getDb();
  if (!db) return null;

  const student = await getEliteStudentById(studentId);
  if (!student) return null;

  // 取得全部出席記錄（含 absent/excused），按日期排序
  const allRecords = await db.select({
    scheduleId: eliteAttendanceRecords.id,
    status: eliteAttendanceRecords.status,
    trainingDate: eliteTrainingSchedules.trainingDate,
  })
    .from(eliteAttendanceRecords)
    .innerJoin(eliteTrainingSchedules, eq(eliteAttendanceRecords.scheduleId, eliteTrainingSchedules.id))
    .where(eq(eliteAttendanceRecords.studentId, studentId))
    .orderBy(asc(eliteTrainingSchedules.trainingDate));

  // 取得已繳費記錄
  const payments = await getElitePaymentRecords(studentId);
  const confirmedPayments = payments
    .filter(p => p.status === 'confirmed')
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
  const totalPaidClasses = confirmedPayments.reduce((sum, p) => sum + p.classCount, 0);
  const paidPeriods = Math.floor(totalPaidClasses / 12);

  // 將所有記錄按「期」分組
  // 每12堂出席（present/late）為一期，但期內也包含 absent/excused 記錄
  type PeriodRecord = { date: string; status: string; isAttended: boolean };
  type Period = {
    periodNumber: number;
    records: PeriodRecord[];
    attendedCount: number;  // present/late 堂數
    absentDates: string[];  // 請假日期
    isPaid: boolean;
    isComplete: boolean;    // 已滿 12 堂出席
  };

  const periods: Period[] = [];
  let currentPeriod: Period = {
    periodNumber: 1,
    records: [],
    attendedCount: 0,
    absentDates: [],
    isPaid: false,
    isComplete: false,
  };

  for (const rec of allRecords) {
    if (!rec.trainingDate) continue;
    const d = rec.trainingDate;
    const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
    const isAttended = rec.status === 'present' || rec.status === 'late';

    currentPeriod.records.push({ date: dateStr, status: rec.status as string, isAttended });
    if (isAttended) {
      currentPeriod.attendedCount++;
    } else {
      currentPeriod.absentDates.push(dateStr);
    }

    // 達到 12 堂出席，這期結束
    if (currentPeriod.attendedCount === 12) {
      currentPeriod.isComplete = true;
      currentPeriod.isPaid = currentPeriod.periodNumber <= paidPeriods;
      periods.push(currentPeriod);
      // 開始新一期
      currentPeriod = {
        periodNumber: periods.length + 1,
        records: [],
        attendedCount: 0,
        absentDates: [],
        isPaid: false,
        isComplete: false,
      };
    }
  }

  // 如果有進行中的期（未滿 12 堂）
  if (currentPeriod.records.length > 0) {
    currentPeriod.isPaid = currentPeriod.periodNumber <= paidPeriods;
    periods.push(currentPeriod);
  }

  // 找出未繳費的期
  const unpaidPeriods = periods.filter(p => !p.isPaid);

  // 每期的付款日期（按時間順序第N筆付款對應第N期）
  const paymentDatesPerPeriod: (string | null)[] = [];
  for (let i = 0; i < paidPeriods; i++) {
    if (i < confirmedPayments.length) {
      const d = new Date(confirmedPayments[i].paymentDate);
      paymentDatesPerPeriod.push(d.toISOString());
    } else {
      paymentDatesPerPeriod.push(null);
    }
  }

  return {
    studentId,
    studentName: student.name,
    phone: student.phone,
    totalPeriods: periods.length,
    paidPeriods,
    periods,
    unpaidPeriods,
    paymentDatesPerPeriod,
    feePerPeriod: 2400,
  };
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

// ===== 會計記錄 CRUD =====

export async function getAllAccountingRecords(filters?: {
  year?: number;
  month?: number;
  type?: 'income' | 'expense';
  category?: string;
}): Promise<AccountingRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (filters?.year) {
    conditions.push(sql`YEAR(${accountingRecords.transactionDate}) = ${filters.year}`);
  }
  if (filters?.month) {
    conditions.push(sql`MONTH(${accountingRecords.transactionDate}) = ${filters.month}`);
  }
  if (filters?.type) {
    conditions.push(eq(accountingRecords.type, filters.type));
  }
  if (filters?.category) {
    conditions.push(eq(accountingRecords.category, filters.category));
  }

  if (conditions.length > 0) {
    return db.select().from(accountingRecords)
      .where(and(...conditions))
      .orderBy(desc(accountingRecords.transactionDate));
  }
  return db.select().from(accountingRecords)
    .orderBy(desc(accountingRecords.transactionDate));
}

export async function insertAccountingRecord(record: Omit<InsertAccountingRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(accountingRecords).values(record as any);
  return { insertId: (result as any)[0].insertId };
}

export async function updateAccountingRecord(id: number, data: Partial<InsertAccountingRecord>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(accountingRecords).set(data as any).where(eq(accountingRecords.id, id));
}

export async function deleteAccountingRecord(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(accountingRecords).where(eq(accountingRecords.id, id));
}

export async function getAccountingRecordById(id: number): Promise<AccountingRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const records = await db.select().from(accountingRecords)
    .where(eq(accountingRecords.id, id))
    .limit(1);
  return records[0] || null;
}

export async function getAccountingRecordByPaymentId(paymentRecordId: number): Promise<AccountingRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const records = await db.select().from(accountingRecords)
    .where(eq(accountingRecords.paymentRecordId, paymentRecordId))
    .limit(1);
  return records[0] || null;
}

export async function getAccountingRecordByElitePaymentId(elitePaymentRecordId: number): Promise<AccountingRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const records = await db.select().from(accountingRecords)
    .where(eq(accountingRecords.elitePaymentRecordId, elitePaymentRecordId))
    .limit(1);
  return records[0] || null;
}

export async function getAccountingRecordByExamPaymentId(examPaymentId: number): Promise<AccountingRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const records = await db.select().from(accountingRecords)
    .where(eq(accountingRecords.examPaymentId, examPaymentId))
    .limit(1);
  return records[0] || null;
}

/**
 * 公司收款帳號常量（用於自動分配銀行）
 * - BOC 帳號: 012-692-2-0114816 (去掉橫線: 01269220114816)
 * - FPS ID: 164577132 → 歸類為 BOC
 * - HSBC 帳號: 484287123838
 */
export const COMPANY_ACCOUNTS = {
  BOC_ACCOUNT: '01269220114816',
  BOC_ACCOUNT_FORMATTED: '012-692-2-0114816',
  FPS_ID: '164577132',
  HSBC_ACCOUNT: '484287123838',
  COMPANY_NAME: 'Chong Mo Company Limited',
} as const;

/**
 * 根據收款人帳號 / FPS ID 自動分配銀行
 * 只認識3個公司帳號，精確匹配後自動歸類
 */
export function detectBankByAccount(accountOrFpsId: string | null | undefined): 'boc' | 'hsbc' | null {
  if (!accountOrFpsId) return null;
  const cleaned = accountOrFpsId.replace(/[-\s]/g, '').trim();
  if (!cleaned) return null;

  // FPS ID 164577132 → BOC
  if (cleaned === COMPANY_ACCOUNTS.FPS_ID || cleaned.includes(COMPANY_ACCOUNTS.FPS_ID)) {
    return 'boc';
  }
  // BOC 帳號 01269220114816
  if (cleaned === COMPANY_ACCOUNTS.BOC_ACCOUNT || cleaned.includes(COMPANY_ACCOUNTS.BOC_ACCOUNT)) {
    return 'boc';
  }
  // HSBC 帳號 484287123838
  if (cleaned === COMPANY_ACCOUNTS.HSBC_ACCOUNT || cleaned.includes(COMPANY_ACCOUNTS.HSBC_ACCOUNT)) {
    return 'hsbc';
  }
  // 帳號前3位判斷：012 = BOC, 004 = HSBC
  if (cleaned.startsWith('012')) return 'boc';
  if (cleaned.startsWith('004')) return 'hsbc';
  // 其他前綴不識別（公司只有 BOC 和 HSBC）
  return null;
}

/**
 * 銀行名稱標準化 → paymentMethod
 * 公司只有 BOC 和 HSBC 兩個銀行帳戶
 * FPS / 轉數快 / PayMe 全部歸類到 BOC
 * 其他不支援的銀行名稱也歸類到 'boc'(預設)
 */
export function normalizeBankName(rawBank: string | null | undefined): string | null {
  if (!rawBank) return null;
  const b = rawBank.toUpperCase().trim();
  if (!b) return null;

  // ★ FPS / 轉數快 / PayMe → 自動歸類到 BOC（因為公司的 FPS 收款帳戶是中國銀行）
  if (b.includes('FPS') || b.includes('轉數快') || b.includes('转数快') || b.includes('PAYME') || b.includes('PAY ME')) {
    return 'boc';
  }

  // HSBC 滙豐銀行
  if (b.includes('HSBC') || b.includes('滙豐') || b.includes('汇丰') || b.includes('匯豐') || b.includes('HONGKONG AND SHANGHAI')) {
    return 'hsbc';
  }

  // BOC 中銀香港 / 中國銀行
  if (b.includes('BOC') || b.includes('中銀') || b.includes('中國銀行') || b.includes('中国银行') || b.includes('BANK OF CHINA')) {
    return 'boc';
  }

  // 其他銀行名稱全部 fallback 到 'boc'（公司主要收款帳戶）
  // 包含：渣打、恒生、ZA Bank、Mox 等——都是家長的付款銀行，收款方預設是 BOC
  console.log(`[normalizeBankName] 非 BOC/HSBC 銀行: "${rawBank}" → fallback to 'boc'`);
  return 'boc';
}

/**
 * 將 paymentMethod 映射回顯示用的中文銀行名稱
 * 公司只有 BOC 和 HSBC
 */
export function paymentMethodToDisplayName(pm: string | null): string {
  const map: Record<string, string> = {
    'hsbc': '滙豐銀行 (HSBC)',
    'boc': '中銀香港 (BOC)',
    'fps': '中銀香港 (BOC)',  // FPS 歸類到 BOC
    'cash': '中銀香港 (BOC)',  // 現金預設歸 BOC
    'bank': '中銀香港 (BOC)',  // 未知銀行預設歸 BOC
    'scb': '中銀香港 (BOC)',
    'hangseng': '中銀香港 (BOC)',
  };
  return pm ? (map[pm] || '中銀香港 (BOC)') : '';
}

/**
 * 同步繳費記錄到會計記錄
 */
export async function syncPaymentToAccounting(params: {
  paymentRecordId: number;
  transactionDate: Date;
  amount: string;
  bank?: string | null;
  receivingBank?: string | null; // 收款銀行（入數到哪間銀行，用於銀行月結單對帳）
  studentName: string;
  coachName?: string | null;
  dojoName?: string | null;
  category?: string;
  receiptUrl?: string | null;
  receiptKey?: string | null;
}): Promise<void> {
  const existing = await getAccountingRecordByPaymentId(params.paymentRecordId);
  if (existing) return;

  // ★ 核心邏輯：bank（付款銀行）為空時，用 receivingBank（收款銀行）補上
  // 管理員確認繳費時通常只選「轉入銀行」（receivingBank），不選付款銀行
  // 此處確保會計帳目一定有銀行資訊，不需再手動分配
  const effectiveBank = params.bank || params.receivingBank || null;
  const effectiveReceivingBank = params.receivingBank || params.bank || null;

  // 標準化銀行名稱
  const normalizedBank = normalizeBankName(effectiveBank);
  const displayBank = normalizedBank ? paymentMethodToDisplayName(normalizedBank) : (effectiveBank || null);

  // 標準化收款銀行名稱（用於對帳）
  const normalizedReceivingBank = effectiveReceivingBank ? normalizeBankName(effectiveReceivingBank) : null;
  const displayReceivingBank = normalizedReceivingBank
    ? paymentMethodToDisplayName(normalizedReceivingBank)
    : (effectiveReceivingBank || null);

  const result = await insertAccountingRecord({
    transactionDate: params.transactionDate,
    bank: displayBank,
    receivingBank: displayReceivingBank,
    amount: params.amount,
    type: 'income',
    category: params.category || 'tuition',
    description: `${params.studentName} 學費`,
    receiptUrl: params.receiptUrl || null,
    receiptKey: params.receiptKey || null,
    paymentRecordId: params.paymentRecordId,
    elitePaymentRecordId: null,
    studentName: params.studentName,
    coachName: params.coachName || null,
    dojoName: params.dojoName || null,
    source: 'auto_sync',
  });
  // Auto-generate journal entry（帶上 paymentMethod 讓分錄歸入正確銀行子科目）
  try { await onAccountingRecordCreated(result.insertId, normalizedBank); } catch (e) { console.error('Auto journal from payment sync failed:', e); }
}

/**
 * 同步精英班繳費到會計記錄
 */
export async function syncElitePaymentToAccounting(params: {
  elitePaymentRecordId: number;
  transactionDate: Date;
  amount: string;
  bank?: string | null;
  receivingBank?: string | null; // 收款銀行（入數到哪間銀行，用於銀行月結單對帳）
  studentName: string;
  coachName?: string | null;
  dojoName?: string | null;
  receiptUrl?: string | null;
  receiptKey?: string | null;
}): Promise<void> {
  const existing = await getAccountingRecordByElitePaymentId(params.elitePaymentRecordId);
  if (existing) return;

  // ★ bank 為空時用 receivingBank 補上（與 syncPaymentToAccounting 同邏輯）
  const effectiveBank = params.bank || params.receivingBank || null;
  const effectiveReceivingBank = params.receivingBank || params.bank || null;

  // 標準化銀行名稱
  const normalizedBank = normalizeBankName(effectiveBank);
  const displayBank = normalizedBank ? paymentMethodToDisplayName(normalizedBank) : (effectiveBank || null);

  // 標準化收款銀行名稱（用於對帳）
  const normalizedReceivingBank = effectiveReceivingBank ? normalizeBankName(effectiveReceivingBank) : null;
  const displayReceivingBank = normalizedReceivingBank
    ? paymentMethodToDisplayName(normalizedReceivingBank)
    : (effectiveReceivingBank || null);

  const result = await insertAccountingRecord({
    transactionDate: params.transactionDate,
    bank: displayBank,
    receivingBank: displayReceivingBank,
    amount: params.amount,
    type: 'income',
    category: 'tuition',
    description: `${params.studentName} 精英班學費`,
    receiptUrl: params.receiptUrl || null,
    receiptKey: params.receiptKey || null,
    paymentRecordId: null,
    elitePaymentRecordId: params.elitePaymentRecordId,
    studentName: params.studentName,
    coachName: params.coachName || null,
    dojoName: params.dojoName || '精英班',
    source: 'auto_sync',
  });
  // Auto-generate journal entry（帶上 paymentMethod 讓分錄歸入正確銀行子科目）
  try { await onAccountingRecordCreated(result.insertId, normalizedBank); } catch (e) { console.error('Auto journal from elite payment sync failed:', e); }
}

/**
 * 同步考試繳費記錄到會計記錄
 */
export async function syncExamPaymentToAccounting(params: {
  examPaymentId: number;
  transactionDate: Date;
  amount: string;
  bank?: string | null;
  receivingBank?: string | null;
  studentName: string;
  coachName?: string | null;
  dojoName?: string | null;
  receiptUrl?: string | null;
  receiptKey?: string | null;
  examTitle?: string; // e.g. "第3屆升級試"
}): Promise<void> {
  const existing = await getAccountingRecordByExamPaymentId(params.examPaymentId);
  if (existing) return;

  // bank 為空時用 receivingBank 補上（與 syncPaymentToAccounting 同邏輯）
  const effectiveBank = params.bank || params.receivingBank || null;
  const effectiveReceivingBank = params.receivingBank || params.bank || null;

  // 標準化銀行名稱
  const normalizedBank = normalizeBankName(effectiveBank);
  const displayBank = normalizedBank ? paymentMethodToDisplayName(normalizedBank) : (effectiveBank || null);

  const normalizedReceivingBank = effectiveReceivingBank ? normalizeBankName(effectiveReceivingBank) : null;
  const displayReceivingBank = normalizedReceivingBank
    ? paymentMethodToDisplayName(normalizedReceivingBank)
    : (effectiveReceivingBank || null);

  const desc = params.examTitle
    ? `${params.studentName} 考試費（${params.examTitle}）`
    : `${params.studentName} 考試費`;

  const result = await insertAccountingRecord({
    transactionDate: params.transactionDate,
    bank: displayBank,
    receivingBank: displayReceivingBank,
    amount: params.amount,
    type: 'income',
    category: 'exam_fee',
    description: desc,
    receiptUrl: params.receiptUrl || null,
    receiptKey: params.receiptKey || null,
    paymentRecordId: null,
    elitePaymentRecordId: null,
    examPaymentId: params.examPaymentId,
    studentName: params.studentName,
    coachName: params.coachName || null,
    dojoName: params.dojoName || null,
    source: 'auto_sync',
  });
  // Auto-generate journal entry
  try { await onAccountingRecordCreated(result.insertId, normalizedBank); } catch (e) { console.error('Auto journal from exam payment sync failed:', e); }
}

/**
 * 批量同步遺漏的考試繳費記錄到會計系統
 * 找出所有 status='confirmed' 且 amount > 0 但沒有對應 accounting_record 的 examPayments，
 * 逐一執行 syncExamPaymentToAccounting
 */
export async function syncOrphanedExamPayments(): Promise<{ synced: number; errors: number; details: string[] }> {
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, details: ['Database not available'] };

  // 找出已確認且金額>0，但未同步到會計的考試繳費記錄
  const orphaned = await db.select({
    id: examPayments.id,
    examId: examPayments.examId,
    studentId: examPayments.studentId,
    studentName: examPayments.studentName,
    targetBelt: examPayments.targetBelt,
    amount: examPayments.amount,
    paymentDate: examPayments.paymentDate,
    receiptUrl: examPayments.receiptUrl,
    receiptKey: examPayments.receiptKey,
    bank: examPayments.bank,
    receivingBank: examPayments.receivingBank,
  })
    .from(examPayments)
    .leftJoin(accountingRecords, eq(accountingRecords.examPaymentId, examPayments.id))
    .where(and(
      eq(examPayments.status, 'confirmed'),
      isNull(accountingRecords.id),
      sql`${examPayments.amount} > 0`
    ));

  let synced = 0;
  let errors = 0;
  const details: string[] = [];

  for (const payment of orphaned) {
    try {
      // 取得考試名稱
      let examTitle = '';
      try {
        const exams = await db.select({ title: examSessions.title }).from(examSessions).where(eq(examSessions.id, payment.examId)).limit(1);
        if (exams[0]) examTitle = exams[0].title;
      } catch {}

      // 取得學生道場/教練資訊
      let coachName: string | null = null;
      let dojoName: string | null = null;
      if (payment.studentId) {
        try {
          const student = await getStudentById(payment.studentId);
          if (student) {
            coachName = student.coach || null;
            dojoName = student.venue || null;
          }
        } catch {}
      }

      await syncExamPaymentToAccounting({
        examPaymentId: payment.id,
        transactionDate: payment.paymentDate || new Date(),
        amount: String(payment.amount),
        bank: payment.bank || null,
        receivingBank: payment.receivingBank || null,
        studentName: payment.studentName,
        coachName,
        dojoName,
        receiptUrl: payment.receiptUrl,
        receiptKey: payment.receiptKey,
        examTitle,
      });
      details.push(`ExamPayment ${payment.id}: ${payment.studentName} $${payment.amount} → synced`);
      synced++;
    } catch (e: any) {
      details.push(`ExamPayment ${payment.id}: ${payment.studentName} ERROR - ${e.message}`);
      errors++;
    }
  }

  return { synced, errors, details };
}

/**
 * 批量同步遺漏的繳費記錄到會計系統
 * 找出所有 status='confirmed' 但沒有對應 accounting_record 的 paymentRecords，
 * 逐一執行 syncPaymentToAccounting
 */
export async function syncOrphanedPayments(): Promise<{ synced: number; errors: number; details: string[] }> {
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, details: ['Database not available'] };

  // 找出已確認但未同步到會計的繳費記錄
  const orphaned = await db.select({
    id: paymentRecords.id,
    studentId: paymentRecords.studentId,
    amount: paymentRecords.amount,
    paymentDate: paymentRecords.paymentDate,
    receiptTransferDate: paymentRecords.receiptTransferDate,
    receiptUrl: paymentRecords.receiptUrl,
    receiptKey: paymentRecords.receiptKey,
    bank: paymentRecords.bank,
    receivingBank: paymentRecords.receivingBank,
  })
    .from(paymentRecords)
    .leftJoin(accountingRecords, eq(accountingRecords.paymentRecordId, paymentRecords.id))
    .where(and(
      eq(paymentRecords.status, 'confirmed'),
      isNull(accountingRecords.id)
    ));

  let synced = 0;
  let errors = 0;
  const details: string[] = [];

  for (const payment of orphaned) {
    try {
      const student = await getStudentById(payment.studentId);
      if (!student) {
        details.push(`Payment ${payment.id}: student ${payment.studentId} not found, skipped`);
        errors++;
        continue;
      }
      await syncPaymentToAccounting({
        paymentRecordId: payment.id,
        transactionDate: payment.receiptTransferDate || payment.paymentDate,
        amount: String(payment.amount),
        bank: payment.bank || null,
        receivingBank: payment.receivingBank || null,
        studentName: student.name,
        coachName: student.coach,
        dojoName: student.venue || null,
        category: 'tuition',
        receiptUrl: payment.receiptUrl,
        receiptKey: payment.receiptKey,
      });
      details.push(`Payment ${payment.id}: ${student.name} $${payment.amount} → synced`);
      synced++;
    } catch (e: any) {
      details.push(`Payment ${payment.id}: sync failed - ${e.message}`);
      errors++;
    }
  }

  return { synced, errors, details };
}

/**
 * 批量回填會計記錄中缺失的銀行資訊
 * 找出所有 bank 為空的會計記錄，從關聯的 paymentRecord / elitePaymentRecord 取得銀行欄位回填
 */
export async function backfillAccountingBanks(): Promise<{ fixed: number; errors: number; details: string[] }> {
  const db = await getDb();
  if (!db) return { fixed: 0, errors: 0, details: ['Database not available'] };

  // 找出 bank 為空（NULL 或空字串）的會計記錄
  const missingBank = await db.select().from(accountingRecords)
    .where(
      or(
        isNull(accountingRecords.bank),
        eq(accountingRecords.bank, '')
      )
    );

  let fixed = 0;
  let errors = 0;
  const details: string[] = [];

  for (const record of missingBank) {
    try {
      let bankToSet: string | null = null;

      // 1. 嘗試從關聯的 paymentRecord 取得銀行
      if (record.paymentRecordId) {
        const pmtRecords = await db.select().from(paymentRecords)
          .where(eq(paymentRecords.id, record.paymentRecordId))
          .limit(1);
        const pmt = pmtRecords[0];
        if (pmt) {
          // 優先用 receivingBank（管理員上傳時選的轉入銀行），再用 bank
          const source = (pmt as any).receivingBank || (pmt as any).bank || null;
          if (source) {
            const normalized = normalizeBankName(source);
            bankToSet = normalized ? paymentMethodToDisplayName(normalized) : source;
          }
        }
      }

      // 2. 嘗試從關聯的 elitePaymentRecord 取得銀行
      if (!bankToSet && record.elitePaymentRecordId) {
        const eliteRecords = await db.select().from(elitePaymentRecords)
          .where(eq(elitePaymentRecords.id, record.elitePaymentRecordId))
          .limit(1);
        const elite = eliteRecords[0];
        if (elite) {
          const source = (elite as any).receivingBank || (elite as any).bank || null;
          if (source) {
            const normalized = normalizeBankName(source);
            bankToSet = normalized ? paymentMethodToDisplayName(normalized) : source;
          }
        }
      }

      if (bankToSet) {
        await db.update(accountingRecords)
          .set({ bank: bankToSet, receivingBank: bankToSet } as any)
          .where(eq(accountingRecords.id, record.id));
        details.push(`Record #${record.id}: ${record.description || ''} → ${bankToSet}`);
        fixed++;
      } else {
        details.push(`Record #${record.id}: ${record.description || ''} → 無法取得銀行資訊（paymentRecordId=${record.paymentRecordId}）`);
      }
    } catch (e: any) {
      details.push(`Record #${record.id}: 修復失敗 - ${e.message}`);
      errors++;
    }
  }

  return { fixed, errors, details };
}

/**
 * 取得會計摘要統計
 */
export async function getAccountingSummary(year: number, month?: number) {
  const db = await getDb();
  if (!db) return null;

  const conditions: any[] = [
    sql`YEAR(${accountingRecords.transactionDate}) = ${year}`
  ];
  if (month) {
    conditions.push(sql`MONTH(${accountingRecords.transactionDate}) = ${month}`);
  }

  // 基本按 type + category 彙總
  const result = await db.select({
    type: accountingRecords.type,
    category: accountingRecords.category,
    total: sql<string>`CAST(SUM(${accountingRecords.amount}) AS CHAR)`,
    count: sql<number>`COUNT(*)`,
  }).from(accountingRecords)
    .where(and(...conditions))
    .groupBy(accountingRecords.type, accountingRecords.category);

  // 額外：學費收入按精英班 / 恆常班分拆
  const tuitionBreakdown = await db.select({
    isElite: sql<number>`CASE WHEN ${accountingRecords.elitePaymentRecordId} IS NOT NULL THEN 1 ELSE 0 END`,
    total: sql<string>`CAST(SUM(${accountingRecords.amount}) AS CHAR)`,
    count: sql<number>`COUNT(*)`,
  }).from(accountingRecords)
    .where(and(
      ...conditions,
      eq(accountingRecords.type, 'income'),
      eq(accountingRecords.category, 'tuition'),
    ))
    .groupBy(sql`CASE WHEN ${accountingRecords.elitePaymentRecordId} IS NOT NULL THEN 1 ELSE 0 END`);

  return {
    summary: result,
    tuitionBreakdown: tuitionBreakdown.map(t => ({
      type: t.isElite ? 'elite' as const : 'regular' as const,
      total: t.total,
      count: t.count,
    })),
  };
}

// ==================== 活動管理 ====================

export async function getAllEvents(filters?: { type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.type) conditions.push(eq(events.type, filters.type as any));
  if (filters?.status) conditions.push(eq(events.status, filters.status as any));
  return db.select().from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.eventDate));
}

export async function getOpenEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events)
    .where(and(eq(events.status, 'open'), gte(events.eventDate, new Date())))
    .orderBy(asc(events.eventDate));
}

export async function insertEvent(data: Omit<InsertEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(events).values(data as any);
  return { insertId: (result as any)[0].insertId };
}

export async function updateEvent(id: number, data: Partial<InsertEvent>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(events).set(data as any).where(eq(events.id, id));
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(events).where(eq(events.id, id));
}

export async function getEventRegistrations(eventId?: number, phone?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (eventId) conditions.push(eq(eventRegistrations.eventId, eventId));
  if (phone) conditions.push(eq(eventRegistrations.phone, phone));
  return db.select().from(eventRegistrations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(eventRegistrations.registeredAt));
}

export async function registerForEvent(data: Omit<InsertEventRegistration, 'id' | 'registeredAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(eventRegistrations).values(data as any);
  return { insertId: (result as any)[0].insertId };
}

export async function cancelEventRegistration(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(eventRegistrations).set({ status: 'cancelled' }).where(eq(eventRegistrations.id, id));
}

export async function updateEventRegistrationStatus(id: number, status: 'registered' | 'confirmed' | 'cancelled'): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(eventRegistrations).set({ status }).where(eq(eventRegistrations.id, id));
}

export async function getEventRegistrationCount(eventId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), sql`${eventRegistrations.status} != 'cancelled'`));
  return result[0]?.count || 0;
}

// ==================== 考試評分系統 ====================

// --- 考試場次 CRUD ---
export async function getAllExamSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examSessions).orderBy(desc(examSessions.examDate));
}

export async function getExamSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(examSessions).where(eq(examSessions.id, id)).limit(1);
  return result[0];
}

export async function insertExamSession(data: Omit<InsertExamSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(examSessions).values(data as any);
  return { insertId: (result as any)[0].insertId };
}

export async function updateExamSession(id: number, data: Partial<InsertExamSession>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(examSessions).set(data as any).where(eq(examSessions.id, id));
}

export async function deleteExamSession(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(examSessions).where(eq(examSessions.id, id));
}

// --- 考生 CRUD ---
export async function getExamCandidatesByExam(examId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examCandidates)
    .where(eq(examCandidates.examId, examId))
    .orderBy(asc(examCandidates.groupCode), asc(examCandidates.orderNumber));
}

// --- 補考生資料 (retake info) ---
// 找出本次考試中，在上一次考試曾不合格/缺席的考生，並帶回上次成績
export async function getRetakeInfo(examId: number): Promise<{
  retakeCandidateIds: number[];
  previousScores: Record<number, { prevCandidateId: number; prevStatus: string; scores: { itemName: string; category: string; score: string; scoringItemId: number }[] }>;
}> {
  const db = await getDb();
  if (!db) return { retakeCandidateIds: [], previousScores: {} };

  // Get all candidates in this exam
  const currentCandidates = await db.select().from(examCandidates)
    .where(eq(examCandidates.examId, examId));

  // Find previous exam candidates with same name+phone who failed or were absent
  const retakeCandidateIds: number[] = [];
  const previousScores: Record<number, { prevCandidateId: number; prevStatus: string; scores: { itemName: string; category: string; score: string; scoringItemId: number }[] }> = {};

  for (const curr of currentCandidates) {
    if (!curr.name || !curr.phone) continue;

    // Find matching candidate in previous exams with same belt transition who failed/absent
    const prevCandidates = await db.select().from(examCandidates)
      .where(and(
        eq(examCandidates.name, curr.name),
        eq(examCandidates.phone, curr.phone),
        eq(examCandidates.currentBelt, curr.currentBelt),
        eq(examCandidates.targetBelt, curr.targetBelt),
        sql`${examCandidates.examId} < ${examId}`,
        sql`${examCandidates.status} IN ('failed', 'absent')`
      ))
      .orderBy(sql`${examCandidates.examId} DESC`)
      .limit(1);

    if (prevCandidates.length > 0) {
      const prev = prevCandidates[0];
      retakeCandidateIds.push(curr.id);

      // Get previous scores
      const prevScores = await db.select({
        score: examScores,
        item: examScoringItems,
      }).from(examScores)
        .innerJoin(examScoringItems, eq(examScores.scoringItemId, examScoringItems.id))
        .where(eq(examScores.candidateId, prev.id));

      previousScores[curr.id] = {
        prevCandidateId: prev.id,
        prevStatus: prev.status,
        scores: prevScores.map(ps => ({
          itemName: ps.item.name,
          category: ps.item.category || '',
          score: ps.score.score || '',
          scoringItemId: ps.item.id,
        })),
      };
    }
  }

  return { retakeCandidateIds, previousScores };
}

export async function getExamCandidatesByBelt(examId: number, belt: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examCandidates)
    .where(and(eq(examCandidates.examId, examId), eq(examCandidates.currentBelt, belt)))
    .orderBy(asc(examCandidates.groupCode), asc(examCandidates.orderNumber));
}

export async function getExamCandidateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(examCandidates).where(eq(examCandidates.id, id)).limit(1);
  return result[0];
}

export async function insertExamCandidate(data: Omit<InsertExamCandidate, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(examCandidates).values(data as any);
  return { insertId: (result as any)[0].insertId };
}

export async function bulkInsertExamCandidates(candidates: Omit<InsertExamCandidate, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (candidates.length === 0) return 0;
  await db.insert(examCandidates).values(candidates as any);
  return candidates.length;
}

export async function updateExamCandidate(id: number, data: Partial<InsertExamCandidate>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(examCandidates).set(data as any).where(eq(examCandidates.id, id));
}

export async function deleteExamCandidate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(examCandidates).where(eq(examCandidates.id, id));
}

// --- 評分項目 ---
export async function getExamScoringItems(beltLevel?: string) {
  const db = await getDb();
  if (!db) return [];
  if (beltLevel) {
    return db.select().from(examScoringItems)
      .where(or(eq(examScoringItems.beltLevel, beltLevel), sql`${examScoringItems.beltLevel} IS NULL`))
      .orderBy(asc(examScoringItems.sortOrder));
  }
  return db.select().from(examScoringItems).orderBy(asc(examScoringItems.sortOrder));
}

export async function insertExamScoringItem(data: Omit<InsertExamScoringItem, 'id' | 'createdAt'>): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(examScoringItems).values(data as any);
  return { insertId: (result as any)[0].insertId };
}

export async function bulkInsertExamScoringItems(items: Omit<InsertExamScoringItem, 'id' | 'createdAt'>[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return 0;
  await db.insert(examScoringItems).values(items as any);
  return items.length;
}

export async function getExamScoringItemsByBelt(beltLevel: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examScoringItems)
    .where(eq(examScoringItems.beltLevel, beltLevel))
    .orderBy(asc(examScoringItems.sortOrder));
}

// --- 評分 ---
export async function upsertExamScore(data: { candidateId: number, scoringItemId: number, score: string, comment?: string | null, scoredBy?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Try update first, then insert
  const existing = await db.select().from(examScores)
    .where(and(eq(examScores.candidateId, data.candidateId), eq(examScores.scoringItemId, data.scoringItemId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(examScores).set({
      score: data.score,
      comment: data.comment ?? null,
      scoredBy: data.scoredBy ?? null,
      scoredAt: new Date(),
    } as any).where(eq(examScores.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(examScores).values({
      candidateId: data.candidateId,
      scoringItemId: data.scoringItemId,
      score: data.score,
      comment: data.comment ?? null,
      scoredBy: data.scoredBy ?? null,
    } as any);
    return (result as any)[0].insertId;
  }
}

export async function getExamScoresByCandidate(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examScores)
    .where(eq(examScores.candidateId, candidateId))
    .orderBy(asc(examScores.scoringItemId));
}

export async function getExamScoresWithItemsByCandidate(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    score: examScores,
    item: examScoringItems,
  }).from(examScores)
    .innerJoin(examScoringItems, eq(examScores.scoringItemId, examScoringItems.id))
    .where(eq(examScores.candidateId, candidateId))
    .orderBy(asc(examScoringItems.sortOrder));
  return results;
}

export async function getExamScoresByExam(examId: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    score: examScores,
    candidate: examCandidates,
    item: examScoringItems,
  }).from(examScores)
    .innerJoin(examCandidates, eq(examScores.candidateId, examCandidates.id))
    .innerJoin(examScoringItems, eq(examScores.scoringItemId, examScoringItems.id))
    .where(eq(examCandidates.examId, examId));
  return results;
}

export async function deleteExamScoresByCandidate(candidateId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(examScores).where(eq(examScores.candidateId, candidateId));
}

// --- 考試統計 ---
export async function getExamStatistics(examId: number) {
  const db = await getDb();
  if (!db) return { total: 0, passed: 0, failed: 0, examining: 0, absent: 0, registered: 0, lakLakCount: 0 };
  
  const candidates = await db.select().from(examCandidates).where(eq(examCandidates.examId, examId));
  const total = candidates.length;
  const passed = candidates.filter(c => c.status === 'passed').length;
  const failed = candidates.filter(c => c.status === 'failed').length;
  const examining = candidates.filter(c => c.status === 'examining').length;
  const absent = candidates.filter(c => c.status === 'absent').length;
  const registered = candidates.filter(c => c.status === 'registered' || c.status === 'checked_in').length;
  const lakLakCount = candidates.filter(c => c.hasLakLakAward).length;
  
  return { total, passed, failed, examining, absent, registered, lakLakCount };
}

// --- 考試結果自動升帶 ---
export async function promotePassedCandidate(candidateId: number): Promise<{ success: boolean, newBelt?: string, studentId?: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const candidate = await getExamCandidateById(candidateId);
  if (!candidate || candidate.status !== 'passed') return { success: false };
  
  let matchedStudentId = candidate.studentId;
  
  // 如果沒有 student_id，嘗試用姓名+電話匹配
  if (!matchedStudentId) {
    let matchedStudents: any[] = [];
    
    // 優先用 姓名+電話 精確匹配
    if (candidate.name && candidate.phone) {
      matchedStudents = await db.select().from(students)
        .where(and(
          eq(students.name, candidate.name),
          eq(students.phone, candidate.phone)
        )).limit(1);
    }
    
    // 如果電話匹配失敗，嘗試只用姓名（但要小心重名）
    if (matchedStudents.length === 0 && candidate.name) {
      matchedStudents = await db.select().from(students)
        .where(eq(students.name, candidate.name));
      // 只有唯一匹配才使用（避免重名誤判）
      if (matchedStudents.length !== 1) {
        matchedStudents = [];
      }
    }
    
    if (matchedStudents.length > 0) {
      matchedStudentId = matchedStudents[0].id;
      // 回寫 student_id 到 exam_candidates，方便日後查詢
      await db.update(examCandidates)
        .set({ studentId: matchedStudentId } as any)
        .where(eq(examCandidates.id, candidateId));
    }
  }
  
  // 更新學生帶級
  if (matchedStudentId) {
    const studentList = await db.select().from(students).where(eq(students.id, matchedStudentId)).limit(1);
    if (studentList.length > 0) {
      const chineseBelt = beltKeyToChinese(candidate.targetBelt);
      await db.update(students).set({ beltLevel: chineseBelt } as any).where(eq(students.id, matchedStudentId));
      return { success: true, newBelt: chineseBelt, studentId: matchedStudentId };
    }
  }
  
  return { success: false };
}

// --- 從報名活動自動創建考生 ---
export async function createCandidatesFromEventRegistrations(examId: number, eventId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  // 取得事件報名記錄（已確認和已報名的）
  const registrations = await db.select().from(eventRegistrations)
    .where(and(
      eq(eventRegistrations.eventId, eventId),
      sql`${eventRegistrations.status} != 'cancelled'`
    ));
  
  let created = 0;
  for (const reg of registrations) {
    // 檢查是否已加入考生名單
    const existing = await db.select().from(examCandidates)
      .where(and(
        eq(examCandidates.examId, examId),
        eq(examCandidates.name, reg.studentName),
        eq(examCandidates.phone, reg.phone)
      )).limit(1);
    
    if (existing.length > 0) continue;
    
    // 取得學生資料（帶級等資訊）
    let currentBelt = 'white';
    let targetBelt = 'yellow';
    let studentId: number | null = reg.studentId;
    let gender: 'male' | 'female' = 'male';
    let dojoName: string | null = null;
    
    if (reg.studentId) {
      const studentList = await db.select().from(students).where(eq(students.id, reg.studentId)).limit(1);
      if (studentList.length > 0) {
        const student = studentList[0];
        currentBelt = student.beltLevel || 'white';
        // 根據 belt upgrade map 自動推算目標帶級
        targetBelt = getNextBelt(currentBelt);
        // 從學生資料取得道場名稱
        dojoName = student.venue || null;
      }
    }
    
    await db.insert(examCandidates).values({
      examId,
      studentId,
      name: reg.studentName,
      phone: reg.phone,
      dojoName,
      gender,
      currentBelt,
      targetBelt,
      status: 'registered',
    } as any);
    created++;
  }
  
  return created;
}

// 帶級升級對照表（使用英文 key，與 DB belt_level 欄位一致）
function getNextBelt(currentBelt: string): string {
  const UPGRADE_MAP: Record<string, string> = {
    'white': 'yellow',
    'yellow': 'yellow_green',
    'yellow_green': 'green',
    'green': 'green_blue',
    'green_blue': 'blue',
    'blue': 'blue_red',
    'blue_red': 'red',
    'red': 'red_black',
    'red_black': 'black',
    'black': 'black_2dan',
    'black_2dan': 'black_3dan',
    'black_3dan': 'black_3dan',
  };
  return UPGRADE_MAP[currentBelt] || 'yellow';
}

// 英文帶級 key → 中文帶級名（students.beltLevel 存中文）
function beltKeyToChinese(key: string): string {
  const MAP: Record<string, string> = {
    'white': '白帶',
    'yellow': '黃帶',
    'yellow_green': '黃綠帶',
    'green': '綠帶',
    'green_blue': '綠藍帶',
    'blue': '藍帶',
    'blue_red': '藍紅帶',
    'red': '紅帶',
    'red_black': '紅黑帶',
    'black': '黑帶',
    'black_2dan': '黑帶2段',
    'black_3dan': '黑帶3段',
  };
  return MAP[key] || key;
}

// --- 批量計算並更新考試結果（全自動升帶/回退） ---
export async function calculateExamResult(candidateId: number): Promise<{ passed: boolean, hasLakLakAward: boolean, gradeAPercentage: number, incomplete?: boolean, promoted?: boolean, reverted?: boolean }> {
  const scoresWithItems = await getExamScoresWithItemsByCandidate(candidateId);
  
  if (scoresWithItems.length === 0) {
    return { passed: false, hasLakLakAward: false, gradeAPercentage: 0, incomplete: true };
  }
  
  // 取得考生的帶級，檢查應有評分項目數
  const candidate = await getExamCandidateById(candidateId);
  if (!candidate) {
    return { passed: false, hasLakLakAward: false, gradeAPercentage: 0 };
  }
  
  const expectedItems = await getExamScoringItemsByBelt(candidate.currentBelt);
  const expectedCount = expectedItems.length;
  const scoredCount = scoresWithItems.length;
  
  // 如果評分項目不完整（已評分數 < 應評數），不自動判定結果
  if (expectedCount > 0 && scoredCount < expectedCount) {
    return { passed: false, hasLakLakAward: false, gradeAPercentage: 0, incomplete: true };
  }
  
  const isItemFailed = (scoreValue: string | null): boolean => {
    if (!scoreValue) return true;
    const v = scoreValue.toLowerCase();
    const failValues = ['f', 'false', 'fail', '未達標', '否', '不合格', '沒有'];
    return failValues.includes(v);
  };
  
  const isGradeA = (scoreValue: string | null): boolean => {
    if (!scoreValue) return false;
    return scoreValue.toUpperCase() === 'A';
  };
  
  let hasAnyFailed = false;
  let totalGradableItems = 0;
  let gradeACount = 0;
  
  for (const { score, item } of scoresWithItems) {
    if (isItemFailed(score.score)) hasAnyFailed = true;
    if (item.type === 'grade') {
      totalGradableItems++;
      if (isGradeA(score.score)) gradeACount++;
    }
  }
  
  const passed = !hasAnyFailed;
  const gradeAPercentage = totalGradableItems > 0 ? (gradeACount / totalGradableItems) * 100 : 0;
  
  // 補考生不能獲得叻叻獎 — 檢查是否有上次考試同帶同目標不合格/缺席記錄
  let isRetake = false;
  if (candidate.name && candidate.phone) {
    const db = await getDb();
    const prevRetake = await db!.select({ id: examCandidates.id }).from(examCandidates)
      .where(and(
        eq(examCandidates.name, candidate.name),
        eq(examCandidates.phone, candidate.phone),
        eq(examCandidates.currentBelt, candidate.currentBelt),
        eq(examCandidates.targetBelt, candidate.targetBelt),
        sql`${examCandidates.examId} < ${candidate.examId}`,
        sql`${examCandidates.status} IN ('failed', 'absent')`
      ))
      .limit(1);
    isRetake = prevRetake.length > 0;
  }
  
  const hasLakLakAward = passed && !isRetake && gradeAPercentage >= 80;
  
  // 取得之前的狀態（用來判斷是否需要升帶或回退）
  const previousStatus = candidate.status;
  
  // 更新考生狀態
  await updateExamCandidate(candidateId, {
    status: passed ? 'passed' : 'failed',
    hasLakLakAward,
  } as any);
  
  // === 全自動升帶/回退邏輯 ===
  let promoted = false;
  let reverted = false;
  
  if (passed && previousStatus !== 'passed') {
    // 新判定為 passed → 自動升帶
    const promoteResult = await promotePassedCandidate(candidateId);
    promoted = promoteResult.success;
  } else if (!passed && previousStatus === 'passed') {
    // 原本 passed 現在改為 failed → 自動回退帶級
    const revertResult = await revertCandidateBelt(candidateId);
    reverted = revertResult.success;
  }
  
  return { passed, hasLakLakAward, gradeAPercentage, incomplete: false, promoted, reverted };
}

// --- 回退考生帶級（改分後從 passed 變 failed 時調用）---
export async function revertCandidateBelt(candidateId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  const candidate = await getExamCandidateById(candidateId);
  if (!candidate) return { success: false };
  
  let matchedStudentId = candidate.studentId;
  
  // 如果沒有 student_id，嘗試匹配
  if (!matchedStudentId) {
    let matchedStudents: any[] = [];
    if (candidate.name && candidate.phone) {
      matchedStudents = await db.select().from(students)
        .where(and(eq(students.name, candidate.name), eq(students.phone, candidate.phone)))
        .limit(1);
    }
    if (matchedStudents.length === 0 && candidate.name) {
      matchedStudents = await db.select().from(students)
        .where(eq(students.name, candidate.name));
      if (matchedStudents.length !== 1) matchedStudents = [];
    }
    if (matchedStudents.length > 0) {
      matchedStudentId = matchedStudents[0].id;
    }
  }
  
  if (matchedStudentId) {
    // 回退到考前帶級 (candidate.currentBelt)
    const chineseBelt = beltKeyToChinese(candidate.currentBelt);
    await db.update(students).set({ beltLevel: chineseBelt } as any).where(eq(students.id, matchedStudentId));
    return { success: true };
  }
  
  return { success: false };
}

// --- 批量升帶 (考試完成後) ---
export async function promoteAllPassedCandidates(examId: number): Promise<{ promoted: number, failed: number }> {
  const candidates = await getExamCandidatesByExam(examId);
  let promoted = 0;
  let failed = 0;
  
  for (const c of candidates) {
    if (c.status === 'passed') {
      const result = await promotePassedCandidate(c.id);
      if (result.success) promoted++;
      else failed++;
    }
  }
  
  return { promoted, failed };
}

// --- 考生成績查詢（家長） ---
export async function getExamResultsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const candidateRecords = await db.select().from(examCandidates)
    .where(eq(examCandidates.studentId, studentId))
    .orderBy(desc(examCandidates.createdAt));
  
  const results = [];
  for (const c of candidateRecords) {
    const exam = await getExamSessionById(c.examId);
    const scores = await getExamScoresWithItemsByCandidate(c.id);
    const payment = await getExamPaymentByCandidate(c.id);
    results.push({
      exam,
      candidate: c,
      scores: scores.map(s => ({
        itemName: s.item.name,
        itemType: s.item.type,
        itemCategory: s.item.category,
        score: s.score.score,
        comment: s.score.comment,
      })),
      payment: payment ? {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        bank: payment.bank,
        receivingBank: payment.receivingBank,
        paymentDate: payment.paymentDate,
        receiptUrl: payment.receiptUrl,
        isRetake: payment.isRetake,
        notes: payment.notes,
      } : null,
    });
  }
  return results;
}

export async function getExamResultsByPhone(phone: string) {
  const db = await getDb();
  if (!db) return [];
  
  const candidateRecords = await db.select().from(examCandidates)
    .where(eq(examCandidates.phone, phone))
    .orderBy(desc(examCandidates.createdAt));
  
  const results = [];
  for (const c of candidateRecords) {
    const exam = await getExamSessionById(c.examId);
    const scores = await getExamScoresWithItemsByCandidate(c.id);
    const payment = await getExamPaymentByCandidate(c.id);
    results.push({
      exam,
      candidate: c,
      scores: scores.map(s => ({
        itemName: s.item.name,
        itemType: s.item.type,
        itemCategory: s.item.category,
        score: s.score.score,
        comment: s.score.comment,
      })),
      payment: payment ? {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        bank: payment.bank,
        receivingBank: payment.receivingBank,
        paymentDate: payment.paymentDate,
        receiptUrl: payment.receiptUrl,
        isRetake: payment.isRetake,
        notes: payment.notes,
      } : null,
    });
  }
  return results;
}

// ==================== Exam Schedule Functions ====================
export async function getExamSchedulesByExam(examId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examSchedules)
    .where(eq(examSchedules.examId, examId))
    .orderBy(asc(examSchedules.startTime));
}

export async function getExamScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(examSchedules).where(eq(examSchedules.id, id)).limit(1);
  return result[0] || null;
}

export async function insertExamSchedule(data: InsertExamSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(examSchedules).values(data as any);
  return { insertId: Number(result[0].insertId) };
}

export async function updateExamSchedule(id: number, data: Partial<InsertExamSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(examSchedules).set(data as any).where(eq(examSchedules.id, id));
}

export async function deleteExamSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(examSchedules).where(eq(examSchedules.id, id));
}

export async function deleteAllExamSchedulesByExam(examId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(examSchedules).where(eq(examSchedules.examId, examId));
}

// ==================== Exam Attendance (Check-in) Functions ====================
export async function examCheckIn(candidateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(examCandidates).set({ status: 'checked_in' } as any).where(eq(examCandidates.id, candidateId));
}

export async function examUndoCheckIn(candidateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(examCandidates).set({ status: 'registered' } as any).where(eq(examCandidates.id, candidateId));
}

export async function examMarkAbsent(candidateId: number, absent: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const newStatus = absent ? 'absent' : 'registered';
  await db.update(examCandidates).set({ status: newStatus } as any).where(eq(examCandidates.id, candidateId));
  if (absent) {
    await deleteExamScoresByCandidate(candidateId);
  }
}

// ==================== Exam Search & Bulk Functions ====================
export async function searchExamCandidates(examId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examCandidates)
    .where(and(
      eq(examCandidates.examId, examId),
      sql`${examCandidates.name} LIKE ${'%' + query + '%'}`
    ))
    .orderBy(asc(examCandidates.name));
}

export async function bulkDeleteExamCandidates(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return;
  await db.delete(examCandidates).where(inArray(examCandidates.id, ids));
}

// ==================== System Config ====================
export async function getSystemConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(systemConfig)
    .where(eq(systemConfig.configKey, key))
    .limit(1);
  return rows.length > 0 ? rows[0].configValue : null;
}

export async function setSystemConfig(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(systemConfig)
    .where(eq(systemConfig.configKey, key))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(systemConfig)
      .set({ configValue: value, ...(description ? { description } : {}) })
      .where(eq(systemConfig.configKey, key));
  } else {
    await db.insert(systemConfig).values({
      configKey: key,
      configValue: value,
      description: description || null,
    });
  }
}

export async function getAllSystemConfigs(): Promise<Array<{ configKey: string; configValue: string; description: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    configKey: systemConfig.configKey,
    configValue: systemConfig.configValue,
    description: systemConfig.description,
  }).from(systemConfig);
}

/**
 * 獲取接受的收款帳號列表
 */
export async function getAcceptedPayeeAccounts(): Promise<Array<{ name: string; account: string; type: string }>> {
  const json = await getSystemConfig('accepted_payee_accounts');
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// ==================== 會計模組 — Journal Entry Service ====================

/**
 * 生成流水編號（在 transaction 內使用 FOR UPDATE 防並發衝突）
 */
async function generateEntryNumber(
  tx: any,
  fiscalYear: number,
  fiscalMonth: number,
): Promise<string> {
  const yearMonth = `${fiscalYear}${fiscalMonth.toString().padStart(2, '0')}`;
  
  const result = await tx.execute(sql`
    SELECT entry_number FROM journal_entries
    WHERE fiscal_year = ${fiscalYear} AND fiscal_month = ${fiscalMonth}
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
  `);

  let seq = 1;
  const rows = (result[0] as Array<{ entry_number: string }>);
  if (rows.length > 0) {
    const lastNum = rows[0].entry_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `JE-${yearMonth}-${seq.toString().padStart(4, '0')}`;
}

/**
 * 根據 accounting_record 找到匹配的 mapping rule
 */
export async function findMatchingRule(
  recordType: 'income' | 'expense',
  category: string,
  paymentMethod: string | null,
) {
  const db = await getDb();
  if (!db) return null;

  // 第一優先：精確匹配 recordType + category + paymentMethod
  if (paymentMethod) {
    const exactMatch = await db
      .select()
      .from(mappingRules)
      .where(
        and(
          eq(mappingRules.recordType, recordType),
          eq(mappingRules.category, category),
          eq(mappingRules.paymentMethod, paymentMethod),
          eq(mappingRules.isActive, true),
        ),
      )
      .orderBy(desc(mappingRules.priority))
      .limit(1);
    if (exactMatch.length > 0) return exactMatch[0];
  }

  // 第二優先：paymentMethod 為 null 的通用規則
  const fallback = await db
    .select()
    .from(mappingRules)
    .where(
      and(
        eq(mappingRules.recordType, recordType),
        eq(mappingRules.category, category),
        isNull(mappingRules.paymentMethod),
        eq(mappingRules.isActive, true),
      ),
    )
    .orderBy(desc(mappingRules.priority))
    .limit(1);

  return fallback[0] ?? null;
}

/**
 * 從單筆 accounting_record 自動生成 Journal Entry
 */
export async function createJournalEntryFromRecord(record: {
  id: number;
  type: 'income' | 'expense';
  amount: string;
  category: string;
  paymentMethod?: string | null;
  description?: string | null;
  date: string; // YYYY-MM-DD
}): Promise<{ success: boolean; journalEntryId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  // Skip zero-amount records
  const amt = parseFloat(record.amount || '0');
  if (amt === 0) {
    return { success: false, error: `Skipped zero-amount record #${record.id}` };
  }

  const rule = await findMatchingRule(record.type, record.category, record.paymentMethod ?? null);
  if (!rule) {
    return { success: false, error: `No mapping rule for type="${record.type}", category="${record.category}"` };
  }

  const entryDate = record.date;
  const fiscalYear = parseInt(entryDate.slice(0, 4), 10);
  const fiscalMonth = parseInt(entryDate.slice(5, 7), 10);

  try {
    const journalEntryId = await db.transaction(async (tx: any) => {
      const entryNumber = await generateEntryNumber(tx, fiscalYear, fiscalMonth);

      const insertResult = await tx.insert(journalEntries).values({
        entryNumber,
        entryDate,
        description: record.description || rule.nameZh,
        sourceType: 'auto_sync' as const,
        sourceId: record.id,
        sourceTable: 'accounting_records',
        fiscalYear,
        fiscalMonth,
        isPosted: true,
        postedAt: new Date(),
        postedBy: 'system',
      });

      const newId = Number(insertResult[0].insertId);

      await tx.insert(journalEntryLines).values([
        {
          journalEntryId: newId,
          accountCode: rule.debitAccountCode,
          debit: record.amount,
          credit: '0.00',
          description: rule.nameZh,
        },
        {
          journalEntryId: newId,
          accountCode: rule.creditAccountCode,
          debit: '0.00',
          credit: record.amount,
          description: rule.nameZh,
        },
      ]);

      return newId;
    });

    return { success: true, journalEntryId };
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return { success: false, error: `Journal entry already exists for record #${record.id}` };
    }
    throw err;
  }
}

/**
 * 批量同步所有尚未生成 Journal Entry 的 accounting_records
 */
export async function syncAllPendingRecords(): Promise<{
  total: number; success: number; failed: number;
  errors: Array<{ recordId: number; error: string }>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, success: 0, failed: 0, errors: [] };

  // 找出已有 journal entry 的 source_id
  const existingRows = await db
    .select({ sourceId: journalEntries.sourceId })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceType, 'auto_sync'),
        eq(journalEntries.sourceTable, 'accounting_records'),
      ),
    );

  const existingIdSet = new Set(
    existingRows.map((r) => r.sourceId).filter((id): id is number => id !== null),
  );

  const allRecords = await db.select().from(accountingRecords);
  const pendingRecords = allRecords.filter((r) => !existingIdSet.has(r.id));

  const errors: Array<{ recordId: number; error: string }> = [];
  let successCount = 0;

  for (const record of pendingRecords) {
    const dateStr = record.transactionDate instanceof Date
      ? record.transactionDate.toISOString().split('T')[0]
      : String(record.transactionDate).split('T')[0];

    const result = await createJournalEntryFromRecord({
      id: record.id,
      type: record.type as 'income' | 'expense',
      amount: String(record.amount),
      category: record.category,
      description: record.description ?? null,
      date: dateStr,
    });

    if (result.success) {
      if (result.journalEntryId) {
        await db.update(accountingRecords)
          .set({ journalEntryId: result.journalEntryId })
          .where(eq(accountingRecords.id, record.id));
      }
      successCount++;
    } else {
      errors.push({ recordId: record.id, error: result.error! });
    }
  }

  return { total: pendingRecords.length, success: successCount, failed: errors.length, errors };
}

/**
 * 手動建立 Journal Entry
 */
export async function createManualJournalEntry(input: {
  entryDate: string;
  description: string;
  notes?: string;
  lines: Array<{ accountCode: string; debit: string; credit: string; description?: string }>;
}): Promise<{ success: boolean; journalEntryId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  // 驗證借貸平衡
  const totalDebit = input.lines.reduce((sum, l) => sum + parseFloat(l.debit || '0'), 0);
  const totalCredit = input.lines.reduce((sum, l) => sum + parseFloat(l.credit || '0'), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { success: false, error: `借貸不平衡: Dr $${totalDebit.toFixed(2)} ≠ Cr $${totalCredit.toFixed(2)}` };
  }
  if (totalDebit === 0) {
    return { success: false, error: '金額不可為零' };
  }

  for (const line of input.lines) {
    const dr = parseFloat(line.debit || '0');
    const cr = parseFloat(line.credit || '0');
    if (dr === 0 && cr === 0) return { success: false, error: '每行至少要有借方或貸方金額' };
    if (dr > 0 && cr > 0) return { success: false, error: '同一行不可同時有借方和貸方金額' };
  }

  const fiscalYear = parseInt(input.entryDate.slice(0, 4), 10);
  const fiscalMonth = parseInt(input.entryDate.slice(5, 7), 10);

  try {
    const journalEntryId = await db.transaction(async (tx: any) => {
      const entryNumber = await generateEntryNumber(tx, fiscalYear, fiscalMonth);

      const insertResult = await tx.insert(journalEntries).values({
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        sourceType: 'manual' as const,
        sourceId: null,
        sourceTable: null,
        fiscalYear,
        fiscalMonth,
        isPosted: false,
        notes: input.notes ?? null,
      });

      const newId = Number(insertResult[0].insertId);

      await tx.insert(journalEntryLines).values(
        input.lines.map((line) => ({
          journalEntryId: newId,
          accountCode: line.accountCode,
          debit: line.debit || '0.00',
          credit: line.credit || '0.00',
          description: line.description ?? null,
        })),
      );

      return newId;
    });

    return { success: true, journalEntryId };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Unknown error' };
  }
}

/**
 * 過帳
 */
export async function postJournalEntry(id: number, postedBy: string) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  const entry = await db.select({ isLocked: journalEntries.isLocked, isPosted: journalEntries.isPosted })
    .from(journalEntries).where(eq(journalEntries.id, id)).limit(1);

  if (!entry[0]) return { success: false, error: '找不到此分錄' };
  if (entry[0].isLocked) return { success: false, error: '此期間已鎖定' };
  if (entry[0].isPosted) return { success: false, error: '此分錄已過帳' };

  await db.update(journalEntries)
    .set({ isPosted: true, postedAt: new Date(), postedBy })
    .where(eq(journalEntries.id, id));

  return { success: true, journalEntryId: id };
}

/**
 * 取消過帳
 */
export async function unpostJournalEntry(id: number) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  const entry = await db.select({ isLocked: journalEntries.isLocked })
    .from(journalEntries).where(eq(journalEntries.id, id)).limit(1);

  if (!entry[0]) return { success: false, error: '找不到此分錄' };
  if (entry[0].isLocked) return { success: false, error: '此期間已鎖定' };

  await db.update(journalEntries)
    .set({ isPosted: false, postedAt: null, postedBy: null })
    .where(eq(journalEntries.id, id));

  return { success: true, journalEntryId: id };
}

/**
 * 鎖定期間
 */
export async function lockPeriod(fiscalYear: number, fiscalMonth: number) {
  const db = await getDb();
  if (!db) return { success: false, lockedCount: 0, error: 'Database not available' };

  const unposted = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.fiscalYear, fiscalYear),
      eq(journalEntries.fiscalMonth, fiscalMonth),
      eq(journalEntries.isPosted, false),
    ));

  const unpostedCount = Number(unposted[0].count);
  if (unpostedCount > 0) {
    return { success: false, lockedCount: 0, error: `尚有 ${unpostedCount} 筆未過帳分錄，請先全部過帳再鎖定` };
  }

  const result = await db.update(journalEntries)
    .set({ isLocked: true })
    .where(and(
      eq(journalEntries.fiscalYear, fiscalYear),
      eq(journalEntries.fiscalMonth, fiscalMonth),
    ));

  return { success: true, lockedCount: Number((result[0] as any).affectedRows ?? 0) };
}

/**
 * 刪除分錄（只能刪未過帳且未鎖定的）
 */
export async function deleteJournalEntry(id: number) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  const entry = await db.select({ isLocked: journalEntries.isLocked, isPosted: journalEntries.isPosted })
    .from(journalEntries).where(eq(journalEntries.id, id)).limit(1);

  if (!entry[0]) return { success: false, error: '找不到此分錄' };
  if (entry[0].isLocked) return { success: false, error: '此期間已鎖定，不可刪除' };
  if (entry[0].isPosted) return { success: false, error: '已過帳的分錄不可刪除，請先取消過帳' };

  await db.delete(journalEntries).where(eq(journalEntries.id, id));
  return { success: true };
}

/**
 * 當新 accounting_record 被建立後，自動生成 Journal Entry（Hook）
 * @param recordId - accounting_records 的 ID
 * @param paymentMethod - 標準化後的銀行代碼 (hsbc/boc/fps/scb/hangseng/cash/bank)，用於匹配映射規則
 */
export async function onAccountingRecordCreated(recordId: number, paymentMethod?: string | null) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  const records = await db.select().from(accountingRecords).where(eq(accountingRecords.id, recordId)).limit(1);
  const record = records[0];
  if (!record) return { success: false, error: `Record #${recordId} not found` };

  const dateStr = record.transactionDate instanceof Date
    ? record.transactionDate.toISOString().split('T')[0]
    : String(record.transactionDate).split('T')[0];

  // 如果沒有傳入 paymentMethod，嘗試從 record.bank 欄位推斷
  const resolvedPaymentMethod = paymentMethod || normalizeBankName(record.bank);

  const result = await createJournalEntryFromRecord({
    id: record.id,
    type: record.type as 'income' | 'expense',
    amount: String(record.amount),
    category: record.category,
    paymentMethod: resolvedPaymentMethod,
    description: record.description ?? null,
    date: dateStr,
  });

  if (result.success && result.journalEntryId) {
    await db.update(accountingRecords)
      .set({ journalEntryId: result.journalEntryId })
      .where(eq(accountingRecords.id, recordId));
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════
//  收據審查系統 — Receipt Review System
// ════════════════════════════════════════════════════════════════════════

/**
 * 檢測疑似重複收據：根據轉帳日期、金額、收據 key 比對
 */
export async function checkDuplicateReceipt(params: {
  studentId: number;
  amount: string;
  receiptTransferDate: Date | null;
  receiptKey: string | null;
  paymentType: 'regular' | 'elite';
}): Promise<{ isDuplicate: boolean; matchType: string | null; matchPaymentId: number | null; reason: string | null }> {
  const pool = await getRawPool();
  if (!pool) return { isDuplicate: false, matchType: null, matchPaymentId: null, reason: null };

  try {
    const parsedAmount = parseFloat(params.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return { isDuplicate: false, matchType: null, matchPaymentId: null, reason: null };
    }

    const table = params.paymentType === 'elite' ? 'elite_payments' : 'paymentRecords';
    const studentIdCol = params.paymentType === 'elite' ? 'student_id' : 'studentId';
    const dateCol = params.paymentType === 'elite' ? 'payment_date' : 'receiptTransferDate';

    // 1. 同學生 + 同金額 + 同日期（±24小時）
    if (params.receiptTransferDate) {
      const [rows] = await pool.execute(
        `SELECT id, amount, ${dateCol} as txDate
         FROM ${table}
         WHERE ${studentIdCol} = ?
           AND ABS(CAST(amount AS DECIMAL(10,2)) - ?) < 0.01
           AND ${dateCol} IS NOT NULL
           AND ABS(TIMESTAMPDIFF(HOUR, ${dateCol}, ?)) <= 24
           AND review_status != 'rejected'
         ORDER BY id DESC LIMIT 1`,
        [params.studentId, parsedAmount, params.receiptTransferDate]
      ) as any;
      if (rows?.length > 0) {
        return {
          isDuplicate: true,
          matchType: 'same_amount_date',
          matchPaymentId: rows[0].id,
          reason: `同學生、同金額($${parsedAmount})、相近轉帳時間`
        };
      }
    }

    // 2. 跨學生重複檢測：同金額 + 同日期 + 同收據圖片key（防止同一張收據用於不同學生）
    // 注意：僅比對收據圖片key相同的情況，避免不同學生同日繳同金額被誤判
    if (params.receiptTransferDate && params.receiptKey) {
      const [rows2] = await pool.execute(
        `SELECT id, ${studentIdCol} as sid, amount
         FROM ${table}
         WHERE ABS(CAST(amount AS DECIMAL(10,2)) - ?) < 0.01
           AND ${dateCol} IS NOT NULL
           AND ABS(TIMESTAMPDIFF(HOUR, ${dateCol}, ?)) <= 24
           AND receiptKey = ?
           AND ${studentIdCol} != ?
           AND review_status != 'rejected'
         ORDER BY id DESC LIMIT 1`,
        [parsedAmount, params.receiptTransferDate, params.receiptKey, params.studentId]
      ) as any;
      if (rows2?.length > 0) {
        return {
          isDuplicate: true,
          matchType: 'same_receipt_diff_student',
          matchPaymentId: rows2[0].id,
          reason: `同一張收據圖片已用於其他學生的繳費記錄`
        };
      }
    }

    return { isDuplicate: false, matchType: null, matchPaymentId: null, reason: null };
  } catch (err) {
    console.error("[ReceiptReview] checkDuplicateReceipt error:", err);
    return { isDuplicate: false, matchType: null, matchPaymentId: null, reason: null };
  }
}

/**
 * 取得待審查收據列表
 */
export async function getReceiptReviews(status: string = 'pending_review', coachName?: string | null): Promise<any[]> {
  const pool = await getRawPool();
  if (!pool) return [];

  try {
    // 教練只能看到自己道場學生的收據
    const coachFilter = coachName ? ' AND s.coach = ?' : '';
    const regularParams = coachName ? [status, coachName] : [status];

    const [regularRows] = await pool.execute(
      `SELECT p.id, p.studentId, s.name as studentName, p.amount, p.paymentPeriod, p.paymentDate,
              p.receiptUrl, p.receiptTransferDate, p.review_status, p.review_reason, p.review_match_type,
              p.review_match_payment_id, p.reviewed_by, p.reviewed_at, p.createdAt, p.confirmedBy,
              'regular' as paymentType, s.venue, s.coach
       FROM paymentRecords p
       LEFT JOIN students s ON p.studentId = s.id
       WHERE p.review_status = ?${coachFilter}
       ORDER BY p.createdAt DESC`,
      regularParams
    ) as any;

    const eliteCoachFilter = coachName ? ' AND s.coach = ?' : '';
    const eliteParams = coachName ? [status, coachName] : [status];

    const [eliteRows] = await pool.execute(
      `SELECT p.id, p.student_id as studentId, s.name as studentName, p.amount,
              CONCAT(p.class_count, '堂') as paymentPeriod, p.payment_date as paymentDate,
              p.receipt_url as receiptUrl, p.payment_date as receiptTransferDate,
              p.review_status, p.review_reason, p.review_match_type,
              p.review_match_payment_id, p.reviewed_by, p.reviewed_at, p.created_at as createdAt,
              p.confirmed_by as confirmedBy,
              'elite' as paymentType, '' as venue, s.coach
       FROM elite_payments p
       LEFT JOIN elite_students s ON p.student_id = s.id
       WHERE p.review_status = ?${eliteCoachFilter}
       ORDER BY p.created_at DESC`,
      eliteParams
    ) as any;

    return [...(regularRows || []), ...(eliteRows || [])].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error("[ReceiptReview] getReceiptReviews error:", err);
    return [];
  }
}

/**
 * 取得收據比對詳情
 */
export async function getReceiptCompare(paymentId: number, paymentType: string = 'regular'): Promise<any> {
  const pool = await getRawPool();
  if (!pool) return null;

  try {
    if (paymentType === 'elite') {
      const [rows] = await pool.execute(
        `SELECT p.*, s.name as studentName
         FROM elite_payments p LEFT JOIN elite_students s ON p.student_id = s.id
         WHERE p.id = ?`, [paymentId]
      ) as any;
      if (!rows?.length) return null;
      const current = rows[0];
      let matchedReceipt = null;
      if (current.review_match_payment_id) {
        const [mRows] = await pool.execute(
          `SELECT p.*, s.name as studentName
           FROM elite_payments p LEFT JOIN elite_students s ON p.student_id = s.id
           WHERE p.id = ?`, [current.review_match_payment_id]
        ) as any;
        if (mRows?.length) matchedReceipt = mRows[0];
      }
      return { current, matchedReceipt, paymentType };
    } else {
      const [rows] = await pool.execute(
        `SELECT p.*, s.name as studentName, s.venue
         FROM paymentRecords p LEFT JOIN students s ON p.studentId = s.id
         WHERE p.id = ?`, [paymentId]
      ) as any;
      if (!rows?.length) return null;
      const current = rows[0];
      let matchedReceipt = null;
      if (current.review_match_payment_id) {
        const [mRows] = await pool.execute(
          `SELECT p.*, s.name as studentName, s.venue
           FROM paymentRecords p LEFT JOIN students s ON p.studentId = s.id
           WHERE p.id = ?`, [current.review_match_payment_id]
        ) as any;
        if (mRows?.length) matchedReceipt = mRows[0];
      }
      return { current, matchedReceipt, paymentType };
    }
  } catch (err) {
    console.error("[ReceiptReview] getReceiptCompare error:", err);
    return null;
  }
}

/**
 * 審查收據：批准或拒絕
 */
export async function reviewReceipt(params: {
  paymentId: number;
  paymentType: 'regular' | 'elite';
  decision: 'approved' | 'rejected';
  reviewedBy: string;
  confirmedBy?: string; // 'admin_approved' | 'coach_approved'
}): Promise<boolean> {
  const pool = await getRawPool();
  if (!pool) return false;

  try {
    const table = params.paymentType === 'elite' ? 'elite_payments' : 'paymentRecords';
    const confirmedByCol = params.paymentType === 'elite' ? 'confirmed_by' : 'confirmedBy';
    
    // 批准時同時更新 confirmedBy，以記錄是管理員還是教練核准
    if (params.decision === 'approved' && params.confirmedBy) {
      await pool.execute(
        `UPDATE ${table}
         SET review_status = ?, reviewed_by = ?, reviewed_at = NOW(),
             status = ?, ${confirmedByCol} = ?
         WHERE id = ?`,
        [
          params.decision,
          params.reviewedBy,
          'confirmed',
          params.confirmedBy,
          params.paymentId
        ]
      );
    } else {
      await pool.execute(
        `UPDATE ${table}
         SET review_status = ?, reviewed_by = ?, reviewed_at = NOW(),
             status = ?
         WHERE id = ?`,
        [
          params.decision,
          params.reviewedBy,
          params.decision === 'approved' ? 'confirmed' : 'pending',
          params.paymentId
        ]
      );
    }
    return true;
  } catch (err) {
    console.error("[ReceiptReview] reviewReceipt error:", err);
    return false;
  }
}

// ===== 銀行月結單持久化 CRUD =====

export async function saveBankStatement(data: {
  bankName: string | null;
  statementMonth: string;
  statementPeriod: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  transactions: Array<{
    date: string | null;
    description: string | null;
    debit: string | null;
    credit: string | null;
    balance: string | null;
    reference: string | null;
  }>;
  uploadedBy?: number;
}): Promise<{ statementId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(bankStatements).values({
    bankName: data.bankName,
    statementMonth: data.statementMonth,
    statementPeriod: data.statementPeriod,
    openingBalance: data.openingBalance,
    closingBalance: data.closingBalance,
    totalTransactions: data.transactions.length,
    matchedCount: 0,
    unmatchedCount: data.transactions.length,
    status: 'pending',
    uploadedBy: data.uploadedBy || null,
  } as any);

  const statementId = (result as any)[0].insertId;

  // Insert all transactions
  if (data.transactions.length > 0) {
    const txnValues = data.transactions.map(txn => ({
      statementId,
      date: txn.date,
      description: txn.description,
      debit: txn.debit,
      credit: txn.credit,
      balance: txn.balance,
      reference: txn.reference,
      reconcileStatus: 'pending' as const,
    }));
    await db.insert(bankStatementTransactions).values(txnValues as any);
  }

  return { statementId };
}

export async function listBankStatements(): Promise<BankStatement[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bankStatements).orderBy(desc(bankStatements.createdAt));
}

export async function getBankStatementWithTransactions(statementId: number): Promise<{
  statement: BankStatement;
  transactions: BankStatementTransaction[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const stmts = await db.select().from(bankStatements).where(eq(bankStatements.id, statementId)).limit(1);
  if (stmts.length === 0) return null;

  const txns = await db.select().from(bankStatementTransactions)
    .where(eq(bankStatementTransactions.statementId, statementId))
    .orderBy(asc(bankStatementTransactions.id));

  return { statement: stmts[0], transactions: txns };
}

export async function updateBankStatementTransactionStatus(
  txnId: number,
  data: {
    reconcileStatus: 'pending' | 'matched' | 'manual' | 'skipped';
    matchedRecordId?: number | null;
    matchScore?: number | null;
    manualCategory?: string | null;
    manualStudentName?: string | null;
    manualCoachName?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(bankStatementTransactions).set({
    reconcileStatus: data.reconcileStatus,
    matchedRecordId: data.matchedRecordId ?? null,
    matchScore: data.matchScore ?? null,
    manualCategory: data.manualCategory ?? null,
    manualStudentName: data.manualStudentName ?? null,
    manualCoachName: data.manualCoachName ?? null,
    reconciledAt: data.reconcileStatus !== 'pending' ? new Date() : null,
  } as any).where(eq(bankStatementTransactions.id, txnId));
}

export async function updateBankStatementCounts(statementId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const txns = await db.select().from(bankStatementTransactions)
    .where(eq(bankStatementTransactions.statementId, statementId));

  const total = txns.length;
  const matched = txns.filter(t => t.reconcileStatus === 'matched' || t.reconcileStatus === 'manual').length;
  const pending = txns.filter(t => t.reconcileStatus === 'pending').length;

  let status: 'pending' | 'partial' | 'completed' = 'pending';
  if (matched === total && total > 0) status = 'completed';
  else if (matched > 0) status = 'partial';

  await db.update(bankStatements).set({
    matchedCount: matched,
    unmatchedCount: pending,
    status,
  } as any).where(eq(bankStatements.id, statementId));
}

export async function deleteBankStatement(statementId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(bankStatementTransactions).where(eq(bankStatementTransactions.statementId, statementId));
  await db.delete(bankStatements).where(eq(bankStatements.id, statementId));
}

// ============ Exam Payments (考試繳費) ============

/** 取得某場考試的所有繳費記錄 */
export async function getExamPaymentsByExam(examId: number): Promise<ExamPayment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examPayments).where(eq(examPayments.examId, examId)).orderBy(asc(examPayments.studentName));
}

/** 取得某學生的所有考試繳費記錄 */
export async function getExamPaymentsByStudent(studentId: number): Promise<ExamPayment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examPayments).where(eq(examPayments.studentId, studentId)).orderBy(desc(examPayments.createdAt));
}

/** 取得某考生的繳費記錄 */
export async function getExamPaymentByCandidate(candidateId: number): Promise<ExamPayment | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(examPayments).where(eq(examPayments.candidateId, candidateId)).limit(1);
  return result[0] || null;
}

export async function getExamPaymentById(id: number): Promise<ExamPayment | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(examPayments).where(eq(examPayments.id, id)).limit(1);
  return result[0] || null;
}

/** 新增考試繳費記錄 */
export async function insertExamPayment(data: InsertExamPayment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(examPayments).values(data);
  return result[0].insertId;
}

/** 更新考試繳費記錄 */
export async function updateExamPayment(id: number, data: Partial<InsertExamPayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(examPayments).set(data).where(eq(examPayments.id, id));
}

/** 刪除考試繳費記錄 */
export async function deleteExamPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(examPayments).where(eq(examPayments.id, id));
}

/** 批量新增考試繳費記錄 */
export async function bulkInsertExamPayments(records: InsertExamPayment[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (records.length === 0) return 0;
  const result = await db.insert(examPayments).values(records);
  return records.length;
}

/** 按學生姓名查詢考試繳費（跨考試） */
export async function getExamPaymentsByStudentName(studentName: string): Promise<ExamPayment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examPayments).where(eq(examPayments.studentName, studentName)).orderBy(desc(examPayments.createdAt));
}

// ==================== 考試報名功能 ====================

/** 帶級中英文對照表 */
const BELT_CN_TO_EN: Record<string, string> = {
  '白帶': 'white', '黃帶': 'yellow', '黃綠帶': 'yellow_green', '綠帶': 'green',
  '綠藍帶': 'green_blue', '藍帶': 'blue', '藍紅帶': 'blue_red', '紅帶': 'red',
  '紅黑帶': 'red_black', '黑帶': 'black', '黑帶2段': 'black_2dan', '黑帶3段': 'black_3dan',
};

const BELT_EN_TO_CN: Record<string, string> = {
  'white': '白帶', 'yellow': '黃帶', 'yellow_green': '黃綠帶', 'green': '綠帶',
  'green_blue': '綠藍帶', 'blue': '藍帶', 'blue_red': '藍紅帶', 'red': '紅帶',
  'red_black': '紅黑帶', 'black': '黑帶', 'black_2dan': '黑帶2段', 'black_3dan': '黑帶3段',
};

/** 帶級升級順序 */
const BELT_ORDER = ['white', 'yellow', 'yellow_green', 'green', 'green_blue', 'blue', 'blue_red', 'red', 'red_black', 'black', 'black_2dan', 'black_3dan'];

/** 根據現有帶級（中文）取得下一級帶級資訊 */
export function getNextBeltFromChinese(currentBeltCn: string): { currentBelt: string; targetBelt: string; targetBeltCn: string } | null {
  const currentBeltEn = BELT_CN_TO_EN[currentBeltCn];
  if (!currentBeltEn) return null;
  const idx = BELT_ORDER.indexOf(currentBeltEn);
  if (idx === -1 || idx >= BELT_ORDER.length - 1) return null;
  const targetBeltEn = BELT_ORDER[idx + 1];
  return {
    currentBelt: currentBeltEn,
    targetBelt: targetBeltEn,
    targetBeltCn: BELT_EN_TO_CN[targetBeltEn] || targetBeltEn,
  };
}

/** 根據目標帶計算考試費用 */
export function calculateExamFee(targetBelt: string): number {
  // 黃/黃綠/綠/紅/紅黑 → $700
  // 綠藍/藍/藍紅 → $800
  // 黑帶及以上 → $2,200
  const fee700 = ['yellow', 'yellow_green', 'green', 'red', 'red_black'];
  const fee800 = ['green_blue', 'blue', 'blue_red'];
  const fee2200 = ['black', 'black_2dan', 'black_3dan'];
  if (fee700.includes(targetBelt)) return 700;
  if (fee800.includes(targetBelt)) return 800;
  if (fee2200.includes(targetBelt)) return 2200;
  return 700; // default
}

/** 取得開放報名的考試列表 */
export async function getExamsOpenForRegistration() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(examSessions)
    .where(eq(examSessions.registrationOpen, true))
    .orderBy(desc(examSessions.examDate));
}

/** 檢查學生是否已報名某考試 */
export async function isStudentRegisteredForExam(examId: number, studentName: string, phone: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(examCandidates)
    .where(and(
      eq(examCandidates.examId, examId),
      eq(examCandidates.name, studentName),
      eq(examCandidates.phone, phone),
    ))
    .limit(1);
  return existing.length > 0;
}

/** 家長報名考試 — 全系統穿透 */
export async function registerStudentForExam(params: {
  examId: number;
  studentId: number | null;
  studentName: string;
  phone: string;
  dojoName: string;
  gender: 'male' | 'female';
  age: number | null;
  currentBeltCn: string;
}): Promise<{
  success: boolean;
  candidateId?: number;
  paymentId?: number;
  accountingId?: number;
  amount?: number;
  targetBelt?: string;
  targetBeltCn?: string;
  error?: string;
}> {
  const { examId, studentId, studentName, phone, dojoName, gender, age, currentBeltCn } = params;

  // 1. 計算目標帶和費用
  const beltInfo = getNextBeltFromChinese(currentBeltCn);
  if (!beltInfo) {
    return { success: false, error: `無法識別帶級: ${currentBeltCn}` };
  }
  const amount = calculateExamFee(beltInfo.targetBelt);

  // 2. 檢查是否重考（之前同一考試已報名且 failed）
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  // 3. 檢查是否已報名
  const alreadyRegistered = await isStudentRegisteredForExam(examId, studentName, phone);
  if (alreadyRegistered) {
    return { success: false, error: '該學生已報名此考試' };
  }

  // 4. 計算年齡分組
  let ageGroup: string | null = null;
  if (age !== null) {
    if (age <= 6) ageGroup = '6歲或以下';
    else if (age <= 9) ageGroup = '7-9歲';
    else if (age <= 12) ageGroup = '10-12歲';
    else if (age <= 15) ageGroup = '13-15歲';
    else ageGroup = '16歲或以上';
  }

  // 5. 建立考生記錄 (exam_candidates)
  const candidateResult = await db.insert(examCandidates).values({
    examId,
    studentId,
    name: studentName,
    phone,
    dojoName,
    gender,
    age,
    ageGroup,
    currentBelt: beltInfo.currentBelt,
    targetBelt: beltInfo.targetBelt,
    status: 'registered',
  });
  const candidateId = Number(candidateResult[0].insertId);

  // 6. 建立繳費記錄 (exam_payments)
  const paymentResult = await db.insert(examPayments).values({
    examId,
    candidateId,
    studentId,
    studentName,
    targetBelt: beltInfo.targetBelt,
    amount: String(amount),
    isRetake: false,
    status: 'pending', // 待家長上傳收據後確認
  });
  const paymentId = Number(paymentResult[0].insertId);

  // 7. 同步到會計帳目 (先建立 pending 狀態，確認收據後再改 confirmed)
  // 不在此處建 accounting record，等到確認收據時才自動建立

  return {
    success: true,
    candidateId,
    paymentId,
    amount,
    targetBelt: beltInfo.targetBelt,
    targetBeltCn: beltInfo.targetBeltCn,
  };
}

/** 取得某學生在某考試的報名狀態（含繳費情況） */
export async function getStudentExamRegistration(examId: number, studentName: string, phone: string) {
  const db = await getDb();
  if (!db) return null;
  
  const candidates = await db.select().from(examCandidates)
    .where(and(
      eq(examCandidates.examId, examId),
      eq(examCandidates.name, studentName),
      eq(examCandidates.phone, phone),
    ))
    .limit(1);
  
  if (candidates.length === 0) return null;
  const candidate = candidates[0];

  // Get payment record
  const payments = await db.select().from(examPayments)
    .where(eq(examPayments.candidateId, candidate.id))
    .limit(1);
  const payment = payments[0] || null;

  return { candidate, payment };
}

/** 取得某家長（phone）所有考試報名記錄 */
export async function getExamRegistrationsByPhone(phone: string) {
  const db = await getDb();
  if (!db) return [];
  
  const candidates = await db.select().from(examCandidates)
    .where(eq(examCandidates.phone, phone))
    .orderBy(desc(examCandidates.createdAt));
  
  const results = [];
  for (const c of candidates) {
    const exam = await getExamSessionById(c.examId);
    const payments = await db.select().from(examPayments)
      .where(eq(examPayments.candidateId, c.id))
      .limit(1);
    results.push({
      candidate: c,
      exam,
      payment: payments[0] || null,
    });
  }
  return results;
}
