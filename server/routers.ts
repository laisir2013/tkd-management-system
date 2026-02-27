import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { broadcastScoreUpdate, broadcastCandidateUpdate, broadcastStatsUpdate, broadcastAttendanceUpdate } from "./sse";
import { z } from "zod";
import { 
  getStudentsByPhone, 
  getAllStudents, 
  getStudentById,
  updateStudent,
  insertPaymentRecord,
  approvePaymentRecord,
  getPaymentRecordsByStudentIds,
  bulkInsertStudents,
  getStudentsWithPayments,
  getAllDojos,
  insertDojo,
  updateDojo,
  deleteDojo,
  getAllCoaches,
  getAllCoachUsers,
  insertCoach,
  updateCoach,
  deleteCoach,
  getAllBeltLevels,
  insertBeltLevel,
  updateBeltLevel,
  deleteBeltLevel,
  getAllUsers,
  updateUserRole,
  getCoachStatistics,
  getQuarterlyFeeStatistics,
  getQuarterlyPaymentStatuses,
  getMonthlyPaymentStatuses,
  deletePaymentForMonth,
  getPaymentRecordById,
  getMonthlyFinanceReport,
  getDb,
  // 點名系統相關函數
  getTrainingSchedules,
  insertTrainingSchedule,
  updateTrainingScheduleStatus,
  generateTrainingSchedules,
  generateYearlyTrainingSchedules,
  generateMonthlyTrainingSchedules,
  getAttendanceRecords,
  insertAttendanceRecord,
  updateAttendanceRecordStatus,
  upsertAttendanceRecord,
  bulkInsertAttendanceRecords,
  getStudentAttendanceStats,
  getStudentsByClass,
  getAllClassGroups,
  // 精英班堂數追蹤函數
  getEliteClassBalance,
  getAllEliteClassBalances,
  getEliteClassStatistics,
  // WhatsApp 範本相關函數
  getAllWhatsappTemplates,
  getActiveWhatsappTemplates,
  getWhatsappTemplateById,
  createWhatsappTemplate,
  updateWhatsappTemplate,
  deleteWhatsappTemplate,
  // 精英班管理函數
  getAllEliteStudents,
  getEliteStudentById,
  getEliteStudentsByPhone,
  insertEliteStudent,
  updateEliteStudent,
  deleteEliteStudent,
  getEliteTrainingSchedules,
  insertEliteTrainingSchedule,
  updateEliteTrainingScheduleStatus,
  generateEliteTrainingSchedules,
  getEliteAttendanceRecords,
  upsertEliteAttendanceRecord,
  getElitePaymentRecords,
  insertElitePaymentRecord,
  getEliteStudentBalance,
  getParentAttendanceRecords,
  getEliteCycleInfo,
  getAllEliteCycleInfo,
  getParentEliteInfo,
  getCoachStatsWithElite,
  // 會計記錄相關函數
  getAllAccountingRecords,
  insertAccountingRecord,
  updateAccountingRecord,
  deleteAccountingRecord,
  syncPaymentToAccounting,
  syncElitePaymentToAccounting,
  getAccountingRecordByPaymentId,
  getAccountingSummary,
  // 活動管理函數
  getAllEvents,
  getOpenEvents,
  insertEvent,
  updateEvent,
  deleteEvent,
  getEventRegistrations,
  registerForEvent,
  cancelEventRegistration,
  updateEventRegistrationStatus,
  getEventRegistrationCount,
  // 考試評分系統函數
  getAllExamSessions,
  getExamSessionById,
  insertExamSession,
  updateExamSession,
  deleteExamSession,
  getExamCandidatesByExam,
  getExamCandidatesByBelt,
  getExamCandidateById,
  insertExamCandidate,
  bulkInsertExamCandidates,
  updateExamCandidate,
  deleteExamCandidate,
  getExamScoringItems,
  insertExamScoringItem,
  bulkInsertExamScoringItems,
  getExamScoringItemsByBelt,
  upsertExamScore,
  getExamScoresByCandidate,
  getExamScoresWithItemsByCandidate,
  getExamScoresByExam,
  deleteExamScoresByCandidate,
  getExamStatistics,
  calculateExamResult,
  promotePassedCandidate,
  promoteAllPassedCandidates,
  createCandidatesFromEventRegistrations,
  getExamResultsByStudent,
  getExamResultsByPhone,
  // Exam Schedule & Attendance
  getExamSchedulesByExam,
  getExamScheduleById,
  insertExamSchedule,
  updateExamSchedule,
  deleteExamSchedule,
  deleteAllExamSchedulesByExam,
  examCheckIn,
  examUndoCheckIn,
  examMarkAbsent,
  searchExamCandidates,
  bulkDeleteExamCandidates,
  getSystemConfig,
  setSystemConfig,
  getAllSystemConfigs,
  getAcceptedPayeeAccounts,
  // 會計模組 — Journal Entry Service
  findMatchingRule,
  createJournalEntryFromRecord,
  syncAllPendingRecords,
  createManualJournalEntry,
  postJournalEntry,
  unpostJournalEntry,
  lockPeriod,
  deleteJournalEntry,
  onAccountingRecordCreated,
} from "./db";
import { users, students, InsertStudent } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { eq, gte, lte, and, desc, sql, asc } from "drizzle-orm";
import { verifyPassword, hashPassword } from "./password";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { ocrReceipt } from "./_core/localOcr";
import { stampReceipt } from "./_core/receiptStamp";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // 家長登入 - 同時檢查恆常班和精英班學生表
    loginParent: publicProcedure
      .input(z.object({ phone: z.string(), password: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "系統錯誤" };
        
        // 同時查詢恆常班和精英班
        const regularStudents = await db
          .select()
          .from(students)
          .where(eq(students.phone, input.phone));
        
        const { eliteStudents: eliteStudentsTable } = await import('../drizzle/schema');
        const eliteStudentList = await db
          .select()
          .from(eliteStudentsTable)
          .where(eq(eliteStudentsTable.phone, input.phone));
        
        // 如果兩邊都找不到
        if (regularStudents.length === 0 && eliteStudentList.length === 0) {
          return { success: false, error: "找不到此電話號碼的學生記錄" };
        }
        
        // 優先用恆常班學生驗證密碼，如果沒有恆常班則用精英班
        const primaryStudent = regularStudents.length > 0 ? regularStudents[0] : null;
        const primaryElite = eliteStudentList.length > 0 ? eliteStudentList[0] : null;
        const authTarget = primaryStudent || primaryElite;
        
        if (!authTarget) {
          return { success: false, error: "找不到此電話號碼的學生記錄" };
        }
        
        // 如果沒有設定密碼,使用電話號碼作為預設密碼
        if (!authTarget.password) {
          if (input.password === input.phone) {
            return {
              success: true,
              students: regularStudents,
              hasElite: eliteStudentList.length > 0,
              needPasswordChange: true,
            };
          }
          return { success: false, error: "密碼錯誤" };
        }
        
        // 驗證密碼
        const isValid = await verifyPassword(input.password, authTarget.password);
        if (isValid) {
          return {
            success: true,
            students: regularStudents,
            hasElite: eliteStudentList.length > 0,
          };
        }
        return { success: false, error: "密碼錯誤" };
      }),

    // 教練登入 - 只檢查 role='coach' 的 users
    loginCoach: publicProcedure
      .input(z.object({ phone: z.string(), password: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "系統錯誤" };
        
        const coachUser = await db
          .select()
          .from(users)
          // @ts-ignore - phone 欄位已在資料庫中加入
          .where(eq(users.phone, input.phone))
          .limit(1);
        
        // @ts-ignore - role 已支援 coach
        if (coachUser.length === 0 || coachUser[0].role !== 'coach') {
          return { success: false, error: "找不到此電話號碼的教練帳號" };
        }
        
        const user = coachUser[0];
        // 如果沒有設定密碼,使用電話號碼作為預設密碼
        // @ts-ignore
        if (!user.password) {
          if (input.password === input.phone) {
            return {
              success: true,
              user,
              needPasswordChange: true,
            };
          }
          return { success: false, error: "密碼錯誤" };
        }
        
        // 驗證密碼
        // @ts-ignore
        const isValid = await verifyPassword(input.password, user.password);
        if (isValid) {
          return {
            success: true,
            user,
          };
        }
        return { success: false, error: "密碼錯誤" };
      }),

    // 管理員登入 - 只檢查 role='admin' 的 users
    loginAdmin: publicProcedure
      .input(z.object({ phone: z.string(), password: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "系統錯誤" };
        
        const adminUser = await db
          .select()
          .from(users)
          // @ts-ignore - phone 欄位已在資料庫中加入
          .where(eq(users.phone, input.phone))
          .limit(1);
        
        if (adminUser.length === 0 || adminUser[0].role !== 'admin') {
          return { success: false, error: "找不到此電話號碼的管理員帳號" };
        }
        
        const user = adminUser[0];
        // 如果沒有設定密碼,使用電話號碼作為預設密碼
        // @ts-ignore
        if (!user.password) {
          if (input.password === input.phone) {
            return {
              success: true,
              user,
              needPasswordChange: true,
            };
          }
          return { success: false, error: "密碼錯誤" };
        }
        
        // 驗證密碼
        // @ts-ignore
        const isValid = await verifyPassword(input.password, user.password);
        if (isValid) {
          return {
            success: true,
            user,
          };
        }
        return { success: false, error: "密碼錯誤" };
      }),

    // 統一登入 - 自動識別用戶身份
    login: publicProcedure
      .input(z.object({ phone: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "系統錯誤" };
        
        // 1. 先檢查 users 表(教練和管理員)
        const userResult = await db
          .select()
          .from(users)
          // @ts-ignore
          .where(eq(users.phone, input.phone))
          .limit(1);
        
        if (userResult.length > 0) {
          const user = userResult[0];
          // 驗證密碼
          let isValid = false;
          // @ts-ignore
          if (!user.password) {
            isValid = input.password === input.phone;
          } else {
            // @ts-ignore
            isValid = await verifyPassword(input.password, user.password);
          }
          
          if (isValid) {
            // 建立 session cookie
            // @ts-ignore
            const sessionToken = await sdk.createSessionToken(`phone:${user.phone}`, {
              // @ts-ignore
              name: user.coachName || user.phone,
            });
            const cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
            
            return {
              success: true,
              // @ts-ignore
              role: user.role,
              user,
              // @ts-ignore
              needPasswordChange: !user.password,
              sessionToken, // 回傳 token 讓前端可以存到 localStorage 作為備用
            };
          }
        }
        
        // 2. 檢查 students 表(家長)
        // @ts-ignore
        const studentResult = await db
          .select()
          .from(students)
          .where(eq(students.phone, input.phone))
          .limit(1);
        
        if (studentResult.length > 0) {
          const student = studentResult[0];
          // 驗證密碼
          let isValid = false;
          // @ts-ignore
          if (!student.password) {
            isValid = input.password === input.phone;
          } else {
            // @ts-ignore
            isValid = await verifyPassword(input.password, student.password);
          }
          
          if (isValid) {
            // 建立 session cookie
            const sessionToken = await sdk.createSessionToken(`phone:${student.phone}`, {
              name: student.name,
            });
            const cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
            
            return {
              success: true,
              role: 'parent',
              student,
              // @ts-ignore
              needPasswordChange: !student.password,
              sessionToken, // 回傳 token 讓前端可以存到 localStorage 作為備用
            };
          }
        }
        
        return { success: false, error: "電話號碼或密碼錯誤" };
      }),

    // 修改密碼 - 支援家長、教練、管理員
    changePassword: publicProcedure
      .input(z.object({
        phone: z.string(),
        oldPassword: z.string(),
        newPassword: z.string().min(6, "新密碼至少需要6個字元"),
        userType: z.enum(["parent", "coach", "admin"]),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '系統錯誤' });

        if (input.userType === "parent") {
          // 家長 - 從 students 表查詢
          const studentResult = await db.select().from(students).where(eq(students.phone, input.phone)).limit(1);
          if (studentResult.length === 0) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此電話號碼的帳號' });
          }
          const student = studentResult[0];
          // 驗證舊密碼
          let isValid = false;
          // @ts-ignore
          if (!student.password) {
            isValid = input.oldPassword === input.phone;
          } else {
            // @ts-ignore
            isValid = await verifyPassword(input.oldPassword, student.password);
          }
          if (!isValid) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: '舊密碼錯誤' });
          }
          // 更新密碼
          const hashedPassword = await hashPassword(input.newPassword);
          await db.update(schema.students)
            .set({ password: hashedPassword })
            .where(eq(schema.students.phone, input.phone));
          return { success: true, message: '密碼已成功修改' };
        } else {
          // 教練/管理員 - 從 users 表查詢
          const userResult = await db.select().from(users)
            // @ts-ignore
            .where(eq(users.phone, input.phone))
            .limit(1);
          if (userResult.length === 0) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此電話號碼的帳號' });
          }
          const user = userResult[0];
          // 驗證舊密碼
          let isValid = false;
          // @ts-ignore
          if (!user.password) {
            isValid = input.oldPassword === input.phone;
          } else {
            // @ts-ignore
            isValid = await verifyPassword(input.oldPassword, user.password);
          }
          if (!isValid) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: '舊密碼錯誤' });
          }
          // 更新密碼
          const hashedPassword = await hashPassword(input.newPassword);
          await db.update(users)
            // @ts-ignore
            .set({ password: hashedPassword })
            // @ts-ignore
            .where(eq(users.phone, input.phone));
          return { success: true, message: '密碼已成功修改' };
        }
      }),
  }),

  students: router({
    getByPhone: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getStudentsByPhone(input.phone);
      }),

    getParentAttendance: publicProcedure
      .input(z.object({
        phone: z.string(),
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return getParentAttendanceRecords(input.phone, input.year, input.month);
      }),

    // 家長頁面：取得精英班資料（出席詳情+繳費狀態）
    getParentEliteInfo: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getParentEliteInfo(input.phone);
      }),
    
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllStudents();
      }),
    
    getNextUnpaidQuarter: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        // 獲取學生的所有繳費記錄
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }
        
        const payments = await db.select()
          .from(schema.paymentRecords)
          .where(eq(schema.paymentRecords.studentId, input.studentId));
        
        // 獲取已繳費的季度
        const paidQuarters = new Set<string>();
        payments.forEach((payment: any) => {
          const paymentDate = new Date(payment.paymentDate);
          const year = paymentDate.getFullYear();
          
          // 根據 paymentPeriod 判斷季度
          if (payment.paymentPeriod === 'Q1') {
            paidQuarters.add(`${year}-Q1`);
          } else if (payment.paymentPeriod === 'Q2') {
            paidQuarters.add(`${year}-Q2`);
          } else if (payment.paymentPeriod === 'Q3') {
            paidQuarters.add(`${year}-Q3`);
          } else if (payment.paymentPeriod === 'Q4') {
            paidQuarters.add(`${year}-Q4`);
          }
        });
        
        // 獲取當前年份和季度
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        let currentQuarter = 1;
        if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = 2;
        else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = 3;
        else if (currentMonth >= 10 && currentMonth <= 12) currentQuarter = 4;
        
        // 從當前季度開始查找未繳費的季度
        for (let q = currentQuarter; q <= 4; q++) {
          const quarterKey = `${currentYear}-Q${q}`;
          if (!paidQuarters.has(quarterKey)) {
            return {
              year: currentYear,
              quarter: q,
              quarterName: `${q === 1 ? '1-3' : q === 2 ? '4-6' : q === 3 ? '7-9' : '10-12'}月`,
            };
          }
        }
        
        // 如果當前年份全部已繳,返回下一年的第一季
        return {
          year: currentYear + 1,
          quarter: 1,
          quarterName: '1-3月',
        };
      }),

    // 批量查詢所有學生的下一個未繳季度
    getAllNextUnpaidQuarters: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }
        
        // 一次查詢所有繳費記錄
        const allPayments = await db.select()
          .from(schema.paymentRecords);
        
        // 按學生分組
        const paymentsByStudent = new Map<number, typeof allPayments>();
        allPayments.forEach((payment: any) => {
          const list = paymentsByStudent.get(payment.studentId) || [];
          list.push(payment);
          paymentsByStudent.set(payment.studentId, list);
        });
        
        // 獲取當前年份和季度
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        let currentQuarter = 1;
        if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = 2;
        else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = 3;
        else if (currentMonth >= 10 && currentMonth <= 12) currentQuarter = 4;
        
        // 獲取所有學生
        const allStudents = await db.select({ id: schema.students.id }).from(schema.students);
        
        // 為每個學生計算下一個未繳季度
        const result: Record<number, { year: number; quarter: number; quarterName: string } | null> = {};
        
        for (const student of allStudents) {
          const payments = paymentsByStudent.get(student.id) || [];
          const paidQuarters = new Set<string>();
          payments.forEach((payment: any) => {
            const paymentDate = new Date(payment.paymentDate);
            const year = paymentDate.getFullYear();
            if (payment.paymentPeriod === 'Q1') paidQuarters.add(`${year}-Q1`);
            else if (payment.paymentPeriod === 'Q2') paidQuarters.add(`${year}-Q2`);
            else if (payment.paymentPeriod === 'Q3') paidQuarters.add(`${year}-Q3`);
            else if (payment.paymentPeriod === 'Q4') paidQuarters.add(`${year}-Q4`);
          });
          
          let found = false;
          for (let q = currentQuarter; q <= 4; q++) {
            const quarterKey = `${currentYear}-Q${q}`;
            if (!paidQuarters.has(quarterKey)) {
              result[student.id] = {
                year: currentYear,
                quarter: q,
                quarterName: `${q === 1 ? '1-3' : q === 2 ? '4-6' : q === 3 ? '7-9' : '10-12'}月`,
              };
              found = true;
              break;
            }
          }
          if (!found) {
            result[student.id] = {
              year: currentYear + 1,
              quarter: 1,
              quarterName: '1-3月',
            };
          }
        }
        
        return result;
      }),
    
    importFromExcel: protectedProcedure
      .input(z.object({
        students: z.array(z.object({
          name: z.string(),
          birthDate: z.string().nullable().optional(),
          phone: z.string(),
          venue: z.string(),
          scheduleDay: z.string().optional(),
          scheduleTime: z.string().optional(),
          feePerQuarter: z.string(),
          beltLevel: z.string().optional(),
          coach: z.string().optional(),
        }))
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const studentsToInsert = input.students.map(s => ({
          name: s.name,
          birthDate: s.birthDate ? new Date(s.birthDate) : null,
          phone: s.phone,
          venue: s.venue,
          scheduleDay: s.scheduleDay || null,
          scheduleTime: s.scheduleTime || null,
          feePerQuarter: s.feePerQuarter,
          beltLevel: s.beltLevel || null,
          coach: s.coach || '賴政堡教練',
        }));
        
        await bulkInsertStudents(studentsToInsert);
        
        // === 自動同步：偵測新道場、建立道場、生成訓練日程 ===
        const existingDojos = await getAllDojos();
        const existingDojoNames = new Set(existingDojos.map(d => d.name));
        
        // 收集所有唯一的 venue + scheduleDay + scheduleTime + coach 組合
        const classGroupMap = new Map<string, { venue: string; scheduleDay: string; scheduleTime: string; coach: string }>();
        input.students.forEach(s => {
          if (s.venue && s.scheduleDay && s.scheduleTime) {
            const key = `${s.venue}|${s.scheduleDay}|${s.scheduleTime}`;
            if (!classGroupMap.has(key)) {
              classGroupMap.set(key, {
                venue: s.venue,
                scheduleDay: s.scheduleDay,
                scheduleTime: s.scheduleTime,
                coach: s.coach || '賴政堡教練',
              });
            }
          }
        });
        
        const newDojoNames: string[] = [];
        let schedulesGenerated = 0;
        
        // 1. 為新道場建立 dojos 記錄，更新現有道場的教練名稱
        const newVenueCoachMap = new Map<string, string>(); // venue -> coach
        for (const group of classGroupMap.values()) {
          if (!existingDojoNames.has(group.venue)) {
            newVenueCoachMap.set(group.venue, group.coach);
          }
        }
        
        for (const [venueName, coachName] of newVenueCoachMap) {
          try {
            await insertDojo({
              name: venueName,
              coachName: coachName,
              status: 'active',
            });
            existingDojoNames.add(venueName);
            newDojoNames.push(venueName);
            console.log(`[importFromExcel] 自動建立新道場: ${venueName} (教練: ${coachName})`);
          } catch (e) {
            console.error(`[importFromExcel] 建立道場失敗: ${venueName}`, e);
          }
        }
        
        // 更新現有道場的教練名稱（如果匯入資料中教練不同）
        for (const group of classGroupMap.values()) {
          const existingDojo = existingDojos.find(d => d.name === group.venue);
          if (existingDojo && existingDojo.coachName !== group.coach) {
            try {
              await updateDojo(existingDojo.id, { coachName: group.coach });
              console.log(`[importFromExcel] 更新道場教練: ${group.venue} → ${group.coach}`);
            } catch (e) {
              console.error(`[importFromExcel] 更新道場教練失敗: ${group.venue}`, e);
            }
          }
        }
        
        // 2. 為所有班別組合生成當前月份及剩餘月份的訓練日程
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        for (const group of classGroupMap.values()) {
          // 生成當前月份到 12 月的訓練日程
          for (let m = currentMonth; m <= 12; m++) {
            try {
              const schedules = await generateTrainingSchedules(
                currentYear, m, group.venue, group.scheduleDay, group.scheduleTime
              );
              schedulesGenerated += schedules.length;
            } catch (e) {
              // 已存在的日程會直接跳過，所以這裡不需要額外處理
              console.error(`[importFromExcel] 生成日程失敗: ${group.venue} ${group.scheduleDay} ${group.scheduleTime} ${currentYear}/${m}`, e);
            }
          }
        }
        
        console.log(`[importFromExcel] 匯入完成: ${input.students.length} 學生, ${newDojoNames.length} 新道場, ${schedulesGenerated} 訓練日程`);
        
        return { 
          success: true, 
          count: studentsToInsert.length,
          newDojos: newDojoNames,
          schedulesGenerated,
        };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        birthDate: z.string().nullable().optional(),
        phone: z.string().optional(),
        venue: z.string().optional(),
        scheduleDay: z.string().optional(),
        scheduleTime: z.string().optional(),
        feePerQuarter: z.string().optional(),
        beltLevel: z.string().optional(),
        coach: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const { id, ...data } = input;
        const updateData: Partial<InsertStudent> = {};
        
        if (data.name !== undefined) updateData.name = data.name;
        if (data.birthDate !== undefined) {
          // birthDate 現在是 date 類型,直接傳入日期字串 (YYYY-MM-DD)
          updateData.birthDate = (data.birthDate ? data.birthDate : null) as any;
        }
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.venue !== undefined) updateData.venue = data.venue;
        if (data.scheduleDay !== undefined) updateData.scheduleDay = data.scheduleDay;
        if (data.scheduleTime !== undefined) updateData.scheduleTime = data.scheduleTime;
        if (data.feePerQuarter !== undefined) updateData.feePerQuarter = data.feePerQuarter as any;
        if (data.beltLevel !== undefined) updateData.beltLevel = data.beltLevel;
        if (data.coach !== undefined) updateData.coach = data.coach;
        if (data.status !== undefined) updateData.status = data.status;
        
        await updateStudent(id, updateData);
        return { success: true };
      }),

    // 行內更新學生負責教練
    updateCoach: protectedProcedure
      .input(z.object({
        id: z.number(),
        coach: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await updateStudent(input.id, { coach: input.coach } as any);
        return { success: true };
      }),
    
    // 管理員重置學生密碼（重置為電話號碼）
    resetPassword: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }
        
        // 取得學生資料
        const student = await getStudentById(input.studentId);
        if (!student) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該學生' });
        }
        
        if (!student.phone) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '該學生沒有電話號碼，無法重置密碼' });
        }
        
        // 將密碼重置為電話號碼的 bcrypt hash
        const hashedPassword = await hashPassword(student.phone);
        await db.update(schema.students)
          .set({ password: hashedPassword })
          .where(eq(schema.students.id, input.studentId));
        
        return { success: true, message: `已將 ${student.name} 的密碼重置為電話號碼` };
      }),

    // 獲取精英班學生的剩餘堂數
    getEliteClassBalance: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getEliteClassBalance(input.studentId);
      }),
    
    // 獲取所有精英班學生的剩餘堂數
    getAllEliteClassBalances: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllEliteClassBalances();
      }),
    
    // 批量發送精英班繳費提醒
    sendElitePaymentReminders: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        // 獲取所有剩餘堂數 ≤ 3 的學生
        const balances = await getAllEliteClassBalances();
        const needReminder = balances.filter(b => (b.remainingClasses ?? 0) <= 3);
        
        if (needReminder.length === 0) {
          return { success: true, sent: 0, message: '沒有需要提醒的學生' };
        }
        
        // 獲取學生詳細資料
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }
        
        const studentIds = needReminder.map(b => b.studentId);
        const allStudents = await db.select().from(schema.students);
        const students = allStudents.filter(s => studentIds.includes(s.id));        
        // 為每位學生生成提醒訊息
        const messages = needReminder.map(balance => {
          const student = students.find(s => s.id === balance.studentId);
          if (!student) return null;
          
          const remaining = balance.remainingClasses ?? 0;
          let statusText = '';
          if (remaining < 0) {
            statusText = `已超用 ${Math.abs(remaining)} 堂`;
          } else if (remaining === 0) {
            statusText = '堂數已用完';
          } else {
            statusText = '即將用完';
          }
          
          return {
            phone: student.phone,
            message: `【精英班繳費提醒】\n\n${student.name} 家長您好:\n\n您的孩子在精英班的剩餘堂數為 ${remaining} 堂，${statusText}。\n\n已繳堂數: ${balance.paidClasses} 堂\n已上堂數: ${balance.attendedClasses} 堂\n剩餘堂數: ${remaining} 堂\n\n請及時繳費以確保孩子能繼續上課。\n繳費金額: $2,400 (12堂)\n\n如有疑問，請聯絡教練。`
          };
        }).filter(m => m !== null);
        
        // 實際發送 WhatsApp 訊息
        const { sendBatchWhatsAppMessages } = await import('./_core/whatsapp');
        const sendResult = await sendBatchWhatsAppMessages(
          messages.map(m => ({ to: m!.phone, message: m!.message }))
        );
        
        return { 
          success: true, 
          sent: sendResult.successful,
          failed: sendResult.failed,
          message: `已發送 ${sendResult.successful} 則提醒訊息${sendResult.failed > 0 ? `，${sendResult.failed} 則發送失敗` : ''}`
        };
      }),
  }),

  dojos: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllDojos();
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        status: z.enum(["active", "inactive"]).default("active"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await insertDojo(input);
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateDojo(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteDojo(input.id);
        return { success: true };
      }),
  }),

  coaches: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllCoaches();
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        beltLevelId: z.number().optional(),
        baseSalary: z.number().default(0),
        status: z.enum(["active", "inactive"]).default("active"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await insertCoach(input);
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        beltLevelId: z.number().optional(),
        baseSalary: z.number().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateCoach(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteCoach(input.id);
        return { success: true };
      }),
  }),

  beltLevels: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllBeltLevels();
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        color: z.string(),
        order: z.number(),
        minimumTrainingDays: z.number().default(90),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await insertBeltLevel(input);
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
        minimumTrainingDays: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateBeltLevel(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteBeltLevel(input.id);
        return { success: true };
      }),
  }),

  payments: router({
    getByStudentIds: publicProcedure
      .input(z.object({ studentIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return getPaymentRecordsByStudentIds(input.studentIds);
      }),
    
    create: publicProcedure
      .input(z.object({
        studentId: z.number(),
        paymentPeriod: z.enum(["Q1", "Q2", "Q3", "Q4", "CUSTOM"]),
        customMonths: z.array(z.string()).optional(),
        amount: z.string(),
        classCount: z.number().optional(), // 精英班堂數(固定12堂)
        receiptBase64: z.string(),
        receiptMimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Upload receipt to S3
        const receiptBuffer = Buffer.from(input.receiptBase64, 'base64');
        const fileExt = input.receiptMimeType.split('/')[1] || 'jpg';
        const receiptKey = `receipts/${input.studentId}-${Date.now()}.${fileExt}`;
        const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, input.receiptMimeType);
        
        // OCR to extract amount, bank, transfer status, and transfer date/time from receipt
        let extractedAmount = input.amount;
        let receiptTransferDate: Date | null = null;
        let extractedBank: string | null = null;
        let extractedStatus: string | null = null;
        let extractedDateTime: string | null = null;
        let extractedRecipientName: string | null = null;
        let extractedRecipientAccount: string | null = null;
        
        // 方案1：本地 Tesseract OCR（不需要 API Key，優先使用）
        try {
          console.log("[OCR] 使用本地 Tesseract OCR...");
          const localResult = await ocrReceipt(input.receiptBase64, input.receiptMimeType);
          
          if (localResult.amount) {
            extractedAmount = localResult.amount;
            console.log("[OCR] 本地識別金額:", extractedAmount);
          }
          if (localResult.bank) {
            extractedBank = localResult.bank;
          }
          if (localResult.status) {
            extractedStatus = localResult.status;
          }
          if (localResult.recipientName) {
            extractedRecipientName = localResult.recipientName;
            console.log("[OCR] 識別收款人:", extractedRecipientName);
          }
          if (localResult.recipientAccount) {
            extractedRecipientAccount = localResult.recipientAccount;
            console.log("[OCR] 識別收款帳號:", extractedRecipientAccount);
          }
          if (localResult.date) {
            const dateStr = localResult.time ? `${localResult.date}T${localResult.time}` : localResult.date;
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              receiptTransferDate = parsedDate;
            }
            extractedDateTime = localResult.time ? `${localResult.date} ${localResult.time}` : localResult.date;
          }
        } catch (localErr) {
          console.warn("[OCR] 本地 Tesseract 識別失敗:", localErr instanceof Error ? localErr.message : String(localErr));
        }
        
        // 方案2：如果本地 OCR 未識別到金額，嘗試 LLM（需要 API Key）
        if (!extractedAmount || extractedAmount === "0" || extractedAmount === input.amount) {
          try {
            console.log("[OCR] 本地未識別到金額，嘗試 LLM...");
            const ocrResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: "你是一個銀行轉帳收據識別助手，能識別中文和英文收據。請從收據/截圖中提取以下資訊並以純JSON格式回傳（不要加markdown標記）:\n{\n  \"amount\": \"轉帳金額，純數字字串如 1800.00，注意 HKD/HK$/$ 等貨幣符號後的數字\",\n  \"bank\": \"銀行名稱，如匯豐銀行/HSBC/恒生銀行/PayMe/FPS轉數快等，優先提取付款方銀行\",\n  \"status\": \"轉帳狀態：成功/已完成/處理中/失敗\",\n  \"date\": \"轉帳日期 YYYY-MM-DD 格式\",\n  \"time\": \"轉帳時間 HH:mm:ss 或 HH:mm 格式（24小時制）\",\n  \"recipientName\": \"收款人名稱，例如 CHONG MO COMPANY LIMITED\",\n  \"recipientAccount\": \"收款人帳號/FPS識別碼，純數字\"\n}\n如果某個欄位無法識別，該欄位回傳 null。只回傳JSON，不要其他文字。"
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "請識別這張轉帳收據/截圖的金額、銀行名稱、轉帳是否成功、以及轉帳日期和時間:"
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${input.receiptMimeType};base64,${input.receiptBase64}`,
                        detail: "high"
                      }
                    }
                  ]
                }
              ],
            });
            
            const content = ocrResponse.choices[0]?.message?.content;
            if (typeof content === 'string') {
              const cleanJson = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
              console.log('[OCR] LLM 識別結果:', cleanJson);
              const ocrData = JSON.parse(cleanJson);
              
              if (ocrData.amount) {
                const parsedAmount = parseFloat(ocrData.amount.replace(/[^0-9.]/g, ''));
                if (!isNaN(parsedAmount) && parsedAmount > 0) {
                  extractedAmount = parsedAmount.toString();
                }
              }
              if (ocrData.bank) extractedBank = ocrData.bank;
              if (ocrData.status) extractedStatus = ocrData.status;
              if (ocrData.recipientName && !extractedRecipientName) extractedRecipientName = ocrData.recipientName;
              if (ocrData.recipientAccount && !extractedRecipientAccount) extractedRecipientAccount = ocrData.recipientAccount.replace(/[^0-9]/g, '');
              if (ocrData.date) {
                const dateStr = ocrData.time ? `${ocrData.date}T${ocrData.time}` : ocrData.date;
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                  receiptTransferDate = parsedDate;
                }
                extractedDateTime = ocrData.time ? `${ocrData.date} ${ocrData.time}` : ocrData.date;
              }
            }
          } catch (llmErr) {
            const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
            if (errMsg.includes('OPENAI_API_KEY')) {
              console.warn("[OCR] LLM API Key 未配置，使用本地 OCR 結果。");
            } else {
              console.error("[OCR] LLM 識別失敗:", errMsg);
            }
          }
        }
        
        // 獲取學生的學費金額以驗證 OCR 識別結果
        const student = await getStudentById(input.studentId);
        if (!student) {
          throw new Error("學生不存在");
        }
        
        // 在收據上蓋上學生資訊標記（姓名、金額、繳交月份）
        let stampedReceiptUrl = receiptUrl;
        let stampedReceiptKey = receiptKey;
        try {
          console.log("[ReceiptStamp] 正在為收據加上標記...");
          const stampedBuffer = await stampReceipt(receiptBuffer, input.receiptMimeType, {
            studentName: student.name,
            amount: extractedAmount || input.amount,
            paymentPeriod: input.paymentPeriod,
            customMonths: input.customMonths,
            dojoName: student.venue || undefined,
          });
          // 儲存加標記的收據（用不同的 key，保留原始收據）
          const stampedKey = `receipts/stamped-${input.studentId}-${Date.now()}.${fileExt}`;
          const stampResult = await storagePut(stampedKey, stampedBuffer, input.receiptMimeType);
          stampedReceiptUrl = stampResult.url;
          stampedReceiptKey = stampedKey;
          console.log("[ReceiptStamp] 收據標記完成:", stampedKey);
        } catch (stampErr) {
          console.warn("[ReceiptStamp] 收據標記失敗，使用原始收據:", stampErr instanceof Error ? stampErr.message : String(stampErr));
          // 失敗時使用原始收據，不影響繳費流程
        }
        
        // 驗證 OCR 識別的金額是否與學費完全相等
        const parsedAmount = parseFloat(extractedAmount);
        const expectedAmount = parseFloat(student.feePerQuarter);
        const isAmountValid = parsedAmount === expectedAmount;
        
        // 驗證收款人是否為道場的帳號（防止家長轉帳給自己）
        let isRecipientValid = false;
        let recipientCheckNote = '';
        try {
          const validationEnabled = await getSystemConfig('receipt_validation_enabled');
          if (validationEnabled === 'true') {
            const acceptedAccounts = await getAcceptedPayeeAccounts();
            
            if (acceptedAccounts.length === 0) {
              // 沒有設定收款帳號，跳過驗證
              isRecipientValid = true;
              recipientCheckNote = '未設定收款帳號，跳過收款人驗證';
              console.log("[Receipt] 未設定接受的收款帳號，跳過收款人驗證");
            } else {
              // 比對收款人帳號
              const cleanedExtractedAccount = (extractedRecipientAccount || '').replace(/[^0-9]/g, '');
              const cleanedExtractedName = (extractedRecipientName || '').toUpperCase().trim();
              
              for (const accepted of acceptedAccounts) {
                const cleanedAcceptedAccount = accepted.account.replace(/[^0-9]/g, '');
                const cleanedAcceptedName = accepted.name.toUpperCase().trim();
                
                // 帳號比對（包含關係：收據帳號包含設定帳號，或設定帳號包含收據帳號）
                const accountMatch = cleanedExtractedAccount && cleanedAcceptedAccount && 
                  (cleanedExtractedAccount.includes(cleanedAcceptedAccount) || cleanedAcceptedAccount.includes(cleanedExtractedAccount));
                
                // 名稱比對（包含關係：收據名稱包含設定名稱，或設定名稱包含收據名稱）
                const nameMatch = cleanedExtractedName && cleanedAcceptedName &&
                  (cleanedExtractedName.includes(cleanedAcceptedName) || cleanedAcceptedName.includes(cleanedExtractedName));
                
                if (accountMatch || nameMatch) {
                  isRecipientValid = true;
                  console.log(`[Receipt] 收款人驗證通過: 帳號=${cleanedExtractedAccount}, 名稱=${cleanedExtractedName}, 匹配=${accepted.name}`);
                  break;
                }
              }
              
              if (!isRecipientValid) {
                recipientCheckNote = `收款人不匹配: 名稱=${extractedRecipientName || '未識別'}, 帳號=${extractedRecipientAccount || '未識別'}`;
                console.warn(`[Receipt] 收款人驗證失敗! ${recipientCheckNote}。接受的帳號: ${acceptedAccounts.map(a => `${a.name}(${a.account})`).join(', ')}`);
              }
            }
          } else {
            // 驗證功能未啟用
            isRecipientValid = true;
          }
        } catch (configErr) {
          console.warn("[Receipt] 收款人驗證配置讀取失敗，跳過驗證:", configErr);
          isRecipientValid = true;
        }
        
        // 只有金額正確 且 收款人正確 才設為 confirmed，否則設為 pending 需要人工審核
        let pendingReason = '';
        if (!isAmountValid) {
          pendingReason += `金額不符(識別=${parsedAmount}, 預期=${expectedAmount})`;
        }
        if (!isRecipientValid) {
          if (pendingReason) pendingReason += '; ';
          pendingReason += recipientCheckNote;
        }
        const recordStatus = (isAmountValid && isRecipientValid) ? "confirmed" : "pending";
        if (recordStatus === 'pending' && pendingReason) {
          console.log(`[Receipt] 設為待審核: ${pendingReason}`);
        }
        
        await insertPaymentRecord({
          studentId: input.studentId,
          paymentPeriod: input.paymentPeriod,
          customMonths: input.customMonths || null,
          amount: extractedAmount,
          classCount: input.classCount || null, // 精英班堂數
          receiptUrl: stampedReceiptUrl,
          receiptKey: stampedReceiptKey,
          receiptTransferDate,
          paymentDate: new Date(),
          status: recordStatus,
          confirmedBy: 'parent_upload',
        });
        
        // 自動同步到會計記錄（確認的繳費才同步）
        if (recordStatus === 'confirmed') {
          try {
            // 取得剛插入的 payment record ID
            const db = await getDb();
            if (db) {
              const latestPayments = await db.select().from(schema.paymentRecords)
                .where(and(
                  eq(schema.paymentRecords.studentId, input.studentId),
                  eq(schema.paymentRecords.status, 'confirmed')
                ))
                .orderBy(desc(schema.paymentRecords.id))
                .limit(1);
              if (latestPayments.length > 0) {
                await syncPaymentToAccounting({
                  paymentRecordId: latestPayments[0].id,
                  transactionDate: receiptTransferDate || new Date(),
                  amount: extractedAmount,
                  bank: extractedBank,
                  studentName: student.name,
                  coachName: student.coach,
                  dojoName: student.venue || null,
                  category: 'tuition',
                  receiptUrl: stampedReceiptUrl,
                  receiptKey: stampedReceiptKey,
                });
              }
            }
          } catch (e) {
            console.error("Auto sync to accounting failed:", e);
          }
        }
        
        return { 
          success: true,
          extractedAmount,
          extractedBank,
          extractedStatus,
          extractedDateTime,
          extractedRecipientName,
          extractedRecipientAccount,
          recipientValid: isRecipientValid,
          pendingReason: pendingReason || undefined,
          status: recordStatus,
        };
      }),
    
    markAsPaid: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        year: z.number(),
        month: z.number(),
        amount: z.string(),
        classCount: z.number().optional(), // 精英班堂數
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        // 創建繳費記錄,不需要收據圖片
        await insertPaymentRecord({
          studentId: input.studentId,
          paymentPeriod: "CUSTOM",
          customMonths: [`${input.year}-${String(input.month).padStart(2, '0')}`],
          amount: input.amount,
          classCount: input.classCount || null, // 精英班堂數
          receiptUrl: null,
          receiptKey: null,
          receiptTransferDate: null,
          paymentDate: new Date(),
          status: "confirmed", // 管理員手動標記,直接設為 confirmed
          confirmedBy: 'admin_approved',
        });

        // 自動同步到會計記錄
        try {
          const student = await getStudentById(input.studentId);
          if (student) {
            const db = await getDb();
            if (db) {
              const latestPayments = await db.select().from(schema.paymentRecords)
                .where(and(
                  eq(schema.paymentRecords.studentId, input.studentId),
                  eq(schema.paymentRecords.status, 'confirmed')
                ))
                .orderBy(desc(schema.paymentRecords.id))
                .limit(1);
              if (latestPayments.length > 0) {
                await syncPaymentToAccounting({
                  paymentRecordId: latestPayments[0].id,
                  transactionDate: new Date(),
                  amount: input.amount,
                  studentName: student.name,
                  coachName: student.coach,
                  category: 'tuition',
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto sync to accounting failed:", e);
        }
        
        return { success: true };
      }),

    
    getAllWithStudents: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getStudentsWithPayments();
      }),
    
    getQuarterlyStatuses: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const all = await getQuarterlyPaymentStatuses(input?.year);
        // 教練只返回自己學生的繳費狀態
        // @ts-ignore
        if (ctx.user.role === 'coach' && ctx.user.coachName) {
          // @ts-ignore
          return all.filter(s => s.coach === ctx.user.coachName);
        }
        return all;
      }),

    // 月份繳費狀態（新版：以月份顯示）
    getMonthlyStatuses: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const all = await getMonthlyPaymentStatuses(input?.year);
        // 教練只返回自己學生的繳費狀態
        // @ts-ignore
        if (ctx.user.role === 'coach' && ctx.user.coachName) {
          // @ts-ignore
          return all.filter(s => s.coach === ctx.user.coachName);
        }
        return all;
      }),

    // 家長查詢自己孩子的月份繳費狀態
    getParentMonthlyStatuses: publicProcedure
      .input(z.object({
        phone: z.string(),
        year: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const all = await getMonthlyPaymentStatuses(input.year);
        return all.filter(s => s.phone === input.phone);
      }),

    // 管理員批准待審核的家長上傳收據
    approvePendingPayment: protectedProcedure
      .input(z.object({
        paymentRecordId: z.number(),
        adminPassword: z.string().min(1, '請輸入管理員密碼'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以批准繳費' });
        }

        // 驗證管理員密碼
        // @ts-ignore - password 欄位已在資料庫中加入
        const userPassword = ctx.user.password;
        if (!userPassword) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '管理員帳號尚未設定密碼' });
        }
        const isPasswordValid = await verifyPassword(input.adminPassword, userPassword);
        if (!isPasswordValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '密碼錯誤，無法批准繳費' });
        }

        await approvePaymentRecord(input.paymentRecordId, 'admin_approved');

        // 批准後自動同步到會計記錄
        try {
          const paymentRecord = await getPaymentRecordById(input.paymentRecordId);
          if (paymentRecord) {
            const student = await getStudentById(paymentRecord.studentId);
            if (student) {
              // 方案 B：同一張收據拆分的多筆記錄，只入帳一次（用實際轉帳金額）
              // 檢查是否有同收據的其他記錄已經入了會計帳
              let shouldSync = true;
              let syncAmount = paymentRecord.amount;

              if (paymentRecord.receiptKey) {
                const db = await getDb();
                if (db) {
                  // 找同學生、同收據的所有記錄
                  const siblingRecords = await db.select().from(schema.paymentRecords)
                    .where(and(
                      eq(schema.paymentRecords.studentId, paymentRecord.studentId),
                      eq(schema.paymentRecords.receiptKey, paymentRecord.receiptKey)
                    ));

                  if (siblingRecords.length > 1) {
                    // 這是拆分記錄，檢查是否已有兄弟記錄入了會計帳
                    for (const sibling of siblingRecords) {
                      if (sibling.id !== input.paymentRecordId) {
                        const existingAccounting = await getAccountingRecordByPaymentId(sibling.id);
                        if (existingAccounting) {
                          // 兄弟記錄已入帳，跳過本次同步（方案 B：一張收據只入帳一次）
                          shouldSync = false;
                          break;
                        }
                      }
                    }

                    if (shouldSync) {
                      // 用所有拆分記錄的金額總和（= 實際轉帳金額）
                      const totalAmount = siblingRecords.reduce((sum, r) => sum + parseFloat(r.amount), 0);
                      syncAmount = totalAmount.toFixed(2);
                    }
                  }
                }
              }

              if (shouldSync) {
                await syncPaymentToAccounting({
                  paymentRecordId: input.paymentRecordId,
                  transactionDate: paymentRecord.receiptTransferDate || paymentRecord.paymentDate,
                  amount: syncAmount,
                  bank: null,
                  studentName: student.name,
                  coachName: student.coach,
                  dojoName: student.venue || null,
                  category: 'tuition',
                  receiptUrl: paymentRecord.receiptUrl,
                  receiptKey: paymentRecord.receiptKey,
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto sync to accounting after approval failed:", e);
        }

        return { success: true };
      }),

    // 教練/管理員確認繳費（不需要收據圖片）
    confirmPayment: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        year: z.number(),
        quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
      }))
      .mutation(async ({ input, ctx }) => {
        // 只有管理員可以確認繳費
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以確認繳費' });
        }
        // 獲取學生的學費金額
        const student = await getStudentById(input.studentId);
        if (!student) throw new TRPCError({ code: 'NOT_FOUND', message: '學生不存在' });

        await insertPaymentRecord({
          studentId: input.studentId,
          year: input.year,
          paymentPeriod: input.quarter,
          customMonths: null,
          amount: student.feePerQuarter,
          classCount: null,
          receiptUrl: null,
          receiptKey: null,
          receiptTransferDate: null,
          paymentDate: new Date(),
          status: 'confirmed',
          confirmedBy: 'admin_approved',
        });

        // 自動同步到會計記錄 → 日記帳
        try {
          const db = await getDb();
          if (db) {
            const latestPayments = await db.select().from(schema.paymentRecords)
              .where(and(
                eq(schema.paymentRecords.studentId, input.studentId),
                eq(schema.paymentRecords.status, 'confirmed' as any)
              ))
              .orderBy(desc(schema.paymentRecords.id))
              .limit(1);
            if (latestPayments.length > 0) {
              await syncPaymentToAccounting({
                paymentRecordId: latestPayments[0].id,
                transactionDate: new Date(),
                amount: student.feePerQuarter,
                studentName: student.name,
                coachName: student.coach,
                dojoName: student.venue || null,
                category: 'tuition',
              });
            }
          }
        } catch (e) {
          console.error("Auto sync to accounting after confirmPayment failed:", e);
        }

        return { success: true };
      }),

    // 管理員確認月份繳費（支援1月或1季繳交）
    confirmMonthlyPayment: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        year: z.number(),
        months: z.array(z.number().min(1).max(12)).min(1), // 可以1個月或3個月（1季）
        paymentType: z.enum(['monthly', 'quarterly']), // monthly=單月, quarterly=季繳
      }))
      .mutation(async ({ input, ctx }) => {
        // 只有管理員可以確認繳費
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以確認繳費' });
        }
        const student = await getStudentById(input.studentId);
        if (!student) throw new TRPCError({ code: 'NOT_FOUND', message: '學生不存在' });

        const feePerQuarter = parseFloat(student.feePerQuarter);
        const confirmedBy = 'admin_approved';

        if (input.paymentType === 'quarterly') {
          // 季繳：找出對應的季度
          const sortedMonths = [...input.months].sort((a, b) => a - b);
          const firstMonth = sortedMonths[0];
          let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
          if (firstMonth <= 3) quarter = 'Q1';
          else if (firstMonth <= 6) quarter = 'Q2';
          else if (firstMonth <= 9) quarter = 'Q3';
          else quarter = 'Q4';
          
          await insertPaymentRecord({
            studentId: input.studentId,
            year: input.year,
            paymentPeriod: quarter,
            customMonths: null,
            paymentMonth: null,
            amount: String(feePerQuarter),
            classCount: null,
            receiptUrl: null,
            receiptKey: null,
            receiptTransferDate: null,
            paymentDate: new Date(),
            status: 'confirmed',
            confirmedBy,
          });

          // 自動同步季繳到會計記錄 → 日記帳
          try {
            const db = await getDb();
            if (db) {
              const latestPayments = await db.select().from(schema.paymentRecords)
                .where(and(
                  eq(schema.paymentRecords.studentId, input.studentId),
                  eq(schema.paymentRecords.status, 'confirmed' as any)
                ))
                .orderBy(desc(schema.paymentRecords.id))
                .limit(1);
              if (latestPayments.length > 0) {
                await syncPaymentToAccounting({
                  paymentRecordId: latestPayments[0].id,
                  transactionDate: new Date(),
                  amount: String(feePerQuarter),
                  studentName: student.name,
                  coachName: student.coach,
                  dojoName: student.venue || null,
                  category: 'tuition',
                });
              }
            }
          } catch (e) {
            console.error("Auto sync to accounting after quarterly confirmMonthlyPayment failed:", e);
          }
        } else {
          // 單月繳費：為每個月建立一筆記錄
          const monthlyFee = Math.round((feePerQuarter / 3) * 100) / 100;
          for (const month of input.months) {
            await insertPaymentRecord({
              studentId: input.studentId,
              year: input.year,
              paymentPeriod: 'MONTHLY',
              customMonths: null,
              paymentMonth: month,
              amount: String(monthlyFee),
              classCount: null,
              receiptUrl: null,
              receiptKey: null,
              receiptTransferDate: null,
              paymentDate: new Date(),
              status: 'confirmed',
              confirmedBy,
            });

            // 自動同步每筆月繳到會計記錄 → 日記帳
            try {
              const db = await getDb();
              if (db) {
                const latestPayments = await db.select().from(schema.paymentRecords)
                  .where(and(
                    eq(schema.paymentRecords.studentId, input.studentId),
                    eq(schema.paymentRecords.status, 'confirmed' as any)
                  ))
                  .orderBy(desc(schema.paymentRecords.id))
                  .limit(1);
                if (latestPayments.length > 0) {
                  await syncPaymentToAccounting({
                    paymentRecordId: latestPayments[0].id,
                    transactionDate: new Date(),
                    amount: String(monthlyFee),
                    studentName: student.name,
                    coachName: student.coach,
                    dojoName: student.venue || null,
                    category: 'tuition',
                  });
                }
              }
            } catch (e) {
              console.error("Auto sync to accounting after monthly confirmMonthlyPayment failed:", e);
            }
          }
        }
        return { success: true };
      }),

    // 撤銷繳費：將已繳轉為未繳（刪除指定月份的繳費記錄）
    revertPayment: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
        adminPassword: z.string().min(1, '請輸入管理員密碼'),
      }))
      .mutation(async ({ input, ctx }) => {
        // 只有管理員可以撤銷繳費
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以撤銷繳費' });
        }

        // 驗證管理員密碼
        // @ts-ignore - password 欄位已在資料庫中加入
        const userPassword = ctx.user.password;
        if (!userPassword) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '管理員帳號尚未設定密碼' });
        }
        const isPasswordValid = await verifyPassword(input.adminPassword, userPassword);
        if (!isPasswordValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '密碼錯誤，無法撤銷繳費' });
        }

        await deletePaymentForMonth(input.studentId, input.year, input.month);
        return { success: true };
      }),
  }),

  users: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllUsers();
      }),

    getCoaches: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllCoachUsers();
      }),

    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin', 'coach']),
        coachName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // TODO: Update user by ID instead of openId
        // await updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    getStatistics: protectedProcedure
      .input(z.object({
        coachName: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        // 管理員可以查看所有教練統計
        if (ctx.user.role === 'admin') {
          return getCoachStatistics(input?.coachName);
        }
        
        // 教練只能查看自己的統計
        // @ts-ignore - coachName 欄位已在資料庫中加入
        if (ctx.user.role === 'coach' && ctx.user.coachName) {
          // @ts-ignore
          return getCoachStatistics(ctx.user.coachName);
        }
        
        throw new TRPCError({ code: 'FORBIDDEN' });
      }),

    getQuarterlyStats: protectedProcedure
      .input(z.object({
        year: z.number(),
        quarter: z.number().min(1).max(4),
        coachName: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const { year, quarter, coachName } = input;
        
        // 管理員可以查看所有教練的統計
        const quarterStr = `Q${quarter}` as 'Q1' | 'Q2' | 'Q3' | 'Q4';
        if (ctx.user.role === 'admin') {
          return getQuarterlyFeeStatistics(year, quarterStr, coachName);
        }
        
        // 教練只能查看自己的統計
        // @ts-ignore
        if (ctx.user.role === 'coach' && ctx.user.coachName) {
          // @ts-ignore
          return getQuarterlyFeeStatistics(year, quarterStr, ctx.user.coachName);
        }
        
        throw new TRPCError({ code: 'FORBIDDEN' });
      }),

    // 查詢指定季度未繳費的學生名單
    getUnpaidStudentsForQuarter: protectedProcedure
      .input(z.object({
        year: z.number(),
        quarter: z.number().min(1).max(4),
        coachName: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }
        
        const { year, quarter, coachName: inputCoachName } = input;
        const effectiveCoachName = ctx.user.role === 'coach' ? (ctx.user as any).coachName : inputCoachName;
        
        // 季度對應月份
        const quarterMonths: Record<number, number[]> = {
          1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12],
        };
        const months = quarterMonths[quarter];
        
        // 獲取所有活躍學生
        const allStudents = await db.select().from(schema.students).where(eq(schema.students.status, 'active'));
        
        // 如果指定教練，直接用學生的 coach 欄位過濾
        let filteredStudents = allStudents.filter(s => s.venue !== '精英班道場');
        if (effectiveCoachName) {
          filteredStudents = filteredStudents.filter(s => s.coach === effectiveCoachName);
        }
        
        // 獲取該年度所有已確認繳費記錄（不限 paymentPeriod）
        const allPayments = await db.select()
          .from(schema.paymentRecords)
          .where(
            and(
              eq(schema.paymentRecords.year, year),
              eq(schema.paymentRecords.status, 'confirmed' as any)
            )
          );
        
        // 建立每個學生在該季度已繳的月份集合
        const studentPaidMonths = new Map<number, Set<number>>();
        
        allPayments.forEach(p => {
          if (!studentPaidMonths.has(p.studentId)) {
            studentPaidMonths.set(p.studentId, new Set());
          }
          const paid = studentPaidMonths.get(p.studentId)!;
          
          // 季繳
          if (['Q1','Q2','Q3','Q4'].includes(p.paymentPeriod)) {
            const qm: Record<string, number[]> = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };
            qm[p.paymentPeriod]?.forEach(m => paid.add(m));
          }
          // 月繳
          else if (p.paymentPeriod === 'MONTHLY' && (p as any).paymentMonth) {
            paid.add((p as any).paymentMonth);
          }
          // 自選月份
          else if (p.paymentPeriod === 'CUSTOM' && p.customMonths) {
            const cms = typeof p.customMonths === 'string' ? JSON.parse(p.customMonths as string) : p.customMonths;
            if (Array.isArray(cms)) {
              cms.forEach((cm: string) => {
                let mn: number | null = null;
                if (cm.includes('-')) {
                  const parts = cm.split('-');
                  if (parseInt(parts[0]) === year) mn = parseInt(parts[1]);
                } else {
                  mn = parseInt(cm.replace(/[^0-9]/g, ''));
                }
                if (mn && mn >= 1 && mn <= 12) paid.add(mn);
              });
            }
          }
        });
        
        // 判斷未繳費學生：該季度 3 個月中至少有 1 個月未繳
        const paidStudentIds = new Set<number>();
        
        filteredStudents.forEach(s => {
          const paid = studentPaidMonths.get(s.id);
          if (paid) {
            const allMonthsPaid = months.every(m => paid.has(m));
            if (allMonthsPaid) paidStudentIds.add(s.id);
          }
        });
        
        // 過濾出未繳費的學生
        const unpaidStudents = filteredStudents
          .filter(s => !paidStudentIds.has(s.id))
          .map(s => ({
            id: s.id,
            name: s.name,
            phone: s.phone,
            venue: s.venue,
            feePerQuarter: s.feePerQuarter,
          }))
          .sort((a, b) => a.venue.localeCompare(b.venue, 'zh-TW'));
        
        return {
          unpaidStudents,
          totalStudents: filteredStudents.length,
          unpaidCount: unpaidStudents.length,
          paidCount: filteredStudents.length - unpaidStudents.length,
          quarterName: `${(quarter - 1) * 3 + 1}-${quarter * 3}月`,
        };
      }),

  }),

  // 點名系統
  attendance: router({  
    // 訓練日期管理
    getTrainingSchedules: protectedProcedure
      .input(z.object({
        venue: z.string().optional(),
        scheduleDay: z.string().optional(),
        scheduleTime: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        year: z.number().optional(),
        month: z.number().optional(),
        status: z.enum(['active', 'cancelled']).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const filters: {
          venue?: string;
          scheduleDay?: string;
          scheduleTime?: string;
          year?: number;
          month?: number;
          status?: 'active' | 'cancelled';
        } = {
          venue: input?.venue,
          scheduleDay: input?.scheduleDay,
          scheduleTime: input?.scheduleTime,
          status: input?.status,
        };
        // 優先使用直接傳入的 year/month 數字（避免時區問題）
        if (input?.year && input?.month) {
          filters.year = input.year;
          filters.month = input.month;
        } else if (input?.startDate) {
          // 向後兼容：從 startDate 提取 year 和 month
          filters.year = input.startDate.getFullYear();
          filters.month = input.startDate.getMonth() + 1;
        }
        return getTrainingSchedules(filters);
      }),

    addTrainingSchedule: protectedProcedure
      .input(z.object({
        trainingDate: z.date(),
        venue: z.string(),
        scheduleDay: z.string(),
        scheduleTime: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await insertTrainingSchedule({
          trainingDate: input.trainingDate,
          venue: input.venue,
          scheduleDay: input.scheduleDay,
          scheduleTime: input.scheduleTime,
          status: 'active',
          notes: input.notes,
        });
        return { success: true };
      }),

    cancelTrainingSchedule: protectedProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await updateTrainingScheduleStatus(input.id, 'cancelled');
        return { success: true };
      }),

    activateTrainingSchedule: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await updateTrainingScheduleStatus(input.id, 'active');
        return { success: true };
      }),

    generateSchedules: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        venue: z.string(),
        scheduleDay: z.string(),
        scheduleTime: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const schedules = await generateTrainingSchedules(input.year, input.month, input.venue, input.scheduleDay, input.scheduleTime);
        return { success: true, count: schedules.length };
      }),

    // 生成全年訓練日期
    generateYearlySchedules: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const totalGenerated = await generateYearlyTrainingSchedules(input.year);
        return { success: true, totalGenerated };
      }),

    // 生成單月訓練日期（為所有班別）
    generateMonthlySchedules: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const totalGenerated = await generateMonthlyTrainingSchedules(input.year, input.month);
        return { success: true, totalGenerated };
      }),

    // 班別管理
    getAllClassGroups: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllClassGroups();
      }),

    getStudentsByClass: protectedProcedure
      .input(z.object({
        venue: z.string(),
        scheduleDay: z.string(),
        scheduleTime: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getStudentsByClass(input.venue, input.scheduleDay, input.scheduleTime);
      }),

    // 出席記錄管理
    getAttendanceRecords: protectedProcedure
      .input(z.object({
        studentId: z.number().optional(),
        courseId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        year: z.number().optional(),
        month: z.number().optional(),
        status: z.enum(['present', 'absent', 'late', 'excused']).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        // 家長只能查看自己孩子的出席記錄
        if (ctx.user.role === 'user') {
          // TODO: 實作家長查詢邏輯
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // 如果傳入 year/month 數字，轉換為 startDate/endDate（在伺服器端生成，避免時區問題）
        const filters: typeof input & { startDate?: Date; endDate?: Date } = { ...input };
        if (input?.year && input?.month) {
          filters.startDate = new Date(input.year, input.month - 1, 1);
          filters.endDate = new Date(input.year, input.month, 0, 23, 59, 59);
        }
        return getAttendanceRecords(filters);
      }),

    addAttendanceRecord: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        courseId: z.number(),
        attendanceDate: z.date(),
        status: z.enum(['present', 'absent', 'late', 'excused']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await insertAttendanceRecord(input);
        return { success: true };
      }),

    updateAttendanceStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['present', 'absent', 'late', 'excused']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await updateAttendanceRecordStatus(input.id, input.status);
        return { success: true };
      }),

    bulkAddAttendance: protectedProcedure
      .input(z.object({
        records: z.array(z.object({
          studentId: z.number(),
          courseId: z.number(),
          attendanceDate: z.date(),
          status: z.enum(['present', 'absent', 'late', 'excused']),
          notes: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const count = await bulkInsertAttendanceRecords(input.records);
        return { success: true, count };
      }),

    upsertAttendance: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        attendanceDate: z.date(),
        status: z.enum(['present', 'absent', 'late', 'excused']),
        courseId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        if (!input.courseId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'courseId is required' });
        }
        await upsertAttendanceRecord(
          input.studentId,
          input.courseId,
          input.attendanceDate,
          input.status
        );
        return { success: true };
      }),

    getStudentStats: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input, ctx }) => {
        // 家長只能查看自己孩子的統計
        if (ctx.user.role === 'user') {
          // TODO: 實作家長查詢邏輯
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getStudentAttendanceStats(input.studentId);
      }),
  }),

  // 精英班統計
  eliteStatistics: router({ 
    getOverview: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getEliteClassStatistics();
      }),
  }),

  // 教練統計（含精英班）
  coachStats: router({
    getAll: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
        quarter: z.number().min(1).max(4).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'coach') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const all = await getCoachStatsWithElite(input?.year, input?.quarter);
        // 教練只返回自己的統計
        // @ts-ignore
        if (ctx.user.role === 'coach' && ctx.user.coachName) {
          // @ts-ignore
          return all.filter(s => s.coachName === ctx.user.coachName);
        }
        return all;
      }),

    // 每月財務報表（僅管理員）
    getMonthlyFinance: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以查看財務報表' });
        }
        return getMonthlyFinanceReport(input.year);
      }),
  }),

  // WhatsApp 範本管理
  whatsappTemplates: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAllWhatsappTemplates();
      }),

    getActive: publicProcedure
      .query(async () => {
        return getActiveWhatsappTemplates();
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getWhatsappTemplateById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        content: z.string().min(1),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await createWhatsappTemplate(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        content: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateWhatsappTemplate(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteWhatsappTemplate(input.id);
        return { success: true };
      }),
  }),

  // 精英班管理
  elite: router({
    // 學生管理
    getStudents: protectedProcedure.query(async () => {
      return getAllEliteStudents();
    }),
    getStudent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getEliteStudentById(input.id);
      }),
    getStudentsByPhone: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getEliteStudentsByPhone(input.phone);
      }),
    createStudent: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        beltLevel: z.string().optional(),
        coach: z.string().optional(),
        scheduleDay: z.string().optional(),
        scheduleTime: z.string().optional(),
        feePerClass: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const password = await hashPassword(input.phone);
        const id = await insertEliteStudent({ ...input, password, feePerClass: input.feePerClass || '0' });
        return { id };
      }),
    updateStudent: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        beltLevel: z.string().optional(),
        coach: z.string().optional(),
        scheduleDay: z.string().optional(),
        scheduleTime: z.string().optional(),
        feePerClass: z.string().optional(),
        status: z.enum(['active', 'inactive', 'suspended']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { id, ...data } = input;
        await updateEliteStudent(id, data);
        return { success: true };
      }),
    deleteStudent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await deleteEliteStudent(input.id);
        return { success: true };
      }),
    resetPassword: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const student = await getEliteStudentById(input.id);
        if (!student) throw new TRPCError({ code: 'NOT_FOUND' });
        const password = await hashPassword(student.phone);
        await updateEliteStudent(input.id, { password });
        return { success: true };
      }),
    // 轉班：在 A/B 班之間切換
    switchClass: protectedProcedure
      .input(z.object({ id: z.number(), targetClass: z.enum(['A', 'B']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const student = await getEliteStudentById(input.id);
        if (!student) throw new TRPCError({ code: 'NOT_FOUND' });
        const newTime = input.targetClass === 'A' ? '12:00-2:00pm' : '4:30-6:30pm';
        await updateEliteStudent(input.id, { scheduleDay: '星期日', scheduleTime: newTime });
        return { success: true, newClass: input.targetClass };
      }),

    // 訓練日期
    getSchedules: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
        month: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getEliteTrainingSchedules(input || {});
      }),
    cancelSchedule: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateEliteTrainingScheduleStatus(input.id, 'cancelled');
        return { success: true };
      }),
    activateSchedule: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateEliteTrainingScheduleStatus(input.id, 'active');
        return { success: true };
      }),
    generateSchedules: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        scheduleDay: z.string(),
        scheduleTime: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await generateEliteTrainingSchedules(input);
        return { count: result.length };
      }),
    generateYearSchedules: protectedProcedure
      .input(z.object({
        year: z.number(),
        scheduleDay: z.string(),
        scheduleTime: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        let total = 0;
        for (let month = 1; month <= 12; month++) {
          const result = await generateEliteTrainingSchedules({ ...input, month });
          total += result.length;
        }
        return { count: total };
      }),

    // 出席記錄
    getAttendance: protectedProcedure
      .input(z.object({
        scheduleId: z.number().optional(),
        studentId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getEliteAttendanceRecords(input || {});
      }),
    upsertAttendance: protectedProcedure
      .input(z.object({
        scheduleId: z.number(),
        studentId: z.number(),
        status: z.string(),
      }))
      .mutation(async ({ input }) => {
        const id = await upsertEliteAttendanceRecord(input);
        return { id };
      }),

    // 繳費記錄
    getPayments: protectedProcedure
      .input(z.object({ studentId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getElitePaymentRecords(input?.studentId);
      }),
    createPayment: protectedProcedure
      .input(z.object({
        studentId: z.number(),
        classCount: z.number().min(1),
        amount: z.string(),
        paymentDate: z.date(),
        confirmedBy: z.enum(['parent_upload', 'admin_approved']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 只有管理員可以確認精英班繳費
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以確認繳費' });
        const id = await insertElitePaymentRecord({
          ...input,
          amount: input.amount,
          confirmedBy: input.confirmedBy || 'admin_approved',
        });

        // 自動同步精英班付款到會計記錄 → 日記帳
        try {
          const eliteStudents = await getAllEliteStudents();
          const student = eliteStudents.find(s => s.id === input.studentId);
          if (student && parseFloat(input.amount) > 0) {
            await syncElitePaymentToAccounting({
              elitePaymentRecordId: id,
              transactionDate: input.paymentDate,
              amount: input.amount,
              studentName: student.name,
            });
          }
        } catch (e) {
          console.error("Auto sync elite payment to accounting failed:", e);
        }

        return { id };
      }),

    // 學生堂數餘額
    getBalance: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        return getEliteStudentBalance(input.studentId);
      }),
    getAllBalances: protectedProcedure.query(async () => {
      const students = await getAllEliteStudents();
      const balances = await Promise.all(
        students.filter(s => s.status === 'active').map(s => getEliteStudentBalance(s.id))
      );
      return balances.filter(b => b !== null);
    }),

    // 12 堂循環計算
    getCycleInfo: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        return getEliteCycleInfo(input.studentId);
      }),
    getAllCycleInfo: protectedProcedure.query(async () => {
      return getAllEliteCycleInfo();
    }),

    // 歷史出席記錄（按年份查詢）
    getHistoryByYear: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { schedules: [], attendance: [], students: [] };
        
        const startDate = new Date(Date.UTC(input.year, 0, 1));
        const endDate = new Date(Date.UTC(input.year, 11, 31, 23, 59, 59));
        const { eliteTrainingSchedules, eliteAttendanceRecords, eliteStudents } = await import('../drizzle/schema');
        const { gte, lte, and, asc, inArray } = await import('drizzle-orm');
        
        const schedules = await db.select().from(eliteTrainingSchedules)
          .where(and(
            gte(eliteTrainingSchedules.trainingDate, startDate),
            lte(eliteTrainingSchedules.trainingDate, endDate)
          ))
          .orderBy(asc(eliteTrainingSchedules.trainingDate));
        
        // 查詢這些日期的所有出席記錄
        const scheduleIds = schedules.map(s => s.id);
        let attendance: any[] = [];
        if (scheduleIds.length > 0) {
          attendance = await db.select().from(eliteAttendanceRecords)
            .where(inArray(eliteAttendanceRecords.scheduleId, scheduleIds));
        }
        
        // 查詢所有學生（含 joinDate）
        const students = await db.select().from(eliteStudents)
          .orderBy(asc(eliteStudents.id));
        
        return { schedules, attendance, students };
      }),

    // 從恆常班匹配電話號碼
    syncPhonesFromRegular: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { eliteStudents, students } = await import('../drizzle/schema');
        const { eq, and, ne, or, isNull, sql } = await import('drizzle-orm');
        // 找出沒有電話號碼的精英班學生
        const eliteNoPhone = await db.select().from(eliteStudents)
          .where(or(eq(eliteStudents.phone, ''), eq(eliteStudents.phone, '0')));
        let matched = 0;
        for (const es of eliteNoPhone) {
          // 從恆常班找同名學生
          const regularStudents = await db.select().from(students)
            .where(eq(students.name, es.name));
          const withPhone = regularStudents.find(s => s.phone && s.phone !== '' && s.phone !== '0');
          if (withPhone) {
            await db.update(eliteStudents).set({ phone: withPhone.phone }).where(eq(eliteStudents.id, es.id));
            matched++;
          }
        }
        return { matched, total: eliteNoPhone.length };
      }),

    // 批量更新電話號碼
    bulkUpdatePhones: protectedProcedure
      .input(z.object({
        updates: z.array(z.object({
          id: z.number(),
          phone: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        let updated = 0;
        for (const u of input.updates) {
          await updateEliteStudent(u.id, { phone: u.phone });
          updated++;
        }
        return { updated };
      }),

    // 取得所有有訓練記錄的年份列表
    getAvailableYears: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { eliteTrainingSchedules } = await import('../drizzle/schema');
      const { sql } = await import('drizzle-orm');
      const result = await db.select({ year: sql<number>`YEAR(training_date)` })
        .from(eliteTrainingSchedules)
        .groupBy(sql`YEAR(training_date)`)
        .orderBy(sql`YEAR(training_date)`);
      return result.map(r => r.year);
    }),
  }),

  // ===== 會計記錄 =====
  accounting: router({
    // 取得所有記錄（支援篩選）
    getAll: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
        month: z.number().min(1).max(12).optional(),
        type: z.enum(['income', 'expense']).optional(),
        category: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有管理員可以查看會計記錄' });
        }
        return getAllAccountingRecords(input);
      }),

    // 取得摘要統計
    getSummary: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getAccountingSummary(input.year, input.month);
      }),

    // 新增記錄（手動輸入開支/收入）
    create: protectedProcedure
      .input(z.object({
        transactionDate: z.date(),
        bank: z.string().optional(),
        amount: z.string(),
        type: z.enum(['income', 'expense']),
        category: z.string(),
        description: z.string().optional(),
        receiptUrl: z.string().optional(),
        receiptKey: z.string().optional(),
        studentName: z.string().optional(),
        coachName: z.string().optional(),
        dojoName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await insertAccountingRecord({
          transactionDate: input.transactionDate,
          bank: input.bank || null,
          amount: input.amount,
          type: input.type,
          category: input.category,
          description: input.description || null,
          receiptUrl: input.receiptUrl || null,
          receiptKey: input.receiptKey || null,
          paymentRecordId: null,
          elitePaymentRecordId: null,
          studentName: input.studentName || null,
          coachName: input.coachName || null,
          dojoName: input.dojoName || null,
          source: 'manual',
        });
        // Auto-generate journal entry
        try { await onAccountingRecordCreated(result.insertId); } catch (e) { console.error('Auto journal entry failed:', e); }
        return { success: true, id: result.insertId };
      }),

    // 上傳開支收據（含 OCR 自動識別）
    createWithReceipt: protectedProcedure
      .input(z.object({
        type: z.enum(['income', 'expense']),
        category: z.string(),
        description: z.string().optional(),
        receiptBase64: z.string(),
        receiptMimeType: z.string(),
        // 如果 OCR 無法識別，可以手動補充
        manualDate: z.date().optional(),
        manualAmount: z.string().optional(),
        manualBank: z.string().optional(),
        studentName: z.string().optional(),
        coachName: z.string().optional(),
        dojoName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Upload receipt to storage
        const receiptBuffer = Buffer.from(input.receiptBase64, 'base64');
        const fileExt = input.receiptMimeType.split('/')[1] || 'jpg';
        const receiptKey = `accounting-receipts/${Date.now()}.${fileExt}`;
        const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, input.receiptMimeType);

        // OCR
        let extractedAmount: string | null = null;
        let extractedBank: string | null = null;
        let extractedDate: Date | null = null;
        let extractedDateTime: string | null = null;

        try {
          const ocrResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "你是一個銀行轉帳收據識別助手，能識別中文和英文收據。請從收據/截圖中提取以下資訊並以純JSON格式回傳（不要加markdown標記）:\n{\n  \"amount\": \"轉帳金額，純數字字串如 1800.00\",\n  \"bank\": \"銀行名稱\",\n  \"status\": \"轉帳狀態：成功/已完成/處理中/失敗\",\n  \"date\": \"轉帳日期 YYYY-MM-DD 格式\",\n  \"time\": \"轉帳時間 HH:mm:ss 或 HH:mm 格式（24小時制）\"\n}\n如果某個欄位無法識別，該欄位回傳 null。只回傳JSON，不要其他文字。"
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "請識別這張收據/截圖的金額、銀行名稱、轉帳是否成功、以及轉帳日期和時間:" },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${input.receiptMimeType};base64,${input.receiptBase64}`,
                      detail: "high"
                    }
                  }
                ]
              }
            ],
          });

          const content = ocrResponse.choices[0]?.message?.content;
          if (typeof content === 'string') {
            // Strip markdown code block markers if present
            const cleanJson = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            console.log('[OCR] Extracted content:', cleanJson);
            const ocrData = JSON.parse(cleanJson);
            if (ocrData.amount) {
              const parsed = parseFloat(ocrData.amount.replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed) && parsed > 0) extractedAmount = parsed.toFixed(2);
            }
            if (ocrData.bank) extractedBank = ocrData.bank;
            if (ocrData.date) {
              const dateStr = ocrData.time ? `${ocrData.date}T${ocrData.time}` : ocrData.date;
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) extractedDate = parsedDate;
              extractedDateTime = ocrData.time ? `${ocrData.date} ${ocrData.time}` : ocrData.date;
            }
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          if (errMsg.includes('OPENAI_API_KEY')) {
            console.warn("[Accounting OCR] API Key 未配置，跳過收據識別。");
          } else {
            console.error("[Accounting OCR] 收據識別失敗:", errMsg);
          }
        }

        // 使用 OCR 結果或手動輸入
        const finalAmount = input.manualAmount || extractedAmount || "0";
        const finalDate = input.manualDate || extractedDate || new Date();
        const finalBank = input.manualBank || extractedBank || null;

        const result = await insertAccountingRecord({
          transactionDate: finalDate,
          bank: finalBank,
          amount: finalAmount,
          type: input.type,
          category: input.category,
          description: input.description || null,
          receiptUrl,
          receiptKey,
          paymentRecordId: null,
          elitePaymentRecordId: null,
          studentName: input.studentName || null,
          coachName: input.coachName || null,
          dojoName: input.dojoName || null,
          source: 'manual',
          ocrRawResult: extractedAmount || extractedBank || extractedDateTime
            ? JSON.stringify({ amount: extractedAmount, bank: extractedBank, dateTime: extractedDateTime })
            : null,
        });

        // Auto-generate journal entry
        try { await onAccountingRecordCreated(result.insertId); } catch (e) { console.error('Auto journal entry failed:', e); }

        return {
          success: true,
          id: result.insertId,
          extractedAmount,
          extractedBank,
          extractedDateTime,
          receiptUrl,
        };
      }),

    // 更新記錄
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        transactionDate: z.date().optional(),
        bank: z.string().optional(),
        amount: z.string().optional(),
        type: z.enum(['income', 'expense']).optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        studentName: z.string().optional(),
        coachName: z.string().optional(),
        dojoName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateAccountingRecord(id, data as any);
        return { success: true };
      }),

    // 刪除記錄
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteAccountingRecord(input.id);
        return { success: true };
      }),

    // 從已有的繳費記錄批次同步到會計記錄
    syncExistingPayments: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // 同步恆常班繳費
        const allPayments = await db.select().from(schema.paymentRecords)
          .where(eq(schema.paymentRecords.status, 'confirmed'));
        
        const allStudents = await db.select().from(schema.students);
        const studentMap = new Map(allStudents.map(s => [s.id, s]));

        let synced = 0;
        for (const payment of allPayments) {
          const student = studentMap.get(payment.studentId);
          if (!student) continue;
          try {
            await syncPaymentToAccounting({
              paymentRecordId: payment.id,
              transactionDate: payment.paymentDate,
              amount: payment.amount,
              bank: null,
              studentName: student.name,
              coachName: student.coach,
              dojoName: student.venue || null,
              category: 'tuition',
              receiptUrl: payment.receiptUrl,
              receiptKey: payment.receiptKey,
            });
            synced++;
          } catch (e) {
            // skip duplicates
          }
        }

        // 同步精英班繳費
        const allElitePayments = await db.select().from(schema.elitePaymentRecords)
          .where(eq(schema.elitePaymentRecords.status, 'confirmed'));
        
        const allEliteStudents = await db.select().from(schema.eliteStudents);
        const eliteStudentMap = new Map(allEliteStudents.map(s => [s.id, s]));

        for (const payment of allElitePayments) {
          const student = eliteStudentMap.get(payment.studentId);
          if (!student) continue;
          try {
            await syncElitePaymentToAccounting({
              elitePaymentRecordId: payment.id,
              transactionDate: payment.paymentDate,
              amount: payment.amount,
              bank: null,
              studentName: student.name,
              coachName: student.coach,
              dojoName: '精英班',
              receiptUrl: payment.receiptUrl,
              receiptKey: payment.receiptKey,
            });
            synced++;
          } catch (e) {
            // skip duplicates
          }
        }

        return { success: true, synced };
      }),

    // ===== 銀行月結單對帳 =====

    // 1. 上傳並解析銀行月結單（支援多頁圖片）
    parseBankStatement: protectedProcedure
      .input(z.object({
        images: z.array(z.object({
          base64: z.string(),
          mimeType: z.string(),
        })).min(1).max(10),
        bankName: z.string().optional(),
        statementMonth: z.string().optional(), // e.g. "2026-01"
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Build image content array for LLM
        const imageContents: any[] = input.images.map((img, i) => ({
          type: "image_url" as const,
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
            detail: "high" as const,
          }
        }));

        try {
          const ocrResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `你是一個專業的銀行月結單識別助手。請仔細識別銀行月結單/銀行流水截圖中的所有交易記錄。

請提取每一筆交易的以下資訊，以 JSON 格式回傳：
{
  "bankName": "銀行名稱",
  "statementPeriod": "月結單期間，如 2026-01",
  "openingBalance": "期初結餘（純數字字串，如 12345.67）",
  "closingBalance": "期末結餘（純數字字串）",
  "transactions": [
    {
      "date": "交易日期 YYYY-MM-DD",
      "description": "交易說明/摘要（原文）",
      "debit": "支出金額（純數字字串，無支出則為 null）",
      "credit": "收入金額（純數字字串，無收入則為 null）",
      "balance": "結餘（純數字字串，如有顯示）",
      "reference": "參考編號（如有）"
    }
  ]
}

注意事項：
- 金額必須是純數字字串（如 "1800.00"），不含 $ 或 HK$ 符號
- 每一筆都要提取，不要遺漏
- 日期格式統一為 YYYY-MM-DD
- 如果有多頁，合併所有交易記錄
- debit = 支出/提款/扣款，credit = 收入/存入/入帳
- 如果某個欄位無法識別，回傳 null
- 中英文月結單皆可識別`
              },
              {
                role: "user",
                content: [
                  { type: "text", text: `請識別這${input.images.length > 1 ? `${input.images.length}頁` : '張'}銀行月結單的所有交易記錄：` },
                  ...imageContents,
                ]
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "bank_statement",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    bankName: { type: ["string", "null"] },
                    statementPeriod: { type: ["string", "null"] },
                    openingBalance: { type: ["string", "null"] },
                    closingBalance: { type: ["string", "null"] },
                    transactions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          date: { type: ["string", "null"] },
                          description: { type: ["string", "null"] },
                          debit: { type: ["string", "null"] },
                          credit: { type: ["string", "null"] },
                          balance: { type: ["string", "null"] },
                          reference: { type: ["string", "null"] },
                        },
                        required: ["date", "description", "debit", "credit", "balance", "reference"],
                        additionalProperties: false,
                      }
                    }
                  },
                  required: ["bankName", "statementPeriod", "openingBalance", "closingBalance", "transactions"],
                  additionalProperties: false,
                }
              }
            }
          });

          const content = ocrResponse.choices[0]?.message?.content;
          if (typeof content === 'string') {
            const parsed = JSON.parse(content);
            // Override with user-provided values if given
            if (input.bankName) parsed.bankName = input.bankName;
            if (input.statementMonth) parsed.statementPeriod = input.statementMonth;
            return parsed;
          }
          throw new Error("LLM returned no content");
        } catch (error: any) {
          const bankErrMsg = error instanceof Error ? error.message : String(error);
          console.error("[Bank Statement OCR] 識別失敗:", bankErrMsg);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `月結單識別失敗: ${error.message}`,
          });
        }
      }),

    // 2. 對帳：比對月結單交易與系統會計記錄
    reconcile: protectedProcedure
      .input(z.object({
        transactions: z.array(z.object({
          date: z.string().nullable(),
          description: z.string().nullable(),
          debit: z.string().nullable(),
          credit: z.string().nullable(),
          balance: z.string().nullable(),
          reference: z.string().nullable(),
        })),
        year: z.number(),
        month: z.number(),
        bankName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Fetch existing accounting records for the month
        const existingRecords = await getAllAccountingRecords({
          year: input.year,
          month: input.month,
        });

        // Build matching: try to match each bank transaction to a system record
        const matched: any[] = [];
        const unmatchedBank: any[] = []; // In bank but not in system
        const unmatchedSystem: any[] = []; // In system but not in bank

        const usedSystemIds = new Set<number>();

        for (const txn of input.transactions) {
          const txnAmount = parseFloat(txn.credit || txn.debit || '0');
          const txnType = txn.credit ? 'income' : 'expense';
          if (txnAmount === 0) continue;

          // Try to find a matching system record
          // 金額完全相等為必要條件，其餘為加分
          let bestMatch: any = null;
          let bestScore = 0;

          for (const rec of existingRecords) {
            if (usedSystemIds.has(rec.id)) continue;

            const recAmount = parseFloat(rec.amount);
            const amountMatch = Math.abs(recAmount - txnAmount) < 0.01;
            if (!amountMatch) continue; // 金額不符直接跳過

            const typeMatch = rec.type === txnType;

            // Date matching: same day ±1
            let dateMatch = false;
            if (txn.date && rec.transactionDate) {
              const txnDate = new Date(txn.date);
              const recDate = new Date(rec.transactionDate);
              const diffDays = Math.abs((txnDate.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));
              dateMatch = diffDays <= 1;
            }

            let score = 50; // 金額已匹配，基礎分 50
            if (typeMatch) score += 25;
            if (dateMatch) score += 25;

            if (score > bestScore) {
              bestScore = score;
              bestMatch = rec;
            }
          }

          if (bestMatch) {
            usedSystemIds.add(bestMatch.id);
            matched.push({
              bankTransaction: txn,
              systemRecord: bestMatch,
              matchScore: bestScore,
            });
            // 更新對帳狀態
            try {
              await updateAccountingRecord(bestMatch.id, {
                reconciliationStatus: 'matched',
                reconciliationDate: new Date(),
                bankReference: txn.reference || null,
              } as any);
            } catch (e) {
              // 如果更新失敗不影響對帳流程
            }
          } else {
            unmatchedBank.push(txn);
          }
        }

        // Find system records not matched to any bank transaction
        for (const rec of existingRecords) {
          if (!usedSystemIds.has(rec.id)) {
            unmatchedSystem.push(rec);
          }
        }

        return {
          matched,
          unmatchedBank,     // bank has it, system doesn't → admin needs to fill in
          unmatchedSystem,   // system has it, bank doesn't → might be incorrect
          summary: {
            totalBankTransactions: input.transactions.filter(t => parseFloat(t.credit || t.debit || '0') > 0).length,
            totalSystemRecords: existingRecords.length,
            matchedCount: matched.length,
            unmatchedBankCount: unmatchedBank.length,
            unmatchedSystemCount: unmatchedSystem.length,
          }
        };
      }),

    // 3. 匯入未匹配的月結單項目（管理員已填寫類別後）
    importUnmatched: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          date: z.string(),
          description: z.string(),
          amount: z.string(),
          type: z.enum(['income', 'expense']),
          category: z.string(),
          bank: z.string().optional(),
          studentName: z.string().optional(),
          coachName: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        let imported = 0;
        for (const item of input.items) {
          const result = await insertAccountingRecord({
            transactionDate: new Date(item.date),
            bank: item.bank || null,
            amount: item.amount,
            type: item.type,
            category: item.category,
            description: item.description,
            receiptUrl: null,
            receiptKey: null,
            paymentRecordId: null,
            elitePaymentRecordId: null,
            studentName: item.studentName || null,
            coachName: item.coachName || null,
            source: 'manual',
            reconciliationStatus: 'matched',
            reconciliationDate: new Date(),
          } as any);
          // Auto-generate journal entry for imported record
          try { await onAccountingRecordCreated((result as any).insertId ?? 0); } catch (e) { /* skip */ }
          imported++;
        }
        return { success: true, imported };
      }),

    // 匯出核數師/報稅格式數據
    getAuditExport: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const records = await getAllAccountingRecords({
          year: input.year,
          month: input.month,
        });

        // 按月份分組統計
        const monthlyData: Record<string, {
          income: number;
          expense: number;
          categories: Record<string, number>;
        }> = {};

        for (let m = 1; m <= 12; m++) {
          const key = `${m}`;
          monthlyData[key] = { income: 0, expense: 0, categories: {} };
        }

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryTotals: Record<string, { income: number; expense: number }> = {};

        for (const r of records) {
          const month = new Date(r.transactionDate).getMonth() + 1;
          const amount = parseFloat(r.amount);
          const key = `${month}`;

          if (r.type === 'income') {
            monthlyData[key].income += amount;
            totalIncome += amount;
          } else {
            monthlyData[key].expense += amount;
            totalExpense += amount;
          }

          if (!monthlyData[key].categories[r.category]) {
            monthlyData[key].categories[r.category] = 0;
          }
          monthlyData[key].categories[r.category] += amount;

          if (!categoryTotals[r.category]) {
            categoryTotals[r.category] = { income: 0, expense: 0 };
          }
          if (r.type === 'income') {
            categoryTotals[r.category].income += amount;
          } else {
            categoryTotals[r.category].expense += amount;
          }
        }

        // 對帳統計
        const reconciled = records.filter(r => r.reconciliationStatus === 'matched').length;
        const unreconciled = records.filter(r => r.reconciliationStatus === 'unmatched').length;

        return {
          year: input.year,
          month: input.month,
          records,
          monthlyData,
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense,
          categoryTotals,
          reconciliation: {
            total: records.length,
            reconciled,
            unreconciled,
            percentage: records.length > 0 ? Math.round((reconciled / records.length) * 100) : 0,
          },
        };
      }),

    // ===== 會計科目表 (Chart of Accounts) =====
    getChartOfAccounts: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return [];
        return db.select().from(schema.chartOfAccounts)
          .where(eq(schema.chartOfAccounts.isActive, true))
          .orderBy(asc(schema.chartOfAccounts.sortOrder));
      }),

    // ===== 映射規則 (Mapping Rules) =====
    getMappingRules: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return [];
        return db.select().from(schema.mappingRules)
          .where(eq(schema.mappingRules.isActive, true))
          .orderBy(desc(schema.mappingRules.priority));
      }),

    // ===== 日記帳 (Journal Entries) =====

    // 列出 Journal Entries（支援篩選）
    getJournalEntries: protectedProcedure
      .input(z.object({
        fiscalYear: z.number().optional(),
        fiscalMonth: z.number().min(1).max(12).optional(),
        sourceType: z.enum(['auto_sync', 'manual', 'adjustment', 'reversal', 'deferred_split']).optional(),
        isPosted: z.boolean().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return { entries: [], total: 0 };

        const conditions: any[] = [];
        if (input?.fiscalYear) conditions.push(eq(schema.journalEntries.fiscalYear, input.fiscalYear));
        if (input?.fiscalMonth) conditions.push(eq(schema.journalEntries.fiscalMonth, input.fiscalMonth));
        if (input?.sourceType) conditions.push(eq(schema.journalEntries.sourceType, input.sourceType));
        if (input?.isPosted !== undefined) conditions.push(eq(schema.journalEntries.isPosted, input.isPosted));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 50;

        const [entries, countResult] = await Promise.all([
          db.select().from(schema.journalEntries)
            .where(whereClause)
            .orderBy(desc(schema.journalEntries.entryDate), desc(schema.journalEntries.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
          db.select({ count: sql<number>`COUNT(*)` }).from(schema.journalEntries)
            .where(whereClause),
        ]);

        return {
          entries,
          total: Number(countResult[0]?.count ?? 0),
        };
      }),

    // 取得單筆 Journal Entry（含明細行）
    getJournalEntryDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        const entries = await db.select().from(schema.journalEntries)
          .where(eq(schema.journalEntries.id, input.id)).limit(1);
        if (!entries[0]) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此分錄' });

        const lines = await db.select({
          id: schema.journalEntryLines.id,
          accountCode: schema.journalEntryLines.accountCode,
          debit: schema.journalEntryLines.debit,
          credit: schema.journalEntryLines.credit,
          description: schema.journalEntryLines.description,
          accountName: schema.chartOfAccounts.name,
          accountNameZh: schema.chartOfAccounts.nameZh,
          accountType: schema.chartOfAccounts.type,
        })
          .from(schema.journalEntryLines)
          .leftJoin(schema.chartOfAccounts, eq(schema.journalEntryLines.accountCode, schema.chartOfAccounts.code))
          .where(eq(schema.journalEntryLines.journalEntryId, input.id))
          .orderBy(asc(schema.journalEntryLines.id));

        return { entry: entries[0], lines };
      }),

    // 手動建立 Journal Entry
    createJournalEntry: protectedProcedure
      .input(z.object({
        entryDate: z.string(), // YYYY-MM-DD
        description: z.string(),
        notes: z.string().optional(),
        lines: z.array(z.object({
          accountCode: z.string(),
          debit: z.string(),
          credit: z.string(),
          description: z.string().optional(),
        })).min(2),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await createManualJournalEntry(input);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return { success: true, journalEntryId: result.journalEntryId };
      }),

    // 過帳 Journal Entry
    postEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await postJournalEntry(input.id, ctx.user.name || 'admin');
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // 取消過帳
    unpostEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await unpostJournalEntry(input.id);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // 刪除 Journal Entry
    deleteEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await deleteJournalEntry(input.id);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // 鎖定期間
    lockPeriod: protectedProcedure
      .input(z.object({
        fiscalYear: z.number(),
        fiscalMonth: z.number().min(1).max(12),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await lockPeriod(input.fiscalYear, input.fiscalMonth);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // 批量同步 accounting_records → journal entries
    syncPendingToJournal: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return syncAllPendingRecords();
      }),

    // ===== 報表 (Reports) =====

    // 試算表 (Trial Balance)
    trialBalance: protectedProcedure
      .input(z.object({
        fiscalYear: z.number(),
        fiscalMonth: z.number().min(1).max(12).optional(),
        postedOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return { accounts: [], totalDebit: '0.00', totalCredit: '0.00', balanced: true };

        const conditions: any[] = [
          eq(schema.journalEntries.fiscalYear, input.fiscalYear),
        ];
        if (input.fiscalMonth) {
          conditions.push(eq(schema.journalEntries.fiscalMonth, input.fiscalMonth));
        }
        if (input.postedOnly) {
          conditions.push(eq(schema.journalEntries.isPosted, true));
        }

        const results = await db.select({
          accountCode: schema.journalEntryLines.accountCode,
          totalDebit: sql<string>`CAST(SUM(${schema.journalEntryLines.debit}) AS CHAR)`,
          totalCredit: sql<string>`CAST(SUM(${schema.journalEntryLines.credit}) AS CHAR)`,
        })
          .from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(...conditions))
          .groupBy(schema.journalEntryLines.accountCode)
          .orderBy(asc(schema.journalEntryLines.accountCode));

        // Join account info
        const accounts = await db.select().from(schema.chartOfAccounts);
        const accountMap = new Map(accounts.map(a => [a.code, a]));

        let totalDebit = 0;
        let totalCredit = 0;

        const trialBalanceRows = results.map(r => {
          const account = accountMap.get(r.accountCode);
          const dr = parseFloat(r.totalDebit || '0');
          const cr = parseFloat(r.totalCredit || '0');
          totalDebit += dr;
          totalCredit += cr;
          return {
            accountCode: r.accountCode,
            accountName: account?.name ?? r.accountCode,
            accountNameZh: account?.nameZh ?? r.accountCode,
            accountType: account?.type ?? 'unknown',
            debit: dr.toFixed(2),
            credit: cr.toFixed(2),
            balance: (dr - cr).toFixed(2),
          };
        });

        return {
          accounts: trialBalanceRows,
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        };
      }),

    // 損益表 (Profit & Loss)
    profitAndLoss: protectedProcedure
      .input(z.object({
        fiscalYear: z.number(),
        fiscalMonth: z.number().min(1).max(12).optional(),
        postedOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return { revenue: [], expenses: [], totalRevenue: '0.00', totalExpense: '0.00', netIncome: '0.00' };

        const conditions: any[] = [
          eq(schema.journalEntries.fiscalYear, input.fiscalYear),
        ];
        if (input.fiscalMonth) {
          conditions.push(eq(schema.journalEntries.fiscalMonth, input.fiscalMonth));
        }
        if (input.postedOnly) {
          conditions.push(eq(schema.journalEntries.isPosted, true));
        }

        const results = await db.select({
          accountCode: schema.journalEntryLines.accountCode,
          totalDebit: sql<string>`CAST(SUM(${schema.journalEntryLines.debit}) AS CHAR)`,
          totalCredit: sql<string>`CAST(SUM(${schema.journalEntryLines.credit}) AS CHAR)`,
        })
          .from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(...conditions))
          .groupBy(schema.journalEntryLines.accountCode)
          .orderBy(asc(schema.journalEntryLines.accountCode));

        const accounts = await db.select().from(schema.chartOfAccounts);
        const accountMap = new Map(accounts.map(a => [a.code, a]));

        const revenue: any[] = [];
        const expenses: any[] = [];
        let totalRevenue = 0;
        let totalExpense = 0;

        for (const r of results) {
          const account = accountMap.get(r.accountCode);
          if (!account) continue;
          const dr = parseFloat(r.totalDebit || '0');
          const cr = parseFloat(r.totalCredit || '0');

          if (account.type === 'revenue') {
            // Revenue = Credit - Debit (normal balance is credit)
            const amount = cr - dr;
            totalRevenue += amount;
            revenue.push({
              accountCode: r.accountCode,
              accountName: account.name,
              accountNameZh: account.nameZh,
              amount: amount.toFixed(2),
            });
          } else if (account.type === 'expense') {
            // Expense = Debit - Credit (normal balance is debit)
            const amount = dr - cr;
            totalExpense += amount;
            expenses.push({
              accountCode: r.accountCode,
              accountName: account.name,
              accountNameZh: account.nameZh,
              amount: amount.toFixed(2),
            });
          }
        }

        return {
          revenue,
          expenses,
          totalRevenue: totalRevenue.toFixed(2),
          totalExpense: totalExpense.toFixed(2),
          netIncome: (totalRevenue - totalExpense).toFixed(2),
        };
      }),

    // 資產負債表 (Balance Sheet)
    balanceSheet: protectedProcedure
      .input(z.object({
        fiscalYear: z.number(),
        fiscalMonth: z.number().min(1).max(12).optional(),
        postedOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return { assets: [], liabilities: [], equity: [], totalAssets: '0.00', totalLiabilities: '0.00', totalEquity: '0.00', balanced: true };

        // For Balance Sheet, we need cumulative data up to the period
        const conditions: any[] = [];
        if (input.fiscalMonth) {
          // Up to and including the specified month
          conditions.push(
            sql`(${schema.journalEntries.fiscalYear} < ${input.fiscalYear} OR (${schema.journalEntries.fiscalYear} = ${input.fiscalYear} AND ${schema.journalEntries.fiscalMonth} <= ${input.fiscalMonth}))`
          );
        } else {
          conditions.push(
            sql`${schema.journalEntries.fiscalYear} <= ${input.fiscalYear}`
          );
        }
        if (input.postedOnly) {
          conditions.push(eq(schema.journalEntries.isPosted, true));
        }

        const results = await db.select({
          accountCode: schema.journalEntryLines.accountCode,
          totalDebit: sql<string>`CAST(SUM(${schema.journalEntryLines.debit}) AS CHAR)`,
          totalCredit: sql<string>`CAST(SUM(${schema.journalEntryLines.credit}) AS CHAR)`,
        })
          .from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(...conditions))
          .groupBy(schema.journalEntryLines.accountCode)
          .orderBy(asc(schema.journalEntryLines.accountCode));

        const allAccounts = await db.select().from(schema.chartOfAccounts);
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));

        const assets: any[] = [];
        const liabilities: any[] = [];
        const equity: any[] = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let netIncome = 0; // Revenue - Expense for retained earnings

        for (const r of results) {
          const account = accountMap.get(r.accountCode);
          if (!account) continue;
          const dr = parseFloat(r.totalDebit || '0');
          const cr = parseFloat(r.totalCredit || '0');

          const row = {
            accountCode: r.accountCode,
            accountName: account.name,
            accountNameZh: account.nameZh,
          };

          if (account.type === 'asset') {
            const amount = dr - cr; // Normal balance: debit
            totalAssets += amount;
            assets.push({ ...row, amount: amount.toFixed(2) });
          } else if (account.type === 'liability') {
            const amount = cr - dr; // Normal balance: credit
            totalLiabilities += amount;
            liabilities.push({ ...row, amount: amount.toFixed(2) });
          } else if (account.type === 'equity') {
            const amount = cr - dr;
            totalEquity += amount;
            equity.push({ ...row, amount: amount.toFixed(2) });
          } else if (account.type === 'revenue') {
            netIncome += (cr - dr);
          } else if (account.type === 'expense') {
            netIncome -= (dr - cr);
          }
        }

        // Add net income to equity as "本期損益"
        totalEquity += netIncome;
        equity.push({
          accountCode: '---',
          accountName: 'Net Income (Current Period)',
          accountNameZh: '本期損益',
          amount: netIncome.toFixed(2),
        });

        return {
          assets,
          liabilities,
          equity,
          totalAssets: totalAssets.toFixed(2),
          totalLiabilities: totalLiabilities.toFixed(2),
          totalEquity: totalEquity.toFixed(2),
          balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
        };
      }),

    // 總帳明細 (General Ledger)
    generalLedger: protectedProcedure
      .input(z.object({
        accountCode: z.string(),
        fiscalYear: z.number(),
        fiscalMonth: z.number().min(1).max(12).optional(),
        postedOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return { account: null, entries: [], openingBalance: '0.00' };

        // Account info
        const accts = await db.select().from(schema.chartOfAccounts)
          .where(eq(schema.chartOfAccounts.code, input.accountCode)).limit(1);
        const account = accts[0] ?? null;

        const conditions: any[] = [
          eq(schema.journalEntryLines.accountCode, input.accountCode),
          eq(schema.journalEntries.fiscalYear, input.fiscalYear),
        ];
        if (input.fiscalMonth) {
          conditions.push(eq(schema.journalEntries.fiscalMonth, input.fiscalMonth));
        }
        if (input.postedOnly) {
          conditions.push(eq(schema.journalEntries.isPosted, true));
        }

        const entries = await db.select({
          lineId: schema.journalEntryLines.id,
          journalEntryId: schema.journalEntries.id,
          entryNumber: schema.journalEntries.entryNumber,
          entryDate: schema.journalEntries.entryDate,
          description: schema.journalEntries.description,
          debit: schema.journalEntryLines.debit,
          credit: schema.journalEntryLines.credit,
          lineDescription: schema.journalEntryLines.description,
          isPosted: schema.journalEntries.isPosted,
        })
          .from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(...conditions))
          .orderBy(asc(schema.journalEntries.entryDate), asc(schema.journalEntries.id));

        // Calculate opening balance (all posted entries before this period)
        const openingConditions: any[] = [
          eq(schema.journalEntryLines.accountCode, input.accountCode),
          eq(schema.journalEntries.isPosted, true),
        ];
        if (input.fiscalMonth) {
          openingConditions.push(
            sql`(${schema.journalEntries.fiscalYear} < ${input.fiscalYear} OR (${schema.journalEntries.fiscalYear} = ${input.fiscalYear} AND ${schema.journalEntries.fiscalMonth} < ${input.fiscalMonth}))`
          );
        } else {
          openingConditions.push(
            sql`${schema.journalEntries.fiscalYear} < ${input.fiscalYear}`
          );
        }

        const openingResult = await db.select({
          totalDebit: sql<string>`CAST(COALESCE(SUM(${schema.journalEntryLines.debit}), 0) AS CHAR)`,
          totalCredit: sql<string>`CAST(COALESCE(SUM(${schema.journalEntryLines.credit}), 0) AS CHAR)`,
        })
          .from(schema.journalEntryLines)
          .innerJoin(schema.journalEntries, eq(schema.journalEntryLines.journalEntryId, schema.journalEntries.id))
          .where(and(...openingConditions));

        const openDr = parseFloat(openingResult[0]?.totalDebit || '0');
        const openCr = parseFloat(openingResult[0]?.totalCredit || '0');
        const openingBalance = (openDr - openCr).toFixed(2);

        return { account, entries, openingBalance };
      }),
  }),

  // ==================== 活動管理 ====================
  events: router({
    // 取得所有活動（管理員）
    getAll: protectedProcedure
      .input(z.object({
        type: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getAllEvents(input);
      }),

    // 取得開放報名的活動（家長）
    getOpen: publicProcedure.query(async () => {
      return getOpenEvents();
    }),

    // 新增活動（管理員）
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        type: z.enum(['exam', 'competition', 'training']),
        description: z.string().optional(),
        eventDate: z.date(),
        eventTime: z.string().optional(),
        location: z.string().optional(),
        fee: z.string().optional(),
        maxParticipants: z.number().optional(),
        registrationDeadline: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const result = await insertEvent({
          title: input.title,
          type: input.type,
          description: input.description || null,
          eventDate: input.eventDate,
          eventTime: input.eventTime || null,
          location: input.location || null,
          fee: input.fee || "0",
          maxParticipants: input.maxParticipants || null,
          registrationDeadline: input.registrationDeadline || null,
          status: 'open',
        });
        return { success: true, id: result.insertId };
      }),

    // 更新活動（管理員）
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        type: z.enum(['exam', 'competition', 'training']).optional(),
        description: z.string().optional(),
        eventDate: z.date().optional(),
        eventTime: z.string().optional(),
        location: z.string().optional(),
        fee: z.string().optional(),
        maxParticipants: z.number().nullable().optional(),
        registrationDeadline: z.date().nullable().optional(),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await updateEvent(id, data as any);
        return { success: true };
      }),

    // 刪除活動（管理員）
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await deleteEvent(input.id);
        return { success: true };
      }),

    // 取得活動報名記錄
    getRegistrations: protectedProcedure
      .input(z.object({
        eventId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getEventRegistrations(input.eventId);
      }),

    // 取得家長的報名記錄
    getMyRegistrations: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getEventRegistrations(undefined, input.phone);
      }),

    // 報名活動（家長）
    register: publicProcedure
      .input(z.object({
        eventId: z.number(),
        studentId: z.number().optional(),
        eliteStudentId: z.number().optional(),
        studentName: z.string(),
        phone: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 檢查是否已報名
        const existing = await getEventRegistrations(input.eventId, input.phone);
        const alreadyRegistered = existing.find(
          r => r.studentName === input.studentName && r.status !== 'cancelled'
        );
        if (alreadyRegistered) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '該學生已報名此活動' });
        }

        // 檢查報名人數
        const count = await getEventRegistrationCount(input.eventId);
        // 取得活動資訊
        const allEvents = await getAllEvents();
        const event = allEvents.find(e => e.id === input.eventId);
        if (event?.maxParticipants && count >= event.maxParticipants) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '報名人數已滿' });
        }

        const result = await registerForEvent({
          eventId: input.eventId,
          studentId: input.studentId || null,
          eliteStudentId: input.eliteStudentId || null,
          studentName: input.studentName,
          phone: input.phone,
          status: 'registered',
          notes: input.notes || null,
        });
        return { success: true, id: result.insertId };
      }),

    // 取消報名（家長）
    cancelRegistration: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await cancelEventRegistration(input.id);
        return { success: true };
      }),

    // 更新報名狀態（管理員）
    updateRegistrationStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['registered', 'confirmed', 'cancelled']),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await updateEventRegistrationStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ==================== 考試評分系統 ====================
  exam: router({
    // --- 考試場次 ---
    list: protectedProcedure.query(async () => {
      return getAllExamSessions();
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const exam = await getExamSessionById(input.id);
        if (!exam) throw new TRPCError({ code: 'NOT_FOUND', message: '考試不存在' });
        return exam;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        examDate: z.date(),
        location: z.string().optional(),
        description: z.string().optional(),
        eventId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await insertExamSession({
          name: input.name,
          examDate: input.examDate,
          location: input.location || null,
          description: input.description || null,
          eventId: input.eventId || null,
          status: 'draft',
        });
        return { success: true, id: result.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        examDate: z.date().optional(),
        location: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['draft', 'scheduled', 'in_progress', 'completed']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { id, ...data } = input;
        await updateExamSession(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await deleteExamSession(input.id);
        return { success: true };
      }),

    statistics: publicProcedure
      .input(z.object({ examId: z.number() }))
      .query(async ({ input }) => {
        return getExamStatistics(input.examId);
      }),

    // --- 考生 ---
    candidates: router({
      list: publicProcedure
        .input(z.object({ examId: z.number() }))
        .query(async ({ input }) => {
          return getExamCandidatesByExam(input.examId);
        }),

      listByBelt: publicProcedure
        .input(z.object({ examId: z.number(), belt: z.string() }))
        .query(async ({ input }) => {
          return getExamCandidatesByBelt(input.examId, input.belt);
        }),

      get: publicProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const candidate = await getExamCandidateById(input.id);
          if (!candidate) throw new TRPCError({ code: 'NOT_FOUND', message: '考生不存在' });
          return candidate;
        }),

      create: protectedProcedure
        .input(z.object({
          examId: z.number(),
          studentId: z.number().optional(),
          name: z.string().min(1),
          phone: z.string().optional(),
          dojoName: z.string().optional(),
          gender: z.enum(['male', 'female']).default('male'),
          age: z.number().optional(),
          ageGroup: z.string().optional(),
          currentBelt: z.string(),
          targetBelt: z.string(),
          groupCode: z.string().optional(),
          orderNumber: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const result = await insertExamCandidate({
            examId: input.examId,
            studentId: input.studentId || null,
            name: input.name,
            phone: input.phone || null,
            dojoName: input.dojoName || null,
            gender: input.gender,
            age: input.age || null,
            ageGroup: input.ageGroup || null,
            currentBelt: input.currentBelt,
            targetBelt: input.targetBelt,
            groupCode: input.groupCode || null,
            orderNumber: input.orderNumber || null,
            status: 'registered',
            hasLakLakAward: false,
          });
          return { success: true, id: result.insertId };
        }),

      bulkCreate: protectedProcedure
        .input(z.object({
          examId: z.number(),
          candidates: z.array(z.object({
            studentId: z.number().optional(),
            name: z.string(),
            phone: z.string().optional(),
            dojoName: z.string().optional(),
            gender: z.enum(['male', 'female']).default('male'),
            age: z.number().optional(),
            ageGroup: z.string().optional(),
            currentBelt: z.string(),
            targetBelt: z.string(),
          })),
        }))
        .mutation(async ({ input }) => {
          const data = input.candidates.map(c => ({
            examId: input.examId,
            studentId: c.studentId || null,
            name: c.name,
            phone: c.phone || null,
            dojoName: c.dojoName || null,
            gender: c.gender,
            age: c.age || null,
            ageGroup: c.ageGroup || null,
            currentBelt: c.currentBelt,
            targetBelt: c.targetBelt,
            groupCode: null,
            orderNumber: null,
            status: 'registered' as const,
            hasLakLakAward: false,
          }));
          const count = await bulkInsertExamCandidates(data);
          return { success: true, count };
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          phone: z.string().optional(),
          gender: z.enum(['male', 'female']).optional(),
          age: z.number().optional(),
          ageGroup: z.string().optional(),
          currentBelt: z.string().optional(),
          targetBelt: z.string().optional(),
          groupCode: z.string().optional(),
          orderNumber: z.number().optional(),
          status: z.enum(['registered', 'checked_in', 'examining', 'passed', 'failed', 'absent']).optional(),
          hasLakLakAward: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          const filtered = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
          if (Object.keys(filtered).length === 0) return { success: true };
          await updateExamCandidate(id, filtered as any);
          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteExamCandidate(input.id);
          return { success: true };
        }),

      // 從報名活動自動導入考生
      importFromEvent: protectedProcedure
        .input(z.object({ examId: z.number(), eventId: z.number() }))
        .mutation(async ({ input, ctx }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          const count = await createCandidatesFromEventRegistrations(input.examId, input.eventId);
          return { success: true, imported: count };
        }),
    }),

    // --- 評分項目 ---
    scoringItems: router({
      list: publicProcedure
        .input(z.object({ beltLevel: z.string().optional() }).optional())
        .query(async ({ input }) => {
          return getExamScoringItems(input?.beltLevel);
        }),

      listByBelt: publicProcedure
        .input(z.object({ beltLevel: z.string() }))
        .query(async ({ input }) => {
          return getExamScoringItemsByBelt(input.beltLevel);
        }),

      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(['grade', 'pass_fail', 'yes_no']).default('grade'),
          category: z.string().optional(),
          maxScore: z.string().default('10.00'),
          weight: z.string().default('1.00'),
          beltLevel: z.string().optional(),
          sortOrder: z.number().default(0),
        }))
        .mutation(async ({ input }) => {
          const result = await insertExamScoringItem({
            name: input.name,
            description: input.description || null,
            type: input.type,
            category: input.category || null,
            maxScore: input.maxScore,
            weight: input.weight,
            beltLevel: input.beltLevel || null,
            sortOrder: input.sortOrder,
          });
          return { success: true, id: result.insertId };
        }),

      // 批量初始化評分項目（從原考試系統的常量定義）
      initForBelt: protectedProcedure
        .input(z.object({ beltLevel: z.string() }))
        .mutation(async ({ input, ctx }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          // 檢查是否已存在
          const existing = await getExamScoringItemsByBelt(input.beltLevel);
          if (existing.length > 0) {
            return { success: true, count: existing.length, message: '評分項目已存在' };
          }
          // 從常量初始化
          const BELT_ITEMS = getBeltScoringItems(input.beltLevel);
          if (!BELT_ITEMS || BELT_ITEMS.length === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `無此帶級的評分項目定義: ${input.beltLevel}` });
          }
          const items = BELT_ITEMS.map((item: any, idx: number) => ({
            name: item.name,
            description: item.description || null,
            type: item.type === 'yes_no' ? 'yes_no' as const : item.type === 'pass_fail' ? 'pass_fail' as const : 'grade' as const,
            category: item.category || null,
            maxScore: '10.00',
            weight: String(item.weight || 1),
            beltLevel: input.beltLevel,
            sortOrder: idx,
          }));
          const count = await bulkInsertExamScoringItems(items);
          return { success: true, count };
        }),
    }),

    // --- 評分 ---
    scores: router({
      getByCandidate: publicProcedure
        .input(z.object({ candidateId: z.number() }))
        .query(async ({ input }) => {
          return getExamScoresWithItemsByCandidate(input.candidateId);
        }),

      listByExam: publicProcedure
        .input(z.object({ examId: z.number() }))
        .query(async ({ input }) => {
          return getExamScoresByExam(input.examId);
        }),

      upsert: protectedProcedure
        .input(z.object({
          candidateId: z.number(),
          scoringItemId: z.number(),
          score: z.string(),
          comment: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await upsertExamScore({
            candidateId: input.candidateId,
            scoringItemId: input.scoringItemId,
            score: input.score,
            comment: input.comment || null,
            scoredBy: ctx.user?.name || ctx.user?.openId || 'admin',
          });
          return { success: true };
        }),

      bulkUpsert: protectedProcedure
        .input(z.object({
          candidateId: z.number(),
          scores: z.array(z.object({
            scoringItemId: z.number(),
            score: z.string(),
            comment: z.string().optional(),
          })),
        }))
        .mutation(async ({ input, ctx }) => {
          for (const s of input.scores) {
            await upsertExamScore({
              candidateId: input.candidateId,
              scoringItemId: s.scoringItemId,
              score: s.score,
              comment: s.comment || null,
              scoredBy: ctx.user?.name || ctx.user?.openId || 'admin',
            });
          }
          // 自動計算結果
          let calcResult: any = null;
          try {
            calcResult = await calculateExamResult(input.candidateId);
          } catch (e) {
            console.warn('[Exam] Auto-calculate failed:', e);
          }
          // SSE 廣播評分變更
          try {
            const candidate = await getExamCandidateById(input.candidateId);
            if (candidate) {
              broadcastScoreUpdate(candidate.examId, {
                candidateId: input.candidateId,
                scores: input.scores.map(s => ({ scoringItemId: s.scoringItemId, itemName: '', score: s.score })),
                candidateStatus: candidate.status,
                hasLakLakAward: candidate.hasLakLakAward ?? false,
                updatedBy: ctx.user?.name || 'admin',
              });
              // 也廣播統計更新
              const stats = await getExamStatistics(candidate.examId);
              if (stats) broadcastStatsUpdate(candidate.examId, stats);
            }
          } catch (e) {
            console.warn('[SSE] Broadcast failed:', e);
          }
          return { success: true, count: input.scores.length, result: calcResult };
        }),

      calculateResult: protectedProcedure
        .input(z.object({ candidateId: z.number() }))
        .mutation(async ({ input }) => {
          return calculateExamResult(input.candidateId);
        }),

      deleteByCandidate: protectedProcedure
        .input(z.object({ candidateId: z.number() }))
        .mutation(async ({ input }) => {
          await deleteExamScoresByCandidate(input.candidateId);
          return { success: true };
        }),
    }),

    // --- 升帶 ---
    promote: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return promotePassedCandidate(input.candidateId);
      }),

    promoteAll: protectedProcedure
      .input(z.object({ examId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return promoteAllPassedCandidates(input.examId);
      }),

    // --- 家長查看成績 ---
    resultsByPhone: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getExamResultsByPhone(input.phone);
      }),

    resultsByStudent: publicProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        return getExamResultsByStudent(input.studentId);
      }),

    // --- 考試時間表 ---
    schedules: router({
      list: publicProcedure
        .input(z.object({ examId: z.number() }))
        .query(async ({ input }) => {
          return getExamSchedulesByExam(input.examId);
        }),

      create: protectedProcedure
        .input(z.object({
          examId: z.number(),
          beltLevel: z.string(),
          groupCode: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          timeSlot: z.string().optional(),
          venue: z.string().optional(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const result = await insertExamSchedule({
            examId: input.examId,
            beltLevel: input.beltLevel,
            groupCode: input.groupCode || null,
            startTime: input.startTime,
            endTime: input.endTime || null,
            timeSlot: input.timeSlot || null,
            venue: input.venue || null,
            notes: input.notes || null,
          });
          return { success: true, id: result.insertId };
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          beltLevel: z.string().optional(),
          groupCode: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          timeSlot: z.string().optional(),
          venue: z.string().optional(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          const filtered = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
          if (Object.keys(filtered).length === 0) return { success: true };
          await updateExamSchedule(id, filtered as any);
          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteExamSchedule(input.id);
          return { success: true };
        }),
    }),

    // --- 考試簽到 (公開，不需登入) ---
    attendance: router({
      checkIn: publicProcedure
        .input(z.object({ candidateId: z.number() }))
        .mutation(async ({ input }) => {
          await examCheckIn(input.candidateId);
          // SSE 廣播
          try {
            const candidate = await getExamCandidateById(input.candidateId);
            if (candidate) {
              broadcastCandidateUpdate(candidate.examId, {
                candidateId: input.candidateId,
                status: 'checked_in',
                name: candidate.name,
              });
              // 廣播點名更新
              const allCandidates = await getExamCandidatesByExam(candidate.examId);
              const checkedInCount = allCandidates.filter((c: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
              broadcastAttendanceUpdate(candidate.examId, {
                candidateId: input.candidateId,
                candidateName: candidate.name,
                action: 'check_in',
                newStatus: 'checked_in',
                checkedInCount,
                totalCount: allCandidates.length,
              });
              // 也廣播統計更新
              const stats = await getExamStatistics(candidate.examId);
              if (stats) broadcastStatsUpdate(candidate.examId, stats);
            }
          } catch (e) { console.warn('[SSE] checkIn broadcast failed:', e); }
          return { success: true };
        }),

      undoCheckIn: publicProcedure
        .input(z.object({ candidateId: z.number() }))
        .mutation(async ({ input }) => {
          await examUndoCheckIn(input.candidateId);
          try {
            const candidate = await getExamCandidateById(input.candidateId);
            if (candidate) {
              broadcastCandidateUpdate(candidate.examId, {
                candidateId: input.candidateId,
                status: 'registered',
                name: candidate.name,
              });
              const allCandidates = await getExamCandidatesByExam(candidate.examId);
              const checkedInCount = allCandidates.filter((c: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
              broadcastAttendanceUpdate(candidate.examId, {
                candidateId: input.candidateId,
                candidateName: candidate.name,
                action: 'undo_check_in',
                newStatus: 'registered',
                checkedInCount,
                totalCount: allCandidates.length,
              });
              const stats = await getExamStatistics(candidate.examId);
              if (stats) broadcastStatsUpdate(candidate.examId, stats);
            }
          } catch (e) { console.warn('[SSE] undoCheckIn broadcast failed:', e); }
          return { success: true };
        }),

      markAbsent: publicProcedure
        .input(z.object({ candidateId: z.number(), absent: z.boolean() }))
        .mutation(async ({ input }) => {
          await examMarkAbsent(input.candidateId, input.absent);
          try {
            const candidate = await getExamCandidateById(input.candidateId);
            if (candidate) {
              broadcastCandidateUpdate(candidate.examId, {
                candidateId: input.candidateId,
                status: input.absent ? 'absent' : 'registered',
                name: candidate.name,
              });
              const allCandidates = await getExamCandidatesByExam(candidate.examId);
              const checkedInCount = allCandidates.filter((c: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
              broadcastAttendanceUpdate(candidate.examId, {
                candidateId: input.candidateId,
                candidateName: candidate.name,
                action: input.absent ? 'mark_absent' : 'undo_absent',
                newStatus: input.absent ? 'absent' : 'registered',
                checkedInCount,
                totalCount: allCandidates.length,
              });
              const stats = await getExamStatistics(candidate.examId);
              if (stats) broadcastStatsUpdate(candidate.examId, stats);
            }
          } catch (e) { console.warn('[SSE] markAbsent broadcast failed:', e); }
          return { success: true };
        }),

      bulkCheckIn: publicProcedure
        .input(z.object({ candidateIds: z.array(z.number()) }))
        .mutation(async ({ input }) => {
          for (const id of input.candidateIds) {
            await examCheckIn(id);
          }
          // Broadcast for the first candidate's exam
          try {
            if (input.candidateIds.length > 0) {
              const candidate = await getExamCandidateById(input.candidateIds[0]);
              if (candidate) {
                for (const id of input.candidateIds) {
                  broadcastCandidateUpdate(candidate.examId, { candidateId: id, status: 'checked_in' });
                }
                const allCandidates = await getExamCandidatesByExam(candidate.examId);
                const checkedInCount = allCandidates.filter((c: any) => ['checked_in', 'examining', 'passed', 'failed'].includes(c.status)).length;
                broadcastAttendanceUpdate(candidate.examId, {
                  candidateId: input.candidateIds[0],
                  candidateName: candidate.name,
                  action: 'bulk_check_in',
                  newStatus: 'checked_in',
                  checkedInCount,
                  totalCount: allCandidates.length,
                });
                const stats = await getExamStatistics(candidate.examId);
                if (stats) broadcastStatsUpdate(candidate.examId, stats);
              }
            }
          } catch (e) { console.warn('[SSE] bulkCheckIn broadcast failed:', e); }
          return { success: true, count: input.candidateIds.length };
        }),
    }),

    // --- 搜尋考生 ---
    search: publicProcedure
      .input(z.object({ examId: z.number(), query: z.string() }))
      .query(async ({ input }) => {
        return searchExamCandidates(input.examId, input.query);
      }),

    // --- 批量刪除考生 ---
    bulkDeleteCandidates: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await bulkDeleteExamCandidates(input.ids);
        return { success: true, count: input.ids.length };
      }),
  }),

  // 系統收款帳號設定
  payeeConfig: router({
    // 取得所有接受的收款帳號
    getAcceptedAccounts: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const accounts = await getAcceptedPayeeAccounts();
        const enabled = await getSystemConfig('receipt_validation_enabled');
        return { accounts, validationEnabled: enabled === 'true' };
      }),

    // 更新接受的收款帳號列表
    updateAcceptedAccounts: protectedProcedure
      .input(z.object({
        accounts: z.array(z.object({
          name: z.string().min(1),
          account: z.string().min(1),
          type: z.enum(['bank', 'fps', 'payme', 'other']),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await setSystemConfig(
          'accepted_payee_accounts',
          JSON.stringify(input.accounts),
          '接受的收款帳號列表 (JSON陣列)，用於驗證家長上傳的收據'
        );
        return { success: true };
      }),

    // 切換收款人驗證功能
    toggleValidation: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await setSystemConfig('receipt_validation_enabled', input.enabled ? 'true' : 'false');
        return { success: true };
      }),
  }),
});

// 帶級對應評分項目定義（來源：考試系統 shared/constants.ts）
// 注意：key 使用英文帶級名稱（與 DB 的 belt_level 欄位一致）
function getBeltScoringItems(belt: string) {
  const BELT_SCORING_ITEMS: Record<string, Array<{ name: string; description?: string; type: string; category?: string; weight: number }>> = {
    white: [
      { name: "掌上壓", description: "幼稚園5次/小學8次/中學或以上12次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園5次/小學8次/中學或以上12次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園5次/小學8次/中學或以上12次", type: "grade", category: "fitness", weight: 1 },
      { name: "直拳", description: "直拳10次", type: "grade", category: "technique", weight: 1 },
      { name: "前踢", description: "前踢5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "cutdown", description: "cutdown 5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "旋踢", description: "旋踢（小學以上）5次左5次右", type: "grade", category: "technique", weight: 1 },
    ],
    yellow: [
      { name: "掌上壓", description: "幼稚園8次/小學12次/中學或以上16次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園8次/小學12次/中學或以上16次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園8次/小學12次/中學或以上16次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極一章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "旋踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "上馬cut down", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
    ],
    yellow_green: [
      { name: "掌上壓", description: "幼稚園10次/小學15次/中學或以上20次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園10次/小學15次/中學或以上20次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園10次/小學15次/中學或以上20次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極二章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "跳躍旋踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍前踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "上中雙前踢", description: "10組", type: "grade", category: "technique", weight: 1 },
    ],
    green: [
      { name: "掌上壓", description: "幼稚園10次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園10次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園10次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極三章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "後踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍cutdown", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "旋踢+旋踢+空中雙旋踢", description: "3次左3次右", type: "grade", category: "technique", weight: 1 },
      { name: "旋踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "前踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "cutdown(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
    ],
    green_blue: [
      { name: "掌上壓", description: "幼稚園15次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園15次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園15次/小學20次/中學或以上25次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極四章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "側踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "旋踢+後踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "退後旋踢+退後旋踢+退後空中雙旋踢", description: "3次左3次右", type: "grade", category: "technique", weight: 1 },
      { name: "後踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "跳躍cutdown(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "跳躍旋踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
    ],
    blue: [
      { name: "掌上壓", description: "幼稚園20次/小學30次/中學或以上35次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園20次/小學30次/中學或以上35次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園20次/小學30次/中學或以上35次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極五章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "跳躍側踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍後踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "360", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍旋踢+跳躍cutdown", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "肘擊(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "側踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "上馬後踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "一字馬", description: "", type: "pass_fail", category: "split", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
    ],
    blue_red: [
      { name: "掌上壓", description: "幼稚園25次/小學40次/中學或以上50次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園25次/小學40次/中學或以上50次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園20次/小學30次/中學或以上35次", type: "grade", category: "fitness", weight: 1 },
      { name: "雙膝跳", description: "幼稚園20次/小學30次/中學或以上35次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極六章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "太極一至五抽籤", description: "", type: "grade", category: "poomsae", weight: 1 },
      { name: "退後跳躍後踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "旋踢+360旋踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍側踢+跳躍cutdown", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍側踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "跳躍後踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "360(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "一字馬", description: "", type: "pass_fail", category: "split", weight: 1 },
      { name: "大字馬", description: "", type: "pass_fail", category: "side_split", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
    ],
    red: [
      { name: "掌上壓", description: "幼稚園30次/小學45次/中學或以上60次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園30次/小學45次/中學或以上60次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園30次/小學35次/中學或以上40次", type: "grade", category: "fitness", weight: 1 },
      { name: "雙膝跳", description: "幼稚園30次/小學35次/中學或以上40次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極七章", description: "", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "太極一至六抽籤", description: "", type: "grade", category: "poomsae", weight: 1 },
      { name: "原地空中雙旋踢", description: "20組", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍空中側踢", description: "3次右或左", type: "grade", category: "technique", weight: 1 },
      { name: "後旋踢", description: "5次左5次右", type: "grade", category: "technique", weight: 1 },
      { name: "跳躍雙前踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "空中雙旋踢(木板)", description: "幼稚園2分板/小學3分板/中學4分板/18歲以上6分板", type: "grade", category: "board", weight: 1 },
      { name: "一字馬", description: "", type: "pass_fail", category: "split", weight: 1 },
      { name: "大字馬", description: "", type: "pass_fail", category: "side_split", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
      { name: "外出比賽一次", description: "", type: "yes_no", category: "competition", weight: 1 },
    ],
    red_black: [
      { name: "掌上壓", description: "幼稚園30次/小學45次/中學或以上60次", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "幼稚園30次/小學45次/中學或以上60次", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "幼稚園30次/小學35次/中學或以上40次", type: "grade", category: "fitness", weight: 1 },
      { name: "雙膝跳", description: "幼稚園30次/小學35次/中學或以上40次", type: "grade", category: "fitness", weight: 1 },
      { name: "太極一章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極二章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極三章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極四章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極五章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極六章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極七章", type: "grade", category: "poomsae", weight: 1 },
      { name: "太極八章", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "一字馬", description: "", type: "pass_fail", category: "split", weight: 1 },
      { name: "大字馬", description: "", type: "pass_fail", category: "side_split", weight: 1 },
    ],
    black: [
      { name: "掌上壓", description: "小學30次X2set/中學40次X2set", type: "grade", category: "fitness", weight: 1 },
      { name: "仰臥起坐", description: "小學30次X2set/中學40次X2set", type: "grade", category: "fitness", weight: 1 },
      { name: "蹲坐跳", description: "小學30次X2set/中學40次X2set", type: "grade", category: "fitness", weight: 1 },
      { name: "雙膝跳", description: "小學30次X2set/中學40次X2set", type: "grade", category: "fitness", weight: 1 },
      { name: "太極一至八章", type: "grade", category: "poomsae", weight: 1.5 },
      { name: "一字馬", description: "", type: "pass_fail", category: "split", weight: 1 },
      { name: "大字馬", description: "", type: "pass_fail", category: "side_split", weight: 1 },
      { name: "搏擊", description: "", type: "pass_fail", category: "sparring", weight: 1 },
      { name: "外出比賽一次(搏擊)", description: "", type: "yes_no", category: "competition", weight: 1 },
      { name: "外出比賽一次(套拳)", description: "", type: "yes_no", category: "competition", weight: 1 },
    ],
  };
  return BELT_SCORING_ITEMS[belt] || null;
}

export type AppRouter = typeof appRouter;
