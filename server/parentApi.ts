/**
 * Unified Mobile App REST API
 * 
 * Prefix: /api/v1/parent  (kept for backward compat)
 * Supports ALL roles: parent, coach, admin
 * Login auto-detects role by phone number.
 * 
 * ── PUBLIC ──
 *   POST /login  — unified login (auto-detect role)
 * 
 * ── PARENT ──
 *   GET  /students, /elite-info, /attendance, /monthly-statuses, /payments
 *   POST /payments/upload, /events/register, /events/cancel
 *   GET  /events, /events/my-registrations, /exam-results
 *   POST /change-password
 *   GET  /profile
 * 
 * ── COACH ──
 *   GET  /coach/students            — my students
 *   GET  /coach/attendance          — class attendance (?year=&month=&classGroup=)
 *   POST /coach/attendance          — mark attendance
 *   GET  /coach/statistics          — my statistics
 *   GET  /coach/schedules           — training schedules
 *   GET  /coach/payment-records     — regular class payment records (?year=&quarter=)
 *   GET  /coach/elite-students      — my elite students (with balance & cycle)
 *   GET  /coach/elite-schedules     — elite training schedules (?year=&month=)
 *   GET  /coach/elite-attendance    — elite attendance records (?scheduleId=&studentId=)
 *   POST /coach/elite-attendance    — mark elite attendance
 *   GET  /coach/elite-payments      — elite payment records (?studentId=)
 *   GET  /coach/elite-cycles        — 12-class cycle info
 * 
 * ── ADMIN ──
 *   GET  /admin/students       — all students
 *   POST /admin/students       — create student
 *   PUT  /admin/students/:id   — edit student
 *   DELETE /admin/students/:id — soft-delete student (set inactive)
 *   GET  /admin/users          — all users
 *   POST /admin/users          — create user
 *   PUT  /admin/users/:id      — edit user
 *   DELETE /admin/users/:id    — delete user
 *   GET  /admin/payments       — all payments overview
 *   POST /admin/payments/mark-paid   — confirm payment
 *   POST /admin/payments/unmark-paid — revert to pending
 *   GET  /admin/statistics     — global statistics
 *   GET  /admin/coach-list     — coach user list
 *   GET  /admin/all-coach-statistics — all coaches stats (?year=&quarter=)
 *   GET  /admin/coach-statistics/:coachName — single coach stats
 *   GET  /admin/events         — all events (incl. closed)
 *   POST /admin/events/create  — create event
 *   GET  /admin/finance        — monthly finance report
 *   POST /admin/elite-students — add elite student
 *   PUT  /admin/elite-students/:id  — edit elite student
 *   DELETE /admin/elite-students/:id — disable elite student
 *   POST /admin/elite-payments — add elite payment
 *   PUT  /admin/elite-payments/:id/confirm — confirm payment
 *   GET  /admin/dojos          — list dojos
 *   POST /admin/dojos          — add dojo
 *   PUT  /admin/dojos/:id      — edit dojo
 *   DELETE /admin/dojos/:id    — delete dojo
 *   GET  /admin/exams          — exam sessions
 *   POST /admin/exams          — create exam
 *   PUT  /admin/exams/:id      — edit exam
 *   DELETE /admin/exams/:id    — delete exam
 *   + exam candidates, scoring, schedules, check-in, etc.
 */
import { Router } from "express";
import multer from "multer";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import mysql from "mysql2/promise";
import {
  getStudentsByPhone,
  getEliteStudentsByPhone,
  getParentAttendanceRecords,
  getParentEliteInfo,
  getMonthlyPaymentStatuses,
  getPaymentRecordsByStudentIds,
  insertPaymentRecord,
  getStudentById,
  syncPaymentToAccounting,
  getOpenEvents,
  getEventRegistrations,
  registerForEvent,
  cancelEventRegistration,
  getEventRegistrationCount,
  getAllEvents,
  getExamResultsByPhone,
  getDb,
  getSystemConfig,
  getAcceptedPayeeAccounts,
  // Coach
  getAllStudents,
  getCoachStatistics,
  getTrainingSchedules,
  getAttendanceRecords,
  upsertAttendanceRecord,
  getStudentsByClass,
  getAllClassGroups,
  getCoachStatsWithElite,
  // Coach Elite
  getEliteStudentBalance,
  getEliteCycleInfo,
  getEliteTrainingSchedules,
  getEliteAttendanceRecords,
  upsertEliteAttendanceRecord,
  getElitePaymentRecords,
  // Admin
  getAllUsers,
  getAllCoachUsers,
  getStudentsWithPayments,
  getQuarterlyPaymentStatuses,
  getQuarterlyFeeStatistics,
  getMonthlyFinanceReport,
  getAllEliteStudents,
  getAllEliteClassBalances,
  getAllEliteCycleInfo,
  insertEvent,
  updateEvent,
  deleteEvent,
  updateEventRegistrationStatus,
  getEliteClassStatistics,
  // Admin — Student + Payment helpers
  updateStudent,
  getAllPaymentRecords,
  getPaymentRecordsByStudentIds,
  approvePaymentRecord,
  // Admin CRUD — Elite
  getEliteStudentById,
  insertEliteStudent,
  updateEliteStudent,
  deleteEliteStudent,
  insertElitePaymentRecord,
  syncElitePaymentToAccounting,
  // Admin CRUD — Users
  getUserByPhone,
  updateUserRole,
  // Admin CRUD — Dojos
  getAllDojos,
  getDojoById,
  insertDojo,
  updateDojo,
  deleteDojo,
  // Admin CRUD — Exams
  getAllExamSessions,
  getExamSessionById,
  insertExamSession,
  updateExamSession,
  deleteExamSession,
  getExamCandidatesByExam,
  getExamCandidatesByBelt,
  insertExamCandidate,
  bulkInsertExamCandidates,
  updateExamCandidate,
  deleteExamCandidate,
  getExamScoringItems,
  getExamScoringItemsByBelt,
  upsertExamScore,
  getExamScoresByExam,
  getExamScoresWithItemsByCandidate,
  getExamStatistics,
  calculateExamResult,
  promoteAllPassedCandidates,
  createCandidatesFromEventRegistrations,
  getExamSchedulesByExam,
  insertExamSchedule,
  updateExamSchedule,
  deleteExamSchedule,
  deleteAllExamSchedulesByExam,
  examCheckIn,
  examUndoCheckIn,
  examMarkAbsent,
  searchExamCandidates,
  bulkDeleteExamCandidates,
  // 收據審查
  checkDuplicateReceipt,
  getReceiptReviews,
  getReceiptCompare,
  reviewReceipt,
} from "./db";
import { verifyPassword, hashPassword } from "./password";
import {
  generateToken,
  authMiddleware,
  requireRole,
  type AuthenticatedRequest,
} from "./parentAuth";
import { storagePut } from "./storage";
import { ocrReceipt } from "./_core/localOcr";
import { invokeLLM } from "./_core/llm";
import { stampReceipt } from "./_core/receiptStamp";
import { students as studentsTable, users as usersTable, paymentRecords as paymentRecordsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  notifyEliteClassProgress,
  notifyPaymentConfirmed,
  notifyNewEvent,
  notifyEliteLowBalance,
  notifyExamResult,
  getRawPool as getPushRawPool,
  notifyAdminReviewNeeded,
  notifyParentReviewResult,
  sendPushNotifications,
  queuePushNotification,
  // Push Queue admin functions
  listPushQueue,
  getPushQueueById,
  approvePushQueue,
  rejectPushQueue,
  getPendingPushQueueCount,
  batchApprovePushQueue,
  batchRejectPushQueue,
} from "./pushHelper";

// ── Multer ───────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("只接受圖片檔案"));
  },
});

const parentRouter = Router();

// ── Expo Push + Raw MySQL pool ─────────────────────────────────────────
const expo = new Expo();
let _rawPool: mysql.Pool | null = null;
async function getRawPool() {
  if (!_rawPool && process.env.DATABASE_URL) {
    _rawPool = mysql.createPool({ uri: process.env.DATABASE_URL, charset: "utf8mb4", waitForConnections: true, connectionLimit: 5 });
  }
  return _rawPool;
}

// ── CORS ─────────────────────────────────────────────────────────────────
parentRouter.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC — unified login
// ══════════════════════════════════════════════════════════════════════════

