import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { 
  getStudentsByPhone, 
  getAllStudents, 
  getStudentById,
  updateStudent,
  insertPaymentRecord,
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
} from "./db";
import { users, students, InsertStudent } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { verifyPassword, hashPassword } from "./password";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
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
        if (ctx.user.role !== 'admin') {
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
        }));
        
        await bulkInsertStudents(studentsToInsert);
        
        return { success: true, count: studentsToInsert.length };
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
        if (data.status !== undefined) updateData.status = data.status;
        
        await updateStudent(id, updateData);
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
        if (ctx.user.role !== 'admin') {
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
        
        try {
          const ocrResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "你是一個銀行轉帳收據識別助手，能識別中文和英文收據。請從收據/截圖中提取以下資訊並以JSON格式回傳:\n- amount: 轉帳金額（純數字字串，例如 \"1800.00\"，注意識別 HKD/HK$/$ 等貨幣符號後的數字）\n- bank: 銀行名稱（中文或英文皆可，例如 \"中國銀行\"/\"Bank of China\", \"匯豐銀行\"/\"HSBC\", \"恒生銀行\"/\"Hang Seng Bank\", \"渣打銀行\"/\"Standard Chartered\", \"星展銀行\"/\"DBS\", \"東亞銀行\"/\"BEA\", \"Wise\", \"PayMe\", \"FPS轉數快\" 等，如果有收款方和付款方銀行都顯示，優先提取付款方銀行）\n- status: 轉帳狀態，統一以中文回傳（\"成功\"/\"已完成\"/\"處理中\"/\"失敗\"）。英文收據請將 Successful/Completed/Done/Confirmed 翻譯為 \"成功\"，Processing/Pending 翻譯為 \"處理中\"，Failed/Rejected/Declined 翻譯為 \"失敗\"\n- date: 轉帳日期（YYYY-MM-DD 格式，注意英文日期格式如 23 Feb 2026 / Feb 23, 2026 / 23/02/2026 等都要轉換）\n- time: 轉帳時間（HH:mm:ss 或 HH:mm 格式，24小時制，注意 AM/PM 要轉換為24小時制）\n\n如果某個欄位無法識別，請回傳 null。"
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
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "receipt_info",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    amount: { type: ["string", "null"], description: "轉帳金額" },
                    bank: { type: ["string", "null"], description: "銀行名稱" },
                    status: { type: ["string", "null"], description: "轉帳狀態（成功/失敗/處理中）" },
                    date: { type: ["string", "null"], description: "轉帳日期 YYYY-MM-DD 格式" },
                    time: { type: ["string", "null"], description: "轉帳時間 HH:mm:ss 或 HH:mm 格式" }
                  },
                  required: ["amount", "bank", "status", "date", "time"],
                  additionalProperties: false
                }
              }
            }
          });
          
          const content = ocrResponse.choices[0]?.message?.content;
          if (typeof content === 'string') {
            const ocrData = JSON.parse(content);
            
            // Extract amount
            if (ocrData.amount) {
              const parsedAmount = parseFloat(ocrData.amount.replace(/[^0-9.]/g, ''));
              if (!isNaN(parsedAmount) && parsedAmount > 0) {
                extractedAmount = parsedAmount.toString();
              }
            }
            
            // Extract bank name
            if (ocrData.bank) {
              extractedBank = ocrData.bank;
            }
            
            // Extract transfer status
            if (ocrData.status) {
              extractedStatus = ocrData.status;
            }
            
            // Extract transfer date and time
            if (ocrData.date) {
              const dateStr = ocrData.time ? `${ocrData.date}T${ocrData.time}` : ocrData.date;
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                receiptTransferDate = parsedDate;
              }
              // Store formatted date/time string for frontend display
              extractedDateTime = ocrData.time ? `${ocrData.date} ${ocrData.time}` : ocrData.date;
            }
          }
        } catch (error) {
          console.error("OCR failed:", error);
        }
        
        // 獲取學生的學費金額以驗證 OCR 識別結果
        const student = await getStudentById(input.studentId);
        if (!student) {
          throw new Error("學生不存在");
        }
        
        // 驗證 OCR 識別的金額是否與學費完全相等
        const parsedAmount = parseFloat(extractedAmount);
        const expectedAmount = parseFloat(student.feePerQuarter);
        const isAmountValid = parsedAmount === expectedAmount;
        
        // 只有金額完全相等才設為 confirmed,否則設為 pending 需要人工審核
        const recordStatus = isAmountValid ? "confirmed" : "pending";
        
        await insertPaymentRecord({
          studentId: input.studentId,
          paymentPeriod: input.paymentPeriod,
          customMonths: input.customMonths || null,
          amount: extractedAmount,
          classCount: input.classCount || null, // 精英班堂數
          receiptUrl,
          receiptKey,
          receiptTransferDate,
          paymentDate: new Date(),
          status: recordStatus,
          confirmedBy: 'parent_upload',
        });
        
        return { 
          success: true,
          extractedAmount,
          extractedBank,
          extractedStatus,
          extractedDateTime,
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
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getQuarterlyPaymentStatuses(input?.year);
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
        
        // 季度對應的 paymentPeriod key
        const quarterKey = `Q${quarter}`;
        
        // 獲取所有活躍學生
        const allStudents = await db.select().from(schema.students).where(eq(schema.students.status, 'active'));
        
        // 如果指定教練，過濾出該教練的道場
        let filteredStudents = allStudents;
        if (effectiveCoachName) {
          const dojosWithCoach = await db
            .select()
            .from(schema.dojos)
            .where(eq(schema.dojos.coachName, effectiveCoachName));
          const coachVenues = dojosWithCoach.map(d => d.name);
          filteredStudents = allStudents.filter(s => coachVenues.includes(s.venue));
        }
        
        // 獲取該年度該季度的所有繳費記錄（使用 year 欄位）
        const payments = await db.select()
          .from(schema.paymentRecords)
          .where(
            and(
              eq(schema.paymentRecords.paymentPeriod, quarterKey as any),
              eq(schema.paymentRecords.year, year),
              eq(schema.paymentRecords.status, 'confirmed' as any)
            )
          );
        
        const paidStudentIds = new Set(payments.map(p => p.studentId));
        
        // 過濾出未繳費的學生（排除精英班道場）
        const unpaidStudents = filteredStudents
          .filter(s => !paidStudentIds.has(s.id) && s.venue !== '精英班道場')
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
          totalStudents: filteredStudents.filter(s => s.venue !== '精英班道場').length,
          unpaidCount: unpaidStudents.length,
          paidCount: filteredStudents.filter(s => s.venue !== '精英班道場').length - unpaidStudents.length,
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
        if (ctx.user.role !== 'admin') {
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
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getCoachStatsWithElite();
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
    cancelSchedule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await updateEliteTrainingScheduleStatus(input.id, 'cancelled');
        return { success: true };
      }),
    activateSchedule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
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
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const id = await insertElitePaymentRecord({
          ...input,
          amount: input.amount,
          confirmedBy: input.confirmedBy || 'admin_approved',
        });
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
});

export type AppRouter = typeof appRouter;
