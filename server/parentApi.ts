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
 *   GET  /coach/students       — my students
 *   GET  /coach/attendance     — class attendance (?year=&month=&classGroup=)
 *   POST /coach/attendance     — mark attendance
 *   GET  /coach/statistics     — my statistics
 *   GET  /coach/schedules      — training schedules
 * 
 * ── ADMIN ──
 *   GET  /admin/students       — all students
 *   GET  /admin/users          — all users
 *   GET  /admin/payments       — all payments overview
 *   GET  /admin/statistics     — global statistics
 *   GET  /admin/events         — all events (incl. closed)
 *   POST /admin/events/create  — create event
 *   GET  /admin/finance        — monthly finance report
 */
import { Router } from "express";
import multer from "multer";
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
import { students as studentsTable, users as usersTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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
    let exStatus: string | null = null, exDT: string | null = null;
    let exRName: string | null = null, exRAcc: string | null = null;
    const b64 = buf.toString("base64");
    try {
      const lr = await ocrReceipt(b64, mime);
      if (lr.amount) exAmt = lr.amount;
      if (lr.bank) exBank = lr.bank;
      if (lr.status) exStatus = lr.status;
      if (lr.recipientName) exRName = lr.recipientName;
      if (lr.recipientAccount) exRAcc = lr.recipientAccount;
      if (lr.date) { const d = new Date(lr.time ? `${lr.date}T${lr.time}` : lr.date); if (!isNaN(d.getTime())) rDate = d; exDT = lr.time ? `${lr.date} ${lr.time}` : lr.date; }
    } catch {}
    if (!exAmt || exAmt === "0" || exAmt === amount) {
      try {
        const oR = await invokeLLM({ messages: [{ role: "system", content: '從收據提取JSON: {"amount","bank","status","date","time","recipientName","recipientAccount"}' }, { role: "user", content: [{ type: "text", text: "識別收據:" }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } }] }] });
        const c = oR.choices[0]?.message?.content;
        if (typeof c === "string") { const d = JSON.parse(c.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()); if (d.amount) { const p = parseFloat(d.amount.replace(/[^0-9.]/g, "")); if (!isNaN(p) && p > 0) exAmt = p.toString(); } if (d.bank) exBank = d.bank; if (d.date) { const pd = new Date(d.time ? `${d.date}T${d.time}` : d.date); if (!isNaN(pd.getTime())) rDate = pd; } }
      } catch {}
    }

    const student = await getStudentById(numId);
    if (!student) return res.status(404).json({ success: false, error: "學生不存在" });

    let sUrl = rUrl, sKey = rKey;
    try { const cm = customMonths ? JSON.parse(customMonths) : undefined; const sb = await stampReceipt(buf, mime, { studentName: student.name, amount: exAmt || amount, paymentPeriod, customMonths: cm, dojoName: student.venue || undefined }); const sk = `receipts/stamped-${numId}-${Date.now()}.${ext}`; const sr = await storagePut(sk, sb, mime); sUrl = sr.url; sKey = sk; } catch {}

    const pAmt = parseFloat(exAmt), eAmt = parseFloat(student.feePerQuarter);
    const amtOk = pAmt === eAmt;
    let rcpOk = false, rcpNote = "";
    try { const v = await getSystemConfig("receipt_validation_enabled"); if (v === "true") { const acc = await getAcceptedPayeeAccounts(); if (!acc.length) rcpOk = true; else { for (const a of acc) { if ((exRAcc && a.account && (exRAcc.includes(a.account) || a.account.includes(exRAcc))) || (exRName && a.name && (exRName.toUpperCase().includes(a.name.toUpperCase()) || a.name.toUpperCase().includes(exRName.toUpperCase())))) { rcpOk = true; break; } } if (!rcpOk) rcpNote = `收款人不匹配`; } } else rcpOk = true; } catch { rcpOk = true; }

    let reason = ""; if (!amtOk) reason += `金額不符`; if (!rcpOk) { if (reason) reason += "; "; reason += rcpNote; }
    const st = amtOk && rcpOk ? "confirmed" : "pending";
    const cm2 = customMonths ? JSON.parse(customMonths) : null;
    const pid = await insertPaymentRecord({ studentId: numId, paymentPeriod, customMonths: cm2, amount: exAmt, classCount: classCount ? parseInt(classCount) : null, receiptUrl: sUrl, receiptKey: sKey, receiptTransferDate: rDate, paymentDate: new Date(), status: st, confirmedBy: "parent_upload" });
    if (st === "confirmed") { try { await syncPaymentToAccounting({ paymentRecordId: pid, transactionDate: rDate || new Date(), amount: exAmt, bank: exBank, studentName: student.name, coachName: student.coach, dojoName: student.venue || null, category: "tuition", receiptUrl: sUrl, receiptKey: sKey }); } catch {} }

    return res.json({ success: true, extractedAmount: exAmt, extractedBank: exBank, status: st, pendingReason: reason || undefined });
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
    const allStats = await getCoachStatsWithElite();
    if (coachName) {
      // 教練只能看到自己的統計
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

    // 3. 取得這些排程的所有點名記錄
    // attendance_records 用 courseId (來自 courses 表) + attendanceDate 來關聯
    const db = await getDb();
    let records: any[] = [];
    if (db && schedules.length > 0) {
      const { inArray, eq: eqOp, and: andOp, gte, lte } = await import("drizzle-orm");
      const { attendanceRecords: arTable, courses: coursesTable } = await import("../drizzle/schema");

      // 找到對應的 course（用 venue+day+time 合成的名字）
      const venueName = `${venue} ${scheduleDay} ${scheduleTime}`;
      const courseRows = await db.select().from(coursesTable).where(eqOp(coursesTable.name, venueName)).limit(1);

      if (courseRows.length > 0) {
        const courseId = courseRows[0].id;
        // 取得該月的所有出席記錄
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
        records = await db.select().from(arTable).where(
          andOp(eqOp(arTable.courseId, courseId), gte(arTable.attendanceDate, startDate), lte(arTable.attendanceDate, endDate))
        );
      }
    }

    // 4. 構造 map: { `${scheduleId}-${studentId}`: status }
    // 需要用 attendanceDate 匹配回 scheduleId
    const attendanceMap: Record<string, string> = {};
    for (const r of records) {
      // 找到 attendanceDate 對應的 schedule
      const rDate = new Date(r.attendanceDate).toISOString().slice(0, 10);
      const matchedSch = schedules.find((s: any) => new Date(s.trainingDate).toISOString().slice(0, 10) === rDate);
      if (matchedSch) {
        attendanceMap[`${matchedSch.id}-${r.studentId}`] = r.status;
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

    // 找到或創建對應的 course（attendance_records.course_id 有 FK 到 courses）
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "資料庫不可用" });

    const { eq: eqOp, and: andOp } = await import("drizzle-orm");
    const { courses, attendanceRecords: arTable } = await import("../drizzle/schema");

    // 用 venue + day + time 找 course
    const venueName = `${schedule.venue} ${schedule.scheduleDay} ${schedule.scheduleTime}`;
    let courseRows = await db.select().from(courses).where(eqOp(courses.name, venueName)).limit(1);

    let courseId: number;
    if (courseRows.length > 0) {
      courseId = courseRows[0].id;
    } else {
      // 創建 course
      const dayMap: Record<string, string> = {
        "星期一": "monday", "星期二": "tuesday", "星期三": "wednesday",
        "星期四": "thursday", "星期五": "friday", "星期六": "saturday", "星期日": "sunday"
      };
      const result = await db.insert(courses).values({
        name: venueName,
        dayOfWeek: dayMap[schedule.scheduleDay] || "monday",
        startTime: "00:00",
        endTime: "00:00",
      });
      courseId = (result as any)[0]?.insertId || (result as any).insertId;
    }

    // Upsert attendance
    const existing = await db.select().from(arTable).where(
      andOp(eqOp(arTable.studentId, studentId), eqOp(arTable.courseId, courseId), eqOp(arTable.attendanceDate, attendanceDate))
    ).limit(1);

    if (existing.length > 0) {
      await db.update(arTable).set({ status }).where(eqOp(arTable.id, existing[0].id));
    } else {
      await db.insert(arTable).values({ studentId, courseId, attendanceDate, status });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("mark-attendance error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
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
    return res.json({ success: true, id: result.insertId });
  } catch { return res.status(500).json({ success: false, error: "系統錯誤" }); }
});

parentRouter.get("/admin/event-registrations", requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
    return res.json(await getEventRegistrations(eventId));
  } catch { return res.status(500).json({ error: "系統錯誤" }); }
});

export { parentRouter };