parentRouter.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, error: "請輸入電話號碼和密碼" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });

    // 1) Check users table first (coach / admin)
    const userResult = await db.select().from(usersTable)
      // @ts-ignore
      .where(eq(usersTable.phone, phone)).limit(1);

    if (userResult.length > 0) {
      const user: any = userResult[0];
      let needPasswordChange = false;
      if (!user.password) {
        if (password !== phone) return res.status(401).json({ success: false, error: "密碼錯誤" });
        needPasswordChange = true;
      } else {
        const ok = await verifyPassword(password, user.password);
        if (!ok) return res.status(401).json({ success: false, error: "密碼錯誤" });
      }
      const role = user.role as "coach" | "admin";
      const token = generateToken(phone, role, { userId: user.id, coachName: user.coachName || user.coach_name });
      return res.json({
        success: true, token, role,
        user: { id: user.id, phone: user.phone, role: user.role, coachName: user.coachName || user.coach_name },
        needPasswordChange,
      });
    }

    // 2) Check students table (parent)
    const regularStudents = await getStudentsByPhone(phone);
    const eliteStudentList = await getEliteStudentsByPhone(phone);
    if ((!regularStudents || regularStudents.length === 0) && (!eliteStudentList || eliteStudentList.length === 0)) {
      return res.status(401).json({ success: false, error: "找不到此電話號碼的帳號" });
    }
    const authTarget: any = regularStudents?.length ? regularStudents[0] : eliteStudentList![0];
    let needPasswordChange = false;
    if (!authTarget.password) {
      if (password !== phone) return res.status(401).json({ success: false, error: "密碼錯誤" });
      needPasswordChange = true;
    } else {
      const ok = await verifyPassword(password, authTarget.password);
      if (!ok) return res.status(401).json({ success: false, error: "密碼錯誤" });
    }
    const token = generateToken(phone, "parent");
    return res.json({
      success: true, token, role: "parent",
      students: regularStudents || [],
      hasElite: !!(eliteStudentList && eliteStudentList.length > 0),
      needPasswordChange,
    });
  } catch (err: any) {
    console.error("[AppAPI] login error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  PROTECTED — all routes below require JWT
// ══════════════════════════════════════════════════════════════════════════
parentRouter.use(authMiddleware);

// ── GET /profile (all roles) ─────────────────────────────────────────────
parentRouter.get("/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.userPhone!;
    const role = req.userRole!;

    if (role === "parent") {
      const regular = await getStudentsByPhone(phone);
      const elite = await getEliteStudentsByPhone(phone);
      return res.json({
        phone, role,
        students: (regular || []).map((s: any) => ({ id: s.id, name: s.name, belt: s.belt, venue: s.venue, coach: s.coach })),
        eliteStudents: (elite || []).map((s: any) => ({ id: s.id, name: s.name, beltLevel: s.beltLevel })),
      });
    }

    if (role === "coach") {
      return res.json({
        phone, role,
        userId: req.userId,
        coachName: req.coachName,
      });
    }

    // admin
    return res.json({ phone, role, userId: req.userId });
  } catch (err: any) {
    console.error("[AppAPI] profile error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── POST /change-password (all roles) ────────────────────────────────────
parentRouter.post("/change-password", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.userPhone!;
    const role = req.userRole!;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ success: false, error: "請輸入舊密碼和新密碼" });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: "新密碼至少需要6個字元" });

    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });

    if (role === "parent") {
      const r = await db.select().from(studentsTable).where(eq(studentsTable.phone, phone)).limit(1);
      if (!r.length) return res.status(404).json({ success: false, error: "找不到帳號" });
      const s: any = r[0];
      const ok = !s.password ? oldPassword === phone : await verifyPassword(oldPassword, s.password);
      if (!ok) return res.status(401).json({ success: false, error: "舊密碼錯誤" });
      await db.update(studentsTable).set({ password: await hashPassword(newPassword) } as any).where(eq(studentsTable.phone, phone));
    } else {
      // @ts-ignore
      const r = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
      if (!r.length) return res.status(404).json({ success: false, error: "找不到帳號" });
      const u: any = r[0];
      const ok = !u.password ? oldPassword === phone : await verifyPassword(oldPassword, u.password);
      if (!ok) return res.status(401).json({ success: false, error: "舊密碼錯誤" });
      // @ts-ignore
      await db.update(usersTable).set({ password: await hashPassword(newPassword) }).where(eq(usersTable.phone, phone));
    }
    return res.json({ success: true, message: "密碼已成功修改" });
  } catch (err: any) {
    console.error("[AppAPI] change-password error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  PARENT endpoints
// ══════════════════════════════════════════════════════════════════════════

parentRouter.get("/students", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.userPhone!;
    const regular = await getStudentsByPhone(phone);
    const elite = await getEliteStudentsByPhone(phone);
    return res.json({ students: regular || [], eliteStudents: elite || [] });
  } catch (err: any) { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/elite-info", async (req: AuthenticatedRequest, res) => {
  try { return res.json(await getParentEliteInfo(req.userPhone!)); }
  catch (err: any) { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/attendance", async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    return res.json(await getParentAttendanceRecords(req.userPhone!, year, month));
  } catch (err: any) { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/monthly-statuses", async (req: AuthenticatedRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const all = await getMonthlyPaymentStatuses(year);
    return res.json(all.filter((s: any) => s.phone === req.userPhone));
  } catch (err: any) { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/payments", async (req: AuthenticatedRequest, res) => {
  try {
    const students = await getStudentsByPhone(req.userPhone!);
    if (!students?.length) return res.json([]);
    return res.json(await getPaymentRecordsByStudentIds(students.map((s: any) => s.id)));
  } catch (err: any) { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Receipt upload ───────────────────────────────────────────────────────
parentRouter.post("/payments/upload", upload.single("receipt"), async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.userPhone!;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: "請上傳收據圖片" });
    const { studentId, paymentPeriod, customMonths, amount, classCount } = req.body;
    if (!studentId || !paymentPeriod || !amount) return res.status(400).json({ success: false, error: "缺少必要欄位" });
    const numId = parseInt(studentId);

    // Verify ownership
    const ps = await getStudentsByPhone(phone);
    if (!ps?.some((s: any) => s.id === numId)) return res.status(403).json({ success: false, error: "無權為此學生繳費" });

    const buf = file.buffer, mime = file.mimetype;
    const ext = mime.split("/")[1] || "jpg";
    const rKey = `receipts/${numId}-${Date.now()}.${ext}`;
    const { url: rUrl } = await storagePut(rKey, buf, mime);

    // OCR
    let exAmt = amount, rDate: Date | null = null, exBank: string | null = null;
    let exRecvBank: string | null = null; // 收款方銀行（入數到哪間銀行）
    let exStatus: string | null = null, exDT: string | null = null;
    let exRName: string | null = null, exRAcc: string | null = null;
    const b64 = buf.toString("base64");
    let ocrSucceeded = false;
    try {
      const lr = await ocrReceipt(b64, mime);
      if (lr.amount) { exAmt = lr.amount; ocrSucceeded = true; }
      if (lr.bank) exBank = lr.bank;
      if (lr.receivingBank) exRecvBank = lr.receivingBank;
      if (lr.status) exStatus = lr.status;
      if (lr.recipientName) exRName = lr.recipientName;
      if (lr.recipientAccount) exRAcc = lr.recipientAccount;
      if (lr.date) { const d = new Date(lr.time ? `${lr.date}T${lr.time}` : lr.date); if (!isNaN(d.getTime())) rDate = d; exDT = lr.time ? `${lr.date} ${lr.time}` : lr.date; }
    } catch (localOcrErr) {
      console.warn(`[Receipt][OCR] Local OCR 失敗:`, localOcrErr instanceof Error ? localOcrErr.message : String(localOcrErr));
    }
    if (!exAmt || exAmt === "0" || exAmt === amount) {
      try {
        console.log(`[Receipt][OCR] 使用 LLM OCR 識別收據...`);
        const oR = await invokeLLM({ messages: [{ role: "system", content: '從銀行轉帳收據/截圖提取JSON（不要加markdown標記）:\n{"amount":"轉帳金額","bank":"付款方銀行名稱(即轉帳者使用的銀行，例如:HSBC/滙豐/BOC/中銀/恒生/渣打/ZA Bank)","receivingBank":"收款方銀行名稱(即錢入了哪間銀行帳戶，從收款人帳號的銀行編號判斷，例如:BOC/中銀/HSBC/滙豐/恒生/渣打。如果是FPS/轉數快轉帳且無法判斷收款銀行，填null)","status":"轉帳狀態","date":"YYYY-MM-DD","time":"HH:mm","recipientName":"收款人名稱","recipientAccount":"收款人帳號"}\n注意：\n1. bank = 付款方/轉出方使用的銀行。如果截圖來自某銀行App（如HSBC App），bank就是該銀行。如果是FPS/PayMe轉帳，bank填轉出的銀行名。\n2. receivingBank = 收款方的銀行。根據收款帳號前3位判斷：012=中銀BOC, 004=HSBC滙豐, 024=恒生, 003=渣打。或從收據上「收款銀行」欄位識別。這是對帳時最重要的欄位。\n3. 如果是FPS轉帳且只有FPS ID沒有銀行帳號，receivingBank可填null。' }, { role: "user", content: [{ type: "text", text: "請識別這張收據的金額、付款銀行、收款銀行、收款人資訊:" }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } }] }] });
        const c = oR.choices[0]?.message?.content;
        if (typeof c === "string") {
          const d = JSON.parse(c.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
          console.log(`[Receipt][OCR] LLM 解析結果:`, JSON.stringify(d));
          if (d.amount) { const p = parseFloat(d.amount.replace(/[^0-9.]/g, "")); if (!isNaN(p) && p > 0) { exAmt = p.toString(); ocrSucceeded = true; } }
          if (d.bank) exBank = d.bank;
          if (d.receivingBank) exRecvBank = d.receivingBank;
          if (d.recipientName) exRName = d.recipientName;
          if (d.recipientAccount) exRAcc = d.recipientAccount;
          if (d.date) { const pd = new Date(d.time ? `${d.date}T${d.time}` : d.date); if (!isNaN(pd.getTime())) rDate = pd; }
        }
      } catch (llmErr) {
        console.warn(`[Receipt][OCR] LLM OCR 也失敗:`, llmErr instanceof Error ? llmErr.message : String(llmErr));
        console.log(`[Receipt][OCR] OCR 全部失敗，使用家長提交金額: $${amount}`);
        exAmt = amount;
      }
    }

    const student = await getStudentById(numId);
    if (!student) return res.status(404).json({ success: false, error: "學生不存在" });

    let sUrl = rUrl, sKey = rKey;
    try { const cm = customMonths ? JSON.parse(customMonths) : undefined; const sb = await stampReceipt(buf, mime, { studentName: student.name, amount: exAmt || amount, paymentPeriod, customMonths: cm, dojoName: student.venue || undefined }); const sk = `receipts/stamped-${numId}-${Date.now()}.${ext}`; const sr = await storagePut(sk, sb, mime); sUrl = sr.url; sKey = sk; } catch {}

    const pAmt = parseFloat(exAmt), feeQ = parseFloat(student.feePerQuarter);
    const monthlyFee = Math.round((feeQ / 3) * 100) / 100;
    let amtOk = false;
    if (paymentPeriod === 'CUSTOM') {
      // CUSTOM: 允許月費的 1~12 倍
      if (monthlyFee > 0) { const mc = Math.round(pAmt / monthlyFee); amtOk = mc >= 1 && mc <= 12 && Math.abs(pAmt - monthlyFee * mc) < 1; }
    } else {
      amtOk = Math.abs(pAmt - feeQ) < 1;
    }
    let rcpOk = false, rcpNote = "";
    try { const v = await getSystemConfig("receipt_validation_enabled"); if (v === "true") { const acc = await getAcceptedPayeeAccounts(); if (!acc.length) rcpOk = true; else if (!ocrSucceeded) { rcpOk = true; console.log(`[Receipt] OCR 失敗，跳過收款人驗證`); } else { for (const a of acc) { if ((exRAcc && a.account && (exRAcc.includes(a.account) || a.account.includes(exRAcc))) || (exRName && a.name && (exRName.toUpperCase().includes(a.name.toUpperCase()) || a.name.toUpperCase().includes(exRName.toUpperCase())))) { rcpOk = true; break; } } if (!rcpOk) rcpNote = `收款人不匹配`; } } else rcpOk = true; } catch { rcpOk = true; }

    let reason = ""; if (!amtOk) reason += `金額不符`; if (!rcpOk) { if (reason) reason += "; "; reason += rcpNote; }
    const st = amtOk && rcpOk ? "confirmed" : "pending";
    const cm2 = customMonths ? JSON.parse(customMonths) : null;

    // ── 驗證失敗 + 重複收據檢測 → 統一進入審查流程 ──
    let needsReview = false;
    let reviewReason = '';
    let reviewMatchType: string | null = null;
    let reviewMatchPaymentId: number | null = null;
    // 金額不符或收款人不匹配 → 需要人工審查
    if (st === 'pending' && reason) {
      needsReview = true;
      reviewReason = reason;
      reviewMatchType = 'validation_failed';
      console.log(`[ReceiptReview] 驗證失敗需審查: ${reason}`);
    }
    const dupCheck = await checkDuplicateReceipt({ studentId: numId, amount: exAmt, receiptTransferDate: rDate, receiptKey: sKey, paymentType: 'regular' });
    if (dupCheck.isDuplicate) {
      needsReview = true;
      reviewMatchType = dupCheck.matchType;
      reviewMatchPaymentId = dupCheck.matchPaymentId;
      reviewReason = reviewReason
        ? `${reviewReason}; ${dupCheck.reason || '疑似重複收據'}`
        : (dupCheck.reason || '疑似重複收據');
      console.log(`[ReceiptReview] 偵測到疑似重複: ${reviewReason}`);
    }

    const pid = await insertPaymentRecord({ studentId: numId, paymentPeriod, customMonths: cm2, amount: exAmt, classCount: classCount ? parseInt(classCount) : null, receiptUrl: sUrl, receiptKey: sKey, receiptTransferDate: rDate, bank: exBank || null, receivingBank: exRecvBank || null, paymentDate: new Date(), status: needsReview ? 'pending' : st, confirmedBy: "parent_upload", reviewStatus: needsReview ? 'pending_review' : 'normal', reviewReason: needsReview ? reviewReason : (reason || null), reviewMatchType, reviewMatchPaymentId });
    if (st === "confirmed" && !needsReview) { try { await syncPaymentToAccounting({ paymentRecordId: pid, transactionDate: rDate || new Date(), amount: exAmt, bank: exBank, receivingBank: exRecvBank, studentName: student.name, coachName: student.coach, dojoName: student.venue || null, category: "tuition", receiptUrl: sUrl, receiptKey: sKey }); } catch (syncErr) { console.error("[AppAPI] 上傳後自動同步會計失敗:", syncErr); } }

    // 通知管理員審查
    if (needsReview) {
      notifyAdminReviewNeeded({ studentName: student.name, amount: exAmt, matchType: reviewMatchType || 'unknown', reason: reviewReason }).catch(() => {});
    }

    return res.json({ success: true, extractedAmount: exAmt, extractedBank: exBank, extractedReceivingBank: exRecvBank, status: needsReview ? 'pending' : st, pendingReason: reason || undefined, needsReview, reviewReason: needsReview ? reviewReason : undefined });
  } catch (err: any) { console.error("[AppAPI] upload error:", err); return res.status(500).json({ success: false, error: "上傳失敗" }); }
});

parentRouter.get("/events", async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getOpenEvents()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/events/my-registrations", async (req: AuthenticatedRequest, res) => {
  try { return res.json(await getEventRegistrations(undefined, req.userPhone!)); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/events/register", async (req: AuthenticatedRequest, res) => {
  try {
    const { eventId, studentId, eliteStudentId, studentName, notes } = req.body;
    if (!eventId || !studentName) return res.status(400).json({ success: false, error: "缺少必要欄位" });
    const existing = await getEventRegistrations(eventId, req.userPhone!);
    if (existing.find((r: any) => r.studentName === studentName && r.status !== "cancelled")) return res.status(409).json({ success: false, error: "該學生已報名此活動" });
    const cnt = await getEventRegistrationCount(eventId);
    const evts = await getAllEvents();
    const evt = evts.find((e: any) => e.id === eventId);
    if (evt?.maxParticipants && cnt >= evt.maxParticipants) return res.status(409).json({ success: false, error: "報名人數已滿" });
    const r = await registerForEvent({ eventId, studentId: studentId || null, eliteStudentId: eliteStudentId || null, studentName, phone: req.userPhone!, status: "registered", notes: notes || null });
    return res.json({ success: true, id: r.insertId });
  } catch (err: any) { return res.status(500).json({ success: false, error: "系統錯誤" }); }
});

parentRouter.post("/events/cancel", async (req: AuthenticatedRequest, res) => {
  try { const { id } = req.body; if (!id) return res.status(400).json({ success: false, error: "缺少報名ID" }); await cancelEventRegistration(id); return res.json({ success: true }); }
  catch { return res.status(500).json({ success: false, error: "系統錯誤" }); }
});

parentRouter.get("/exam-results", async (req: AuthenticatedRequest, res) => {
  try { return res.json(await getExamResultsByPhone(req.userPhone!)); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ══════════════════════════════════════════════════════════════════════════
//  COACH endpoints
// ══════════════════════════════════════════════════════════════════════════

parentRouter.get("/coach/students", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const all = await getAllStudents();
    if (req.userRole === "coach" && req.coachName) {
      return res.json(all.filter((s: any) => s.coach === req.coachName));
    }
    return res.json(all);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/coach/statistics", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = req.userRole === "coach" ? req.coachName : (req.query.coachName as string) || undefined;
    // ✅ 支援按月份篩選：月份自動轉成季度
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const quarter = month ? Math.ceil(month / 3) : (req.query.quarter ? Number(req.query.quarter) : undefined);
    
    const allStats = await getCoachStatsWithElite(year, quarter);
    if (coachName) {
      const myStats = allStats.find((s: any) => s.coachName === coachName);
      return res.json(myStats || { coachName, regularStudentCount: 0, eliteStudentCount: 0, totalStudentCount: 0, totalRevenue: 0, eliteStudents: [] });
    }
    return res.json(allStats);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/coach/class-groups", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const allGroups = await getAllClassGroups();
    if (req.userRole === "coach" && req.coachName) {
      // 教練只看自己的班級：先找出自己的學生的 venue+day+time 組合
      const myStudents = (await getAllStudents()).filter((s: any) => s.coach === req.coachName);
      const myKeys = new Set(myStudents.map((s: any) => `${s.venue}-${s.scheduleDay}-${s.scheduleTime}`));
      return res.json(allGroups.filter((g: any) => myKeys.has(`${g.venue}-${g.scheduleDay}-${g.scheduleTime}`)));
    }
    return res.json(allGroups);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/coach/schedules", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const schedules = await getTrainingSchedules({ year, month });
    if (req.userRole === "coach" && req.coachName) {
      // 教練只看自己負責的班級排程
      const myStudents = (await getAllStudents()).filter((s: any) => s.coach === req.coachName);
      const myKeys = new Set(myStudents.map((s: any) => `${s.venue}-${s.scheduleDay}-${s.scheduleTime}`));
      return res.json(schedules.filter((s: any) => myKeys.has(`${s.venue}-${s.scheduleDay}-${s.scheduleTime}`)));
    }
    return res.json(schedules);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/coach/attendance", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const scheduleId = req.query.scheduleId ? parseInt(req.query.scheduleId as string) : undefined;
    const records = await getAttendanceRecords({ courseId: scheduleId });
    return res.json(records);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// 📊 整月點名表格 API — 返回整個班級一個月的所有點名資料
parentRouter.get("/coach/attendance-grid", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const venue = req.query.venue as string;
    const scheduleDay = req.query.scheduleDay as string;
    const scheduleTime = req.query.scheduleTime as string;

    if (!venue || !scheduleDay || !scheduleTime) {
      return res.status(400).json({ error: "需要 venue, scheduleDay, scheduleTime 參數" });
    }

    // 1. 取得該班級本月所有排程
    const allSchedules = await getTrainingSchedules({ year, month, venue, scheduleDay, scheduleTime });
    const schedules = allSchedules
      .filter((s: any) => s.status !== "cancelled")
      .sort((a: any, b: any) => new Date(a.trainingDate).getTime() - new Date(b.trainingDate).getTime());

    // 2. 取得該班級的所有學生
    const allStudents = await getAllStudents();
    const students = allStudents
      .filter((s: any) => s.venue === venue && s.scheduleDay === scheduleDay && s.scheduleTime === scheduleTime && s.status === "active")
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", "zh-TW"));

    // 3. 取得這些排程的所有點名記錄 — 使用 schedule_id 直接查詢
    const db = await getDb();
    let records: any[] = [];
    if (db && schedules.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const { attendanceRecords: arTable } = await import("../drizzle/schema");

      const scheduleIds = schedules.map((s: any) => s.id);
      records = await db.select().from(arTable).where(
        inArray(arTable.scheduleId, scheduleIds)
      );
    }

    // 4. 構造 map: { `${scheduleId}-${studentId}`: status }
    const attendanceMap: Record<string, string> = {};
    for (const r of records) {
      if (r.scheduleId) {
        attendanceMap[`${r.scheduleId}-${r.studentId}`] = r.status;
      } else {
        // 向後兼容：舊記錄沒有 scheduleId，用 attendanceDate 匹配
        const rDate = new Date(r.attendanceDate).toISOString().slice(0, 10);
        const matchedSch = schedules.find((s: any) => new Date(s.trainingDate).toISOString().slice(0, 10) === rDate);
        if (matchedSch) {
          attendanceMap[`${matchedSch.id}-${r.studentId}`] = r.status;
        }
      }
    }

    return res.json({
      schedules: schedules.map((s: any) => ({
        id: s.id,
        date: s.trainingDate,
        day: s.scheduleDay,
      })),
      students: students.map((s: any) => ({
        id: s.id,
        name: s.name,
        belt: s.belt || "",
      })),
      attendance: attendanceMap,
    });
  } catch (err: any) {
    console.error("attendance-grid error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

parentRouter.post("/coach/attendance", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { scheduleId, studentId, status } = req.body;
    if (!scheduleId || !studentId || !status) return res.status(400).json({ success: false, error: "缺少必要欄位" });

    // 取得排程資訊
    const allSchedules = await getTrainingSchedules({});
    const schedule = allSchedules.find((s: any) => s.id === scheduleId);
    if (!schedule) return res.status(404).json({ success: false, error: "排程不存在" });

    const attendanceDate = new Date(schedule.trainingDate);

    // 直接使用 scheduleId + studentId 做唯一定位（不再依賴 courses 表）
    await upsertAttendanceRecord(studentId, scheduleId, attendanceDate, status);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("mark-attendance error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ── COACH ELITE endpoints ─────────────────────────────────────────────────

// 1. GET /coach/elite-students — 教練的精英班學生
parentRouter.get("/coach/elite-students", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = req.userRole === "coach" ? req.coachName : (req.query.coachName as string) || undefined;
    const allElite = await getAllEliteStudents();
    const filtered = coachName ? allElite.filter((s: any) => s.status === "active" && s.coach === coachName) : allElite.filter((s: any) => s.status === "active");

    // 為每個學生附加餘額和循環資訊
    const results = await Promise.all(filtered.map(async (s: any) => {
      const balance = await getEliteStudentBalance(s.id);
      const cycle = await getEliteCycleInfo(s.id);
      return {
        ...s,
        balance: balance ? { paidClasses: balance.paidClasses, attendedClasses: balance.attendedClasses, remainingClasses: balance.remainingClasses, totalPaid: balance.totalPaid, amountDue: balance.amountDue } : null,
        cycle: cycle ? { cycleNumber: cycle.cycleNumber, completedCycles: cycle.completedCycles, needPaymentReminder: cycle.needPaymentReminder, lastAttendedDate: cycle.lastAttendedDate } : null,
      };
    }));
    return res.json(results);
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-students error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 2. GET /coach/elite-schedules — 精英班訓練日期
parentRouter.get("/coach/elite-schedules", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const schedules = await getEliteTrainingSchedules({ year, month, status: "active" });
    return res.json(schedules);
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-schedules error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 3. GET /coach/elite-attendance — 精英班出席記錄
parentRouter.get("/coach/elite-attendance", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const scheduleId = req.query.scheduleId ? parseInt(req.query.scheduleId as string) : undefined;
    const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
    const records = await getEliteAttendanceRecords({ scheduleId, studentId });
    return res.json(records);
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-attendance error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 4. POST /coach/elite-attendance — 精英班點名
parentRouter.post("/coach/elite-attendance", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { scheduleId, studentId, status } = req.body;
    if (!scheduleId || !studentId || !status) return res.status(400).json({ success: false, error: "缺少必要欄位" });
    if (!["present", "absent", "late", "excused"].includes(status)) return res.status(400).json({ success: false, error: "無效的狀態" });

    // 驗證教練權限：教練只能為自己的精英班學生點名
    if (req.userRole === "coach" && req.coachName) {
      const allElite = await getAllEliteStudents();
      const student = allElite.find((s: any) => s.id === studentId);
      if (!student || student.coach !== req.coachName) {
        return res.status(403).json({ success: false, error: "您只能為自己的精英班學生點名" });
      }
    }

    const id = await upsertEliteAttendanceRecord({ scheduleId, studentId, status });

    // ✅ 自動推播：出席時通知家長進度 + 檢查剩餘堂數
    if (status === "present" || status === "late") {
      try {
        const student = (await getAllEliteStudents()).find((s: any) => s.id === studentId);
        if (student) {
          const cycle = await getEliteCycleInfo(studentId);
          const balance = await getEliteStudentBalance(studentId);
          // 通知上課進度
          if (cycle) {
            await notifyEliteClassProgress(
              studentId, student.name,
              cycle.cycleNumber || 0, balance?.attendedClasses || 0,
              req.userPhone || "system"
            );
          }
          // 檢查剩餘堂數 ≤ 2
          if (balance && balance.remainingClasses <= 2 && balance.remainingClasses >= 0) {
            await notifyEliteLowBalance(
              studentId, student.name,
              balance.remainingClasses,
              req.userPhone || "system"
            );
          }
        }
      } catch (pushErr) { console.error("[AutoPush] elite-attendance:", pushErr); }
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-attendance POST error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// 5. GET /coach/elite-payments — 精英班繳費記錄
parentRouter.get("/coach/elite-payments", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
    const coachName = req.userRole === "coach" ? req.coachName : undefined;

    // 如果查特定學生，先驗證是否屬於該教練
    if (studentId && coachName) {
      const allElite = await getAllEliteStudents();
      const student = allElite.find((s: any) => s.id === studentId);
      if (!student || student.coach !== coachName) {
        return res.status(403).json({ error: "您只能查看自己的精英班學生繳費" });
      }
    }

    let payments = await getElitePaymentRecords(studentId);

    // 教練：只返回自己學生的繳費記錄
    if (!studentId && coachName) {
      const allElite = await getAllEliteStudents();
      const myStudentIds = new Set(allElite.filter((s: any) => s.coach === coachName).map((s: any) => s.id));
      payments = payments.filter((p: any) => myStudentIds.has(p.studentId));
    }

    return res.json(payments);
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-payments error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 6. GET /coach/elite-cycles — 精英班 12 堂循環資訊
parentRouter.get("/coach/elite-cycles", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = req.userRole === "coach" ? req.coachName : undefined;
    const allElite = await getAllEliteStudents();
    const activeStudents = coachName
      ? allElite.filter((s: any) => s.status === "active" && s.coach === coachName)
      : allElite.filter((s: any) => s.status === "active");

    const results = await Promise.all(activeStudents.map((s: any) => getEliteCycleInfo(s.id)));
    return res.json(results.filter(r => r !== null));
  } catch (err: any) {
    console.error("[AppAPI] coach/elite-cycles error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN endpoints
// ══════════════════════════════════════════════════════════════════════════

parentRouter.get("/admin/students", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllStudents()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/elite-students", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllEliteStudents()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/users", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllUsers()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/coaches", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllCoachUsers()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/payments-overview", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    return res.json(await getMonthlyPaymentStatuses(year));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/quarterly-stats", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const quarter = parseInt(req.query.quarter as string) || 1;
    return res.json(await getQuarterlyFeeStatistics(year, quarter));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/statistics", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = req.query.coachName as string || undefined;
    return res.json(await getCoachStatsWithElite(coachName));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/finance", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    return res.json(await getMonthlyFinanceReport(year, month));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/elite-balances", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllEliteClassBalances()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/elite-cycles", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllEliteCycleInfo()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/elite-stats", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getEliteClassStatistics()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/events", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const type = req.query.type as string || undefined;
    const status = req.query.status as string || undefined;
    return res.json(await getAllEvents({ type, status }));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/events/create", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, type, description, eventDate, eventTime, location, fee, maxParticipants, registrationDeadline } = req.body;
    if (!title || !type || !eventDate) return res.status(400).json({ success: false, error: "缺少必要欄位" });
    const result = await insertEvent({ title, type, description: description || null, eventDate: new Date(eventDate), eventTime: eventTime || null, location: location || null, fee: fee || "0", maxParticipants: maxParticipants || null, registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null, status: "open" });

    // ✅ 自動推播：通知所有家長新活動
    try {
      const dateStr = eventDate ? new Date(eventDate).toLocaleDateString("zh-TW") : null;
      await notifyNewEvent(title, dateStr, req.userPhone || "admin");
    } catch (pushErr) { console.error("[AutoPush] new-event:", pushErr); }

    return res.json({ success: true, id: result.insertId });
  } catch { return res.status(500).json({ success: false, error: "系統錯誤" }); }
});

parentRouter.get("/admin/event-registrations", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
    return res.json(await getEventRegistrations(eventId));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Admin CRUD: Elite Students ─────────────────────────────────────────
parentRouter.post("/admin/elite-students", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, phone, beltLevel, coach, scheduleDay, scheduleTime, feePerClass, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: "姓名和電話為必填" });
    const id = await insertEliteStudent({ name, phone, password: null, beltLevel: beltLevel || null, coach: coach || null, scheduleDay: scheduleDay || null, scheduleTime: scheduleTime || null, feePerClass: feePerClass || "200", remainingClasses: 0, status: "active", joinDate: new Date(), notes: notes || null } as any);
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("[AppAPI] admin/elite-students POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/elite-students/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, beltLevel, coach, scheduleDay, scheduleTime, feePerClass, status, notes } = req.body;
    await updateEliteStudent(id, { name, phone, beltLevel, coach, scheduleDay, scheduleTime, feePerClass, status, notes } as any);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/elite-students PUT error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/elite-students/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await deleteEliteStudent(id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/elite-students DELETE error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin CRUD: Elite Payments ─────────────────────────────────────────
parentRouter.post("/admin/elite-payments", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { studentId, classCount, amount, paymentDate, notes } = req.body;
    if (!studentId || !classCount || !amount) return res.status(400).json({ success: false, error: "缺少必填欄位" });
    const id = await insertElitePaymentRecord({ studentId, classCount, amount, paymentDate: paymentDate ? new Date(paymentDate) : new Date(), status: "pending", notes: notes || null } as any);
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error("[AppAPI] admin/elite-payments POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/elite-payments/:id/confirm", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = parseInt(req.params.id);
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });
    await pool.execute(
      "UPDATE elite_payments SET status = 'confirmed', confirmed_by = ? WHERE id = ?",
      [req.userPhone || "admin", paymentId]
    );
    // Sync to accounting
    try {
      const [rows] = await pool.execute("SELECT * FROM elite_payments WHERE id = ?", [paymentId]) as any;
      if (rows.length > 0) {
        const p = rows[0];
        const student = await getEliteStudentById(p.student_id || p.studentId);
        if (student) {
          await syncElitePaymentToAccounting({
            elitePaymentRecordId: paymentId,
            transactionDate: p.payment_date || p.paymentDate || new Date(),
            amount: String(p.amount),
            studentName: student.name,
            coachName: student.coach,
            dojoName: '精英班',
          });
          // ✅ 自動推播：精英班繳費確認通知家長
          try {
            await notifyPaymentConfirmed(
              Number(student.id), "elite",
              student.name, String(p.amount),
              req.userPhone || "admin"
            );
          } catch (pushErr) { console.error("[AutoPush] elite-payment-confirm:", pushErr); }
        }
      }
    } catch (syncErr) { console.error("[AppAPI] elite payment sync error:", syncErr); }
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/elite-payments confirm error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin CRUD: Users ──────────────────────────────────────────────────
parentRouter.post("/admin/users", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, phone, role, email, coachName } = req.body;
    if (!name || !phone || !role) return res.status(400).json({ success: false, error: "姓名、電話和角色為必填" });
    if (!["admin", "coach"].includes(role)) return res.status(400).json({ success: false, error: "角色只能是 admin 或 coach" });
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });
    // Check duplicate phone
    const existing = await getUserByPhone(phone);
    if (existing) return res.status(400).json({ success: false, error: "此電話號碼已存在" });
    const hashedPw = await hashPassword(phone); // default password = phone
    const result = await db.insert(usersTable).values({
      openId: `app_${phone}_${Date.now()}`,
      name, phone, password: hashedPw, role: role as any,
      email: email || null, coachName: coachName || null,
    } as any);
    return res.json({ success: true, id: (result as any)[0]?.insertId || (result as any).insertId });
  } catch (err: any) {
    console.error("[AppAPI] admin/users POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/users/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, role, email, coachName } = req.body;
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (email !== undefined) updateData.email = email;
    if (coachName !== undefined) updateData.coachName = coachName;
    await db.update(usersTable).set(updateData).where(eq(usersTable.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/users PUT error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/users/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/users DELETE error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin CRUD: Dojos ──────────────────────────────────────────────────
parentRouter.get("/admin/dojos", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllDojos()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/dojos", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, scheduleDay, scheduleTime, coachName, color, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "道場名稱為必填" });
    const result = await insertDojo({ name, scheduleDay: scheduleDay || null, scheduleTime: scheduleTime || null, coachName: coachName || null, color: color || null, status: status || "active" } as any);
    return res.json({ success: true, id: (result as any)?.insertId || (result as any)?.[0]?.insertId });
  } catch (err: any) {
    console.error("[AppAPI] admin/dojos POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/dojos/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, scheduleDay, scheduleTime, coachName, color, status } = req.body;
    await updateDojo(id, { name, scheduleDay, scheduleTime, coachName, color, status } as any);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/dojos PUT error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/dojos/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await deleteDojo(id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/dojos DELETE error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin: Coach Dojos (also for coach) ────────────────────────────────
parentRouter.get("/coach/dojos", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const all = await getAllDojos();
    if (req.userRole === "coach" && req.coachName) {
      return res.json(all.filter((d: any) => d.coachName === req.coachName));
    }
    return res.json(all);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Admin CRUD: Exams — Sessions ───────────────────────────────────────
parentRouter.get("/admin/exams", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try { return res.json(await getAllExamSessions()); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.get("/admin/exams/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try { return res.json(await getExamSessionById(parseInt(req.params.id))); } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/exams", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, examDate, location, description, status } = req.body;
    if (!title || !examDate) return res.status(400).json({ success: false, error: "考試名稱和日期為必填" });
    const result = await insertExamSession({ title, examDate: new Date(examDate), location: location || null, description: description || null, status: status || "upcoming" } as any);

    // ✅ 自動推播：非草稿考試通知所有家長
    if (!status || status !== "draft") {
      try {
        const dateStr = new Date(examDate).toLocaleDateString("zh-TW");
        await notifyNewEvent(`升級考試：${title}`, dateStr, req.userPhone || "admin");
      } catch (pushErr) { console.error("[AutoPush] new-exam:", pushErr); }
    }

    return res.json({ success: true, id: result.insertId });
  } catch (err: any) {
    console.error("[AppAPI] admin/exams POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/exams/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, examDate, location, description, status } = req.body;
    const update: any = {};
    if (title !== undefined) update.title = title;
    if (examDate !== undefined) update.examDate = new Date(examDate);
    if (location !== undefined) update.location = location;
    if (description !== undefined) update.description = description;
    if (status !== undefined) update.status = status;
    await updateExamSession(id, update);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/exams PUT error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/exams/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    await deleteExamSession(parseInt(req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/exams DELETE error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin CRUD: Exam Candidates ────────────────────────────────────────
parentRouter.get("/admin/exam-candidates", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const examId = parseInt(req.query.examId as string);
    const belt = req.query.belt as string;
    if (!examId) return res.status(400).json({ error: "examId 為必填" });
    if (belt) return res.json(await getExamCandidatesByBelt(examId, belt));
    return res.json(await getExamCandidatesByExam(examId));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/exam-candidates", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { examId, studentId, studentName, currentBelt, targetBelt, phone } = req.body;
    if (!examId) return res.status(400).json({ success: false, error: "examId 為必填" });
    const result = await insertExamCandidate({ examId, studentId: studentId || null, studentName: studentName || null, currentBelt: currentBelt || null, targetBelt: targetBelt || null, phone: phone || null } as any);
    return res.json({ success: true, id: result.insertId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.post("/admin/exam-candidates/bulk", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) return res.status(400).json({ success: false, error: "candidates 不能為空" });
    const count = await bulkInsertExamCandidates(candidates);
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.post("/admin/exam-candidates/from-event", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { examId, eventId } = req.body;
    if (!examId || !eventId) return res.status(400).json({ success: false, error: "examId 和 eventId 為必填" });
    const count = await createCandidatesFromEventRegistrations(examId, eventId);
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/exam-candidates/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await updateExamCandidate(id, req.body);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/exam-candidates/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    await deleteExamCandidate(parseInt(req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.post("/admin/exam-candidates/bulk-delete", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: "ids 不能為空" });
    await bulkDeleteExamCandidates(ids);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.get("/admin/exam-candidates/search", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const examId = parseInt(req.query.examId as string);
    const query = req.query.q as string;
    if (!examId || !query) return res.status(400).json({ error: "examId 和 q 為必填" });
    return res.json(await searchExamCandidates(examId, query));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Admin: Exam Check-in ───────────────────────────────────────────────
parentRouter.post("/admin/exam-checkin/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try { await examCheckIn(parseInt(req.params.id)); return res.json({ success: true }); }
  catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.post("/admin/exam-undo-checkin/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try { await examUndoCheckIn(parseInt(req.params.id)); return res.json({ success: true }); }
  catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.post("/admin/exam-mark-absent/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const absent = req.body.absent !== undefined ? req.body.absent : true;
    await examMarkAbsent(parseInt(req.params.id), absent);
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

// ── Admin CRUD: Exam Scoring Items ─────────────────────────────────────
parentRouter.get("/admin/exam-scoring-items", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const belt = req.query.belt as string;
    if (belt) return res.json(await getExamScoringItemsByBelt(belt));
    return res.json(await getExamScoringItems());
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Admin: Exam Scores ─────────────────────────────────────────────────
parentRouter.get("/admin/exam-scores", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const examId = req.query.examId ? parseInt(req.query.examId as string) : undefined;
    const candidateId = req.query.candidateId ? parseInt(req.query.candidateId as string) : undefined;
    if (candidateId) return res.json(await getExamScoresWithItemsByCandidate(candidateId));
    if (examId) return res.json(await getExamScoresByExam(examId));
    return res.status(400).json({ error: "需要 examId 或 candidateId" });
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/exam-scores", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { candidateId, scoringItemId, score, comment } = req.body;
    if (!candidateId || !scoringItemId || score === undefined) return res.status(400).json({ success: false, error: "缺少必填欄位" });
    await upsertExamScore({ candidateId, scoringItemId, score: String(score), comment: comment || null, scoredBy: req.userPhone || "admin" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin: Exam Statistics & Results ───────────────────────────────────
parentRouter.get("/admin/exam-statistics/:examId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try { return res.json(await getExamStatistics(parseInt(req.params.examId))); }
  catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/exam-calculate/:candidateId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const candidateId = parseInt(req.params.candidateId);
    const result = await calculateExamResult(candidateId);

    // ✅ 自動推播：考試成績通知家長
    try {
      const pool = await getRawPool();
      if (pool) {
        const [rows] = await pool.execute(
          `SELECT ec.student_name as studentName, ec.phone, ec.student_id,
                  es.title as examName,
                  ec.result
           FROM exam_candidates ec
           JOIN exam_sessions es ON ec.exam_id = es.id
           WHERE ec.id = ?`,
          [candidateId]
        ) as any;
        if (rows.length > 0) {
          const c = rows[0];
          const passed = (result as any).result === "passed" || (result as any).passed === true;
          if (c.student_id || c.studentId) {
            await notifyExamResult(
              c.student_id || c.studentId,
              c.examName || "考試", c.studentName || "學生",
              passed,
              req.userPhone || "admin"
            );
          }
        }
      }
    } catch (pushErr) { console.error("[AutoPush] exam-result:", pushErr); }

    return res.json({ success: true, ...result });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.post("/admin/exam-promote/:examId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await promoteAllPassedCandidates(parseInt(req.params.examId));
    return res.json({ success: true, ...result });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

// ── Admin CRUD: Exam Schedules ─────────────────────────────────────────
parentRouter.get("/admin/exam-schedules", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const examId = parseInt(req.query.examId as string);
    if (!examId) return res.status(400).json({ error: "examId 為必填" });
    return res.json(await getExamSchedulesByExam(examId));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

parentRouter.post("/admin/exam-schedules", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await insertExamSchedule(req.body);
    return res.json({ success: true, id: (result as any)?.insertId || (result as any)?.[0]?.insertId });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.put("/admin/exam-schedules/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    await updateExamSchedule(parseInt(req.params.id), req.body);
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.delete("/admin/exam-schedules/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    await deleteExamSchedule(parseInt(req.params.id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

parentRouter.delete("/admin/exam-schedules/exam/:examId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    await deleteAllExamSchedulesByExam(parseInt(req.params.examId));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message || "系統錯誤" }); }
});

// ── Coach: Payment Records (regular class) ──────────────────────────────
parentRouter.get("/coach/payment-records", requireRole("coach", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = req.userRole === "coach" ? req.coachName : (req.query.coachName as string) || undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;

    // 取得教練的學生
    const allStudents = await getAllStudents();
    const myStudents = coachName ? allStudents.filter((s: any) => s.coach === coachName && s.status === "active") : allStudents.filter((s: any) => s.status === "active");
    const studentIds = myStudents.map((s: any) => s.id);
    if (studentIds.length === 0) return res.json([]);

    const allPayments = await getPaymentRecordsByStudentIds(studentIds);

    // 按年份 + 季度篩選
    const filtered = allPayments.filter((p: any) => {
      if (!p.paymentDate) return false;
      const d = new Date(p.paymentDate);
      if (d.getFullYear() !== year) return false;
      if (quarter) {
        const qMap: Record<number, number[]> = { 1: [1,2,3], 2: [4,5,6], 3: [7,8,9], 4: [10,11,12] };
        if (!qMap[quarter]?.includes(d.getMonth() + 1)) return false;
      }
      return true;
    });

    // 附加學生姓名
    const studentMap = new Map(myStudents.map((s: any) => [s.id, s]));
    const result = filtered.map((p: any) => {
      const stu = studentMap.get(p.studentId);
      return { ...p, studentName: stu?.name || "未知", studentVenue: stu?.venue || "", studentCoach: stu?.coach || "" };
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[AppAPI] coach/payment-records error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── Admin CRUD: Students (regular) ──────────────────────────────────────
parentRouter.post("/admin/students", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, phone, venue, scheduleDay, scheduleTime, coach, beltLevel, feePerQuarter, status, notes, studentNumber, gender, email, dojoId } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: "姓名和電話為必填" });
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });
    const result = await db.insert(studentsTable).values({
      name, phone, venue: venue || null, scheduleDay: scheduleDay || null, scheduleTime: scheduleTime || null,
      coach: coach || null, belt: beltLevel || null, feePerQuarter: feePerQuarter || "0",
      status: status || "active", notes: notes || null, studentNumber: studentNumber || null,
      gender: gender || null, email: email || null, dojoId: dojoId || null,
    } as any);
    return res.json({ success: true, id: (result as any)[0]?.insertId || (result as any).insertId });
  } catch (err: any) {
    console.error("[AppAPI] admin/students POST error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.put("/admin/students/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, venue, scheduleDay, scheduleTime, coach, beltLevel, feePerQuarter, status, notes, studentNumber, gender, email, dojoId } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (venue !== undefined) updateData.venue = venue;
    if (scheduleDay !== undefined) updateData.scheduleDay = scheduleDay;
    if (scheduleTime !== undefined) updateData.scheduleTime = scheduleTime;
    if (coach !== undefined) updateData.coach = coach;
    if (beltLevel !== undefined) updateData.belt = beltLevel;
    if (feePerQuarter !== undefined) updateData.feePerQuarter = feePerQuarter;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (studentNumber !== undefined) updateData.studentNumber = studentNumber;
    if (gender !== undefined) updateData.gender = gender;
    if (email !== undefined) updateData.email = email;
    if (dojoId !== undefined) updateData.dojoId = dojoId;
    await updateStudent(id, updateData);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/students PUT error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.delete("/admin/students/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    // 軟刪除：把狀態改為 inactive
    await updateStudent(id, { status: "inactive" } as any);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/students DELETE error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin: Mark / Unmark Payment Paid ───────────────────────────────────
parentRouter.post("/admin/payments/mark-paid", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { recordId } = req.body;
    if (!recordId) return res.status(400).json({ success: false, error: "recordId 為必填" });
    await approvePaymentRecord(recordId, "admin_approved");

    // ✅ 自動推播：通知家長繳費已確認
    try {
      const { getPaymentRecordById } = await import("./db");
      const record = await getPaymentRecordById(recordId);
      if (record) {
        const student = await getStudentById(record.studentId);
        if (student) {
          await notifyPaymentConfirmed(
            record.studentId, "regular",
            student.name, String(record.amount),
            req.userPhone || "admin"
          );
        }
      }
    } catch (pushErr) { console.error("[AutoPush] mark-paid:", pushErr); }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/payments/mark-paid error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

parentRouter.post("/admin/payments/unmark-paid", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { recordId } = req.body;
    if (!recordId) return res.status(400).json({ success: false, error: "recordId 為必填" });
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "系統錯誤" });
    await db.update(paymentRecordsTable).set({ status: "pending", confirmedBy: null } as any).where(eq(paymentRecordsTable.id, recordId));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/payments/unmark-paid error:", err);
    return res.status(500).json({ success: false, error: err.message || "系統錯誤" });
  }
});

// ── Admin: Coach List (name list) ───────────────────────────────────────
parentRouter.get("/admin/coach-list", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const coaches = await getAllCoachUsers();
    return res.json(coaches);
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

// ── Admin: All Coach Statistics ─────────────────────────────────────────
parentRouter.get("/admin/all-coach-statistics", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
    const allStats = await getCoachStatsWithElite(year, quarter);
    return res.json(allStats);
  } catch (err: any) {
    console.error("[AppAPI] admin/all-coach-statistics error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── Admin: Single Coach Statistics ──────────────────────────────────────
parentRouter.get("/admin/coach-statistics/:coachName", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const coachName = decodeURIComponent(req.params.coachName);
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
    const allStats = await getCoachStatsWithElite(year, quarter);
    const myStats = allStats.find((s: any) => s.coachName === coachName);
    return res.json(myStats || { coachName, regularStudentCount: 0, eliteStudentCount: 0, totalStudentCount: 0, totalRevenue: 0 });
  } catch (err: any) {
    console.error("[AppAPI] admin/coach-statistics/:coachName error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  收據審查 REST API (Admin)
// ══════════════════════════════════════════════════════════════════════════

// 取得待審查收據列表
parentRouter.get("/admin/receipt-reviews", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const status = (req.query.status as string) || 'pending_review';
    const reviews = await getReceiptReviews(status);
    return res.json(reviews);
  } catch (err: any) {
    console.error("[AppAPI] admin/receipt-reviews error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 取得收據比對詳情
parentRouter.get("/admin/receipt-compare/:paymentId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const paymentType = (req.query.type as string) || 'regular';
    const compare = await getReceiptCompare(paymentId, paymentType);
    if (!compare) return res.status(404).json({ error: "找不到記錄" });
    return res.json(compare);
  } catch (err: any) {
    console.error("[AppAPI] admin/receipt-compare error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 審查決定：批准或拒絕
parentRouter.post("/admin/receipt-review/:paymentId", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const { decision, paymentType } = req.body;
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision 必須為 approved 或 rejected" });
    }

    const result = await reviewReceipt({
      paymentId,
      paymentType: paymentType || 'regular',
      decision,
      reviewedBy: req.userPhone || 'admin',
    });

    if (!result) return res.status(500).json({ error: "審查處理失敗" });

    // 批准後同步到會計
    if (decision === 'approved') {
      try {
        if (!paymentType || paymentType === 'regular') {
          const { getPaymentRecordById, syncPaymentToAccounting } = await import("./db");
          const payment = await getPaymentRecordById(paymentId);
          if (payment) {
            const student = await getStudentById(payment.studentId);
            if (student) {
              await syncPaymentToAccounting({
                paymentRecordId: paymentId,
                transactionDate: payment.receiptTransferDate || payment.paymentDate,
                amount: String(payment.amount),
                bank: null,
                studentName: student.name,
                coachName: student.coach,
                dojoName: student.venue || null,
                category: 'tuition',
                receiptUrl: payment.receiptUrl,
                receiptKey: payment.receiptKey,
              });
            }
          }
        } else if (paymentType === 'elite') {
          // 精英班審查批准後也要同步會計
          const pool2 = await getRawPool();
          if (pool2) {
            const [rows2] = await pool2.execute("SELECT * FROM elite_payments WHERE id = ?", [paymentId]) as any;
            if (rows2.length > 0) {
              const ep = rows2[0];
              const eliteStudent = await getEliteStudentById(ep.student_id);
              if (eliteStudent) {
                await syncElitePaymentToAccounting({
                  elitePaymentRecordId: paymentId,
                  transactionDate: ep.payment_date || new Date(),
                  amount: String(ep.amount),
                  studentName: eliteStudent.name,
                  coachName: eliteStudent.coach,
                  dojoName: '精英班',
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("[ReceiptReview] 批准後同步會計失敗:", e);
      }
    }

    // 通知家長
    try {
      const compare = await getReceiptCompare(paymentId, paymentType || 'regular');
      if (compare?.current) {
        notifyParentReviewResult({
          studentId: compare.current.studentId || compare.current.student_id,
          studentType: paymentType === 'elite' ? 'elite' : 'regular',
          studentName: compare.current.studentName || '學生',
          decision,
          amount: String(compare.current.amount),
        }).catch(() => {});
      }
    } catch {}

    return res.json({ success: true, decision });
  } catch (err: any) {
    console.error("[AppAPI] admin/receipt-review error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// 待審查數量
parentRouter.get("/admin/receipt-review-count", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const items = await getReceiptReviews('pending_review');
    return res.json({ count: items.length });
  } catch (err: any) {
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  PUSH NOTIFICATION endpoints
// ══════════════════════════════════════════════════════════════════════════

// ── 1. 註冊 Push Token ──────────────────────────────────────
parentRouter.post("/push-token", async (req: AuthenticatedRequest, res) => {
  try {
    const { token, platform } = req.body;
    const phone = req.userPhone || req.parentPhone;
    const role = req.userRole || "parent";
    if (!token || !phone) return res.status(400).json({ error: "缺少 token 或 phone" });
    if (!Expo.isExpoPushToken(token)) return res.status(400).json({ error: "無效的 Push Token 格式" });

    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    await pool.execute(
      `INSERT INTO push_tokens (phone, role, token, platform, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE phone=VALUES(phone), role=VALUES(role), platform=VALUES(platform), updated_at=NOW()`,
      [phone, role, token, platform || "unknown"]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Push token registration error:", err);
    res.status(500).json({ error: "註冊推播失敗" });
  }
});

// ── 2. 發送推播通知 ─────────────────────────────────────────
parentRouter.post("/send-notification", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, body, targetType, targetValue } = req.body;
    const senderPhone = req.userPhone || req.parentPhone;
    const senderRole = req.userRole || "parent";
    const coachName = req.coachName;
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: "請填寫標題和內容" });
    if (!["all","role","class","coach_students","individual"].includes(targetType)) return res.status(400).json({ error: "無效的推送對象類型" });

    // 教練只能用 class 和 individual
    if (senderRole === "coach" && !["class","individual"].includes(targetType)) {
      return res.status(403).json({ error: "教練只能推送給自己的班級或個別學生" });
    }

    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    let tokens: string[] = [];

    if (targetType === "all") {
      const [rows] = await pool.execute("SELECT token FROM push_tokens");
      tokens = (rows as any[]).map(r => r.token);
    } else if (targetType === "role") {
      const [rows] = await pool.execute("SELECT token FROM push_tokens WHERE role = ?", [targetValue]);
      tokens = (rows as any[]).map(r => r.token);
    } else if (targetType === "class") {
      const parts = (targetValue || "").split("|");
      if (parts.length < 3) return res.status(400).json({ error: "班級格式錯誤" });
      const [venue, day, time] = parts;
      const [stuRows] = await pool.execute(
        "SELECT DISTINCT phone FROM students WHERE venue=? AND scheduleDay=? AND scheduleTime=? AND status='active'",
        [venue, day, time]
      );
      const phones = (stuRows as any[]).map(r => r.phone).filter(Boolean);
      if (phones.length > 0) {
        const ph = phones.map(() => "?").join(",");
        const [tokenRows] = await pool.execute(`SELECT token FROM push_tokens WHERE phone IN (${ph})`, phones);
        tokens = (tokenRows as any[]).map(r => r.token);
      }
    } else if (targetType === "coach_students") {
      const [stuRows] = await pool.execute(
        "SELECT DISTINCT phone FROM students WHERE coach=? AND status='active'", [targetValue]
      );
      const phones = (stuRows as any[]).map((r: any) => r.phone).filter(Boolean);
      if (phones.length > 0) {
        const ph = phones.map(() => "?").join(",");
        const [tokenRows] = await pool.execute(`SELECT token FROM push_tokens WHERE phone IN (${ph})`, phones);
        tokens = (tokenRows as any[]).map(r => r.token);
      }
    } else if (targetType === "individual") {
      const phones = (targetValue || "").split(",").map((p: string) => p.trim()).filter(Boolean);
      // 教練：只能推送給自己的學生
      if (senderRole === "coach" && coachName && phones.length > 0) {
        const ph = phones.map(() => "?").join(",");
        const [validRows] = await pool.execute(
          `SELECT DISTINCT phone FROM students WHERE phone IN (${ph}) AND coach=? AND status='active'`,
          [...phones, coachName]
        ) as any;
        const validPhones = validRows.map((r: any) => r.phone);
        if (validPhones.length === 0) return res.status(403).json({ error: "您只能推送給自己的學生" });
        const tph = validPhones.map(() => "?").join(",");
        const [tokenRows] = await pool.execute(`SELECT token FROM push_tokens WHERE phone IN (${tph})`, validPhones);
        tokens = (tokenRows as any[]).map(r => r.token);
      } else if (phones.length > 0) {
        const ph = phones.map(() => "?").join(",");
        const [tokenRows] = await pool.execute(`SELECT token FROM push_tokens WHERE phone IN (${ph})`, phones);
        tokens = (tokenRows as any[]).map(r => r.token);
      }
    }

    tokens = tokens.filter(t => Expo.isExpoPushToken(t));

    let sentCount = 0;
    if (tokens.length > 0) {
      const messages: ExpoPushMessage[] = tokens.map(pushToken => ({
        to: pushToken, sound: "default" as const, title: title.trim(), body: body.trim(), data: { type: "notification" },
      }));
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          for (let i = 0; i < ticketChunk.length; i++) {
            const ticket = ticketChunk[i];
            if (ticket.status === "ok") { sentCount++; }
            else if (ticket.status === "error" && ticket.details && (ticket.details as any).error === "DeviceNotRegistered") {
              await pool.execute("DELETE FROM push_tokens WHERE token = ?", [chunk[i].to]).catch(() => {});
            }
          }
        } catch (e) { console.error("Expo push chunk error:", e); }
      }
    }

    // 記錄通知
    await pool.execute(
      "INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count) VALUES (?,?,?,?,?,?,?)",
      [title.trim(), body.trim(), senderPhone, senderRole, targetType, targetValue || null, sentCount]
    );

    res.json({
      success: true, sentCount,
      message: sentCount > 0 ? `已成功推送給 ${sentCount} 人` : "沒有找到可推送的裝置（使用者可能尚未開啟 App 授權通知）",
    });
  } catch (err: any) {
    console.error("Send notification error:", err);
    res.status(500).json({ error: "推送失敗: " + err.message });
  }
});

// ── 3. 查詢通知歷史 ─────────────────────────────────────────
parentRouter.get("/notifications", async (req: AuthenticatedRequest, res) => {
  try {
    const role = req.userRole || "parent";
    const phone = req.userPhone || req.parentPhone;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    let rows: any[];

    if (role === "admin") {
      [rows] = await pool.execute(
        "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset]
      ) as any;
    } else if (role === "coach") {
      // 教練可以看到：自己發的 + 全體通知 + 針對教練角色的通知
      [rows] = await pool.execute(
        `SELECT * FROM notifications WHERE
          sender_phone = ?
          OR target_type = 'all'
          OR (target_type = 'role' AND target_value = 'coach')
        ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [phone, limit, offset]
      ) as any;
    } else {
      // 家長
      if (!phone) return res.json([]);

      const [studentRows] = await pool.execute(
        "SELECT venue, scheduleDay, scheduleTime, coach FROM students WHERE phone = ? AND status = 'active'", [phone]
      ) as any;

      const conditions: string[] = [
        "target_type = 'all'",
        "(target_type = 'role' AND target_value = 'parent')",
        "(target_type = 'individual' AND FIND_IN_SET(?, target_value) > 0)",
      ];
      const params: any[] = [phone];

      for (const stu of studentRows) {
        if (stu.venue && stu.scheduleDay && stu.scheduleTime) {
          conditions.push("(target_type = 'class' AND target_value = ?)");
          params.push(`${stu.venue}|${stu.scheduleDay}|${stu.scheduleTime}`);
        }
        if (stu.coach) {
          conditions.push("(target_type = 'coach_students' AND target_value = ?)");
          params.push(stu.coach);
        }
      }

      const whereClause = conditions.join(" OR ");
      [rows] = await pool.execute(
        `SELECT id, title, body, target_type, created_at FROM notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ) as any;
    }

    res.json(rows);
  } catch (err: any) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "查詢通知失敗" });
  }
});

// ── 4. 推送對象列表 ─────────────────────────────────────────
parentRouter.get("/notification-targets", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const role = req.userRole;
    const coachName = req.coachName;
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    let classQuery = "SELECT DISTINCT venue, scheduleDay, scheduleTime, coach FROM students WHERE status = 'active'";
    const classParams: any[] = [];
    if (role === "coach" && coachName) { classQuery += " AND coach = ?"; classParams.push(coachName); }
    classQuery += " ORDER BY venue, scheduleDay, scheduleTime";
    const [classRows] = await pool.execute(classQuery, classParams) as any;

    let coaches: any[] = [];
    if (role === "admin") {
      const [coachRows] = await pool.execute(
        "SELECT DISTINCT coach FROM students WHERE status = 'active' AND coach IS NOT NULL ORDER BY coach"
      ) as any;
      coaches = coachRows.map((r: any) => r.coach);
    }

    let studentQuery = "SELECT id, name, phone, venue, coach FROM students WHERE status = 'active'";
    const studentParams: any[] = [];
    if (role === "coach" && coachName) { studentQuery += " AND coach = ?"; studentParams.push(coachName); }
    studentQuery += " ORDER BY name";
    const [studentRows] = await pool.execute(studentQuery, studentParams) as any;

    res.json({ classes: classRows, coaches, students: studentRows });
  } catch (err: any) {
    console.error("Get notification targets error:", err);
    res.status(500).json({ error: "查詢推送對象失敗" });
  }
});

// ════════════════════════════════════════════════════════════════════════
//  Student Contacts API (學生聯絡人管理)
// ════════════════════════════════════════════════════════════════════════

// GET /student-contacts/:studentId — 取得學生的所有聯絡人
parentRouter.get("/student-contacts/:studentId", async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const studentType = (req.query.type as string) || "regular";
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });

    const [rows] = await pool.execute(
      `SELECT * FROM student_contacts
       WHERE student_id = ? AND student_type = ?
       ORDER BY is_primary DESC, created_at ASC`,
      [studentId, studentType]
    ) as any;

    res.json({ success: true, contacts: rows || [] });
  } catch (err: any) {
    console.error("[AppAPI] student-contacts GET error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /student-contacts — 新增聯絡人
parentRouter.post("/student-contacts", requireRole("admin", "coach"), async (req: AuthenticatedRequest, res) => {
  try {
    const { studentId, studentType, phone, label, name, receivePush } = req.body;
    if (!studentId || !phone || !label) {
      return res.status(400).json({ success: false, error: "缺少必要欄位（學生、電話、標籤）" });
    }
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });

    const sType = studentType || "regular";
    // 檢查是否已存在相同電話
    const [existing] = await pool.execute(
      `SELECT id FROM student_contacts WHERE student_id = ? AND student_type = ? AND phone = ?`,
      [studentId, sType, phone]
    ) as any;
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: "此電話已存在" });
    }

    const [result] = await pool.execute(
      `INSERT INTO student_contacts (student_id, student_type, phone, label, name, is_primary, receive_push)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [studentId, sType, phone, label, name || null, receivePush !== false ? 1 : 0]
    ) as any;

    res.json({ success: true, id: result?.insertId });
  } catch (err: any) {
    console.error("[AppAPI] student-contacts POST error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /student-contacts/:id — 更新聯絡人
parentRouter.put("/student-contacts/:id", requireRole("admin", "coach"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { phone, label, name, receivePush } = req.body;
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });

    const updates: string[] = [];
    const values: any[] = [];

    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
    if (label !== undefined) { updates.push("label = ?"); values.push(label); }
    if (name !== undefined) { updates.push("name = ?"); values.push(name || null); }
    if (receivePush !== undefined) { updates.push("receive_push = ?"); values.push(receivePush ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "沒有要更新的欄位" });
    }

    values.push(id);
    await pool.execute(
      `UPDATE student_contacts SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] student-contacts PUT error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /student-contacts/:id — 刪除聯絡人
parentRouter.delete("/student-contacts/:id", requireRole("admin", "coach"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });

    // 不能刪除主要聯絡人
    const [contact] = await pool.execute("SELECT is_primary FROM student_contacts WHERE id = ?", [id]) as any;
    if (contact?.[0]?.is_primary === 1) {
      return res.status(400).json({ success: false, error: "不能刪除主要聯絡人，請先變更主要聯絡人" });
    }

    await pool.execute("DELETE FROM student_contacts WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] student-contacts DELETE error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /student-contacts/:id/set-primary — 設為主要聯絡人
parentRouter.post("/student-contacts/:id/set-primary", requireRole("admin", "coach"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ success: false, error: "DB 不可用" });

    // 取得該聯絡人的學生資訊
    const [contact] = await pool.execute(
      "SELECT student_id, student_type FROM student_contacts WHERE id = ?", [id]
    ) as any;
    if (!contact || contact.length === 0) {
      return res.status(404).json({ success: false, error: "聯絡人不存在" });
    }

    const { student_id, student_type } = contact[0];

    // 先把該學生的所有聯絡人取消主要
    await pool.execute(
      "UPDATE student_contacts SET is_primary = 0 WHERE student_id = ? AND student_type = ?",
      [student_id, student_type]
    );

    // 設定新的主要
    await pool.execute("UPDATE student_contacts SET is_primary = 1 WHERE id = ?", [id]);

    res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] student-contacts set-primary error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
//  Admin Push Settings API
// ════════════════════════════════════════════════════════════════════════

// GET /admin/push-settings — 取得所有推播設定
parentRouter.get("/admin/push-settings", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });
    const [rows] = await pool.execute("SELECT * FROM push_settings ORDER BY id ASC") as any;
    res.json(rows);
  } catch (err: any) {
    console.error("[AppAPI] admin/push-settings GET error:", err);
    res.status(500).json({ error: "查詢推播設定失敗" });
  }
});

// PUT /admin/push-settings/:key — 更新推播設定開關
parentRouter.put("/admin/push-settings/:key", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = req.params;
    const { enabled } = req.body;
    if (enabled === undefined || enabled === null) {
      return res.status(400).json({ error: "缺少 enabled 參數" });
    }
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });
    const [result] = await pool.execute(
      "UPDATE push_settings SET enabled = ? WHERE setting_key = ?",
      [enabled ? 1 : 0, key]
    ) as any;
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "找不到此推播設定" });
    }
    res.json({ success: true, setting_key: key, enabled: !!enabled });
  } catch (err: any) {
    console.error("[AppAPI] admin/push-settings PUT error:", err);
    res.status(500).json({ error: "更新推播設定失敗" });
  }
});

// ════════════════════════════════════════════════════════════════════════
//  Admin Push Queue API (推播審核佇列)
// ════════════════════════════════════════════════════════════════════════

// GET /admin/push-queue — 取得推播佇列列表
parentRouter.get("/admin/push-queue", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string || undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const items = await listPushQueue(status, limit, offset);
    return res.json(items);
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// GET /admin/push-queue/count — 取得待審核數量
parentRouter.get("/admin/push-queue/count", requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const count = await getPendingPushQueueCount();
    return res.json({ count });
  } catch (err: any) {
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// GET /admin/push-queue/:id — 取得單筆推播佇列詳情
parentRouter.get("/admin/push-queue/:id", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await getPushQueueById(id);
    if (!item) return res.status(404).json({ error: "找不到此推播佇列項目" });
    return res.json(item);
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue/:id error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// POST /admin/push-queue/:id/approve — 批准並發送推播
parentRouter.post("/admin/push-queue/:id/approve", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const reviewedBy = req.userPhone || "admin";
    const result = await approvePushQueue(id, reviewedBy);
    if (!result.success) return res.status(400).json({ error: "批准失敗（可能已處理）" });
    return res.json({ success: true, sentCount: result.sentCount });
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue approve error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// POST /admin/push-queue/:id/reject — 拒絕推播
parentRouter.post("/admin/push-queue/:id/reject", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body || {};
    const reviewedBy = req.userPhone || "admin";
    const ok = await rejectPushQueue(id, reviewedBy, reason);
    if (!ok) return res.status(400).json({ error: "拒絕失敗（可能已處理）" });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue reject error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// POST /admin/push-queue/batch-approve — 批量批准
parentRouter.post("/admin/push-queue/batch-approve", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids 不能為空" });
    const reviewedBy = req.userPhone || "admin";
    const result = await batchApprovePushQueue(ids, reviewedBy);
    return res.json({ success: true, approved: result.approved, totalSent: result.totalSent });
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue batch-approve error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// POST /admin/push-queue/batch-reject — 批量拒絕
parentRouter.post("/admin/push-queue/batch-reject", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids 不能為空" });
    const reviewedBy = req.userPhone || "admin";
    const rejected = await batchRejectPushQueue(ids, reviewedBy, reason);
    return res.json({ success: true, rejected });
  } catch (err: any) {
    console.error("[AppAPI] admin/push-queue batch-reject error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════
//  Admin: 新增推播 (手動建立推播，可立即發送或排入隊列)
// ══════════════════════════════════════════════════════════════════════

// GET /admin/class-list — 取得活躍班級列表（含學生人數），同時包括恆常班和精英班
parentRouter.get("/admin/class-list", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    // 恆常班
    const [regularRows] = await pool.execute(
      `SELECT venue, scheduleDay, scheduleTime, coach, COUNT(*) as studentCount
       FROM students WHERE status = 'active'
       GROUP BY venue, scheduleDay, scheduleTime, coach
       ORDER BY venue, scheduleDay, scheduleTime`
    );

    // 精英班（無 venue 欄位，用 coach 分組）
    const [eliteRows] = await pool.execute(
      `SELECT coach, schedule_day as scheduleDay, schedule_time as scheduleTime, COUNT(*) as studentCount
       FROM elite_students WHERE status = 'active'
       GROUP BY coach, schedule_day, schedule_time
       ORDER BY coach, schedule_day, schedule_time`
    );

    const result = [
      ...(regularRows as any[]).map((c: any) => ({
        classKey: `regular|${c.venue}|${c.scheduleDay}|${c.scheduleTime}`,
        className: `${c.venue} ${c.scheduleDay} ${c.scheduleTime}`,
        studentCount: c.studentCount,
        type: 'regular',
        venue: c.venue,
        scheduleDay: c.scheduleDay,
        scheduleTime: c.scheduleTime,
        coach: c.coach,
      })),
      ...(eliteRows as any[]).map((c: any) => ({
        classKey: `elite|${c.coach}|${c.scheduleDay}|${c.scheduleTime}`,
        className: `精英班 - ${c.coach} ${c.scheduleDay} ${c.scheduleTime}`,
        studentCount: c.studentCount,
        type: 'elite',
        venue: c.coach,
        scheduleDay: c.scheduleDay,
        scheduleTime: c.scheduleTime,
        coach: c.coach,
      })),
    ];

    return res.json(result);
  } catch (err: any) {
    console.error("[AppAPI] admin/class-list error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// GET /admin/student-list-simple — 取得活躍學生按班級分組列表
parentRouter.get("/admin/student-list-simple", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });
    const [regular] = await pool.execute(
      `SELECT id, name, phone, venue, scheduleDay, scheduleTime, coach, 'regular' as studentType
       FROM students WHERE status = 'active' ORDER BY venue, scheduleDay, scheduleTime, name`
    );
    const [elite] = await pool.execute(
      `SELECT id, name, phone, coach, schedule_day as scheduleDay, schedule_time as scheduleTime, 'elite' as studentType
       FROM elite_students WHERE status = 'active' ORDER BY schedule_day, schedule_time, name`
    );
    // 按班級分組
    const grouped: Record<string, { className: string; classKey: string; type: string; students: any[] }> = {};
    for (const s of [...(regular as any[]), ...(elite as any[])]) {
      let classKey: string;
      let className: string;
      let groupType: string;
      if (s.studentType === 'elite') {
        classKey = `elite|${s.coach}|${s.scheduleDay}|${s.scheduleTime}`;
        className = `精英班 - ${s.coach || ''} ${s.scheduleDay || ''} ${s.scheduleTime || ''}`.trim();
        groupType = 'elite';
      } else {
        classKey = `regular|${s.venue}|${s.scheduleDay}|${s.scheduleTime}`;
        className = `${s.venue || '未知'} ${s.scheduleDay || ''} ${s.scheduleTime || ''}`.trim();
        groupType = 'regular';
      }
      if (!grouped[classKey]) {
        grouped[classKey] = { className, classKey, type: groupType, students: [] };
      }
      grouped[classKey].students.push({
        id: s.id,
        name: s.name,
        phone: s.phone,
        studentType: s.studentType,
        coach: s.coach,
      });
    }
    const result = Object.values(grouped).map((g) => ({
      ...g,
      studentCount: g.students.length,
    }));
    return res.json(result);
  } catch (err: any) {
    console.error("[AppAPI] admin/student-list-simple error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// POST /admin/push-create — 管理員手動新增推播（可選立即發送或排入隊列）
parentRouter.post("/admin/push-create", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, body, targetType, targetValue, sendNow } = req.body;

    // 基本驗證
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "請填寫標題和內容" });
    }
    if (!["all", "class", "students"].includes(targetType)) {
      return res.status(400).json({ error: "無效的推送對象類型，可選: all, class, students" });
    }

    const pool = await getRawPool();
    if (!pool) return res.status(500).json({ error: "DB 不可用" });

    const senderPhone = req.userPhone || "admin";
    let targetStudentIds: Array<{ id: number; type: string; name: string }> = [];
    let resolvedPhones: string[] = [];
    let targetDesc = "";

    if (targetType === "all") {
      // 全體 — 取得所有 push_tokens
      targetDesc = "全體用戶";
    } else if (targetType === "class") {
      // 班級 — targetValue = "type|identifier|day|time" or ["type|identifier|day|time", ...]
      // type=regular: "regular|venue|day|time"，type=elite: "elite|coach|day|time"
      const classKeys = Array.isArray(targetValue) ? targetValue : [targetValue];
      if (!classKeys.length || classKeys.some((k: string) => !k || k.split("|").length < 4)) {
        return res.status(400).json({ error: "班級格式錯誤，應為 type|venue|day|time" });
      }
      // 找出這些班級的所有學生
      for (const key of classKeys) {
        const [classType, identifier, day, time] = key.split("|");
        if (classType === "elite") {
          const [stuRows] = await pool.execute(
            "SELECT id, name, phone FROM elite_students WHERE coach=? AND schedule_day=? AND schedule_time=? AND status='active'",
            [identifier, day, time]
          );
          for (const s of stuRows as any[]) {
            targetStudentIds.push({ id: s.id, type: "elite", name: s.name });
            if (s.phone) resolvedPhones.push(s.phone);
          }
        } else {
          const [stuRows] = await pool.execute(
            "SELECT id, name, phone FROM students WHERE venue=? AND scheduleDay=? AND scheduleTime=? AND status='active'",
            [identifier, day, time]
          );
          for (const s of stuRows as any[]) {
            targetStudentIds.push({ id: s.id, type: "regular", name: s.name });
            if (s.phone) resolvedPhones.push(s.phone);
          }
        }
      }
      targetDesc = `${classKeys.length} 個班級（${targetStudentIds.length} 位學生）`;
    } else if (targetType === "students") {
      // 指定學生 — targetValue = [{ id, type }] where type = 'regular' | 'elite'
      if (!Array.isArray(targetValue) || targetValue.length === 0) {
        return res.status(400).json({ error: "請選擇至少一位學生" });
      }
      for (const sv of targetValue) {
        if (sv.type === "elite") {
          const [rows] = await pool.execute("SELECT id, name, phone FROM elite_students WHERE id=?", [sv.id]);
          const s = (rows as any[])[0];
          if (s) {
            targetStudentIds.push({ id: s.id, type: "elite", name: s.name });
            if (s.phone) resolvedPhones.push(s.phone);
          }
        } else {
          const [rows] = await pool.execute("SELECT id, name, phone FROM students WHERE id=?", [sv.id]);
          const s = (rows as any[])[0];
          if (s) {
            targetStudentIds.push({ id: s.id, type: "regular", name: s.name });
            if (s.phone) resolvedPhones.push(s.phone);
          }
        }
      }
      targetDesc = `${targetStudentIds.length} 位指定學生`;
    }

    if (sendNow) {
      // === 立即發送模式 ===
      let tokens: string[] = [];

      if (targetType === "all") {
        const [rows] = await pool.execute("SELECT token FROM push_tokens");
        tokens = (rows as any[]).map(r => r.token).filter((t: string) => Expo.isExpoPushToken(t));
      } else {
        // 透過 phones 找 tokens
        const uniquePhones = [...new Set(resolvedPhones)];
        if (uniquePhones.length > 0) {
          // 也加上 student_contacts 的 phones
          const allPhones = new Set(uniquePhones);
          for (const stu of targetStudentIds) {
            const tableName = stu.type === "elite" ? "elite_students" : "students";
            const phoneCol = "phone";  // both tables use 'phone' column
            try {
              const [contactRows] = await pool.execute(
                "SELECT phone FROM student_contacts WHERE student_id=? AND student_type=? AND receive_push=1",
                [stu.id, stu.type]
              );
              for (const c of contactRows as any[]) {
                if (c.phone) allPhones.add(c.phone);
              }
            } catch {}
          }
          const phoneArr = [...allPhones];
          if (phoneArr.length > 0) {
            const ph = phoneArr.map(() => "?").join(",");
            const [tokenRows] = await pool.execute(`SELECT token FROM push_tokens WHERE phone IN (${ph})`, phoneArr);
            tokens = (tokenRows as any[]).map(r => r.token).filter((t: string) => Expo.isExpoPushToken(t));
          }
        }
      }

      const sentCount = await sendPushNotifications(tokens, title.trim(), body.trim(), { type: "notification" });

      // 記錄到 notifications
      await pool.execute(
        "INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count) VALUES (?,?,?,?,?,?,?)",
        [title.trim(), body.trim(), senderPhone, "admin", targetType, JSON.stringify(targetValue), sentCount]
      );

      // 也記錄到 push_queue（狀態已 approved）
      await pool.execute(
        `INSERT INTO push_queue (title, body, target_type, target_student_ids, student_type, trigger_source, trigger_detail, status, reviewed_by, reviewed_at, sent_count)
         VALUES (?, ?, ?, ?, 'both', 'admin_manual', ?, 'approved', ?, NOW(), ?)`,
        [
          title.trim(),
          body.trim(),
          targetType === "all" ? "all" : "individual",
          JSON.stringify(targetStudentIds),
          JSON.stringify({ targetType, targetDesc, sendNow: true }),
          senderPhone,
          sentCount,
        ]
      );

      return res.json({
        success: true,
        sentCount,
        message: sentCount > 0 ? `已立即推送給 ${sentCount} 人` : "沒有找到可推送的裝置",
      });
    } else {
      // === 排入隊列模式 ===
      const queueId = await queuePushNotification({
        title: title.trim(),
        body: body.trim(),
        targetType: targetType === "all" ? "all" : "individual",
        targetStudentIds: targetStudentIds.length > 0 ? targetStudentIds : null,
        studentType: "both",
        triggerSource: "admin_manual",
        triggerDetail: { targetType, targetDesc, sendNow: false },
      });

      return res.json({
        success: true,
        queueId,
        message: "已排入推播隊列等待審核",
      });
    }
  } catch (err: any) {
    console.error("[AppAPI] admin/push-create error:", err);
    return res.status(500).json({ error: "系統錯誤: " + err.message });
  }
});

export { parentRouter };
