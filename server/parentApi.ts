/**
 * Parent App REST API Router
 * 
 * Prefix: /api/v1/parent
 * All endpoints (except /login) require JWT Bearer token.
 * 
 * Endpoints:
 *   POST /login                  – 家長登入，回傳 JWT token
 *   GET  /students               – 取得該家長所有學生
 *   GET  /elite-info             – 精英班出席+繳費資訊
 *   GET  /attendance             – 恆常班出席記錄 (?year=&month=)
 *   GET  /monthly-statuses       – 月份繳費狀態 (?year=)
 *   GET  /payments               – 所有繳費記錄
 *   POST /payments/upload        – 上傳收據繳費 (multipart/form-data)
 *   GET  /events                 – 開放報名的活動
 *   GET  /events/my-registrations – 我的報名記錄
 *   POST /events/register        – 報名活動
 *   POST /events/cancel          – 取消報名
 *   GET  /exam-results           – 考試成績
 *   POST /change-password        – 修改密碼
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
} from "./db";
import { verifyPassword, hashPassword } from "./password";
import {
  generateToken,
  parentAuthMiddleware,
  type AuthenticatedRequest,
} from "./parentAuth";
import { storagePut } from "./storage";
import { ocrReceipt } from "./_core/localOcr";
import { invokeLLM } from "./_core/llm";
import { stampReceipt } from "./_core/receiptStamp";
import { students as studentsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Multer setup (memory storage, 10 MB limit) ──────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("只接受圖片檔案"));
    }
  },
});

// ── Router ───────────────────────────────────────────────────────────────
const parentRouter = Router();

// ── CORS for mobile app (no Origin header) ───────────────────────────────
parentRouter.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC (no auth)
// ══════════════════════════════════════════════════════════════════════════

/**
 * POST /login
 * Body: { phone: string, password: string }
 * Returns: { success, token?, students?, hasElite?, needPasswordChange?, error? }
 */
parentRouter.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, error: "請輸入電話號碼和密碼" });
    }

    const regularStudents = await getStudentsByPhone(phone);
    const eliteStudentList = await getEliteStudentsByPhone(phone);

    if (
      (!regularStudents || regularStudents.length === 0) &&
      (!eliteStudentList || eliteStudentList.length === 0)
    ) {
      return res.status(401).json({ success: false, error: "找不到此電話號碼的學生記錄" });
    }

    // Prefer regular student for auth, fallback to elite
    const authTarget: any =
      regularStudents && regularStudents.length > 0
        ? regularStudents[0]
        : eliteStudentList![0];

    let needPasswordChange = false;

    if (!authTarget.password) {
      // No password set → use phone as default
      if (password !== phone) {
        return res.status(401).json({ success: false, error: "密碼錯誤" });
      }
      needPasswordChange = true;
    } else {
      const isValid = await verifyPassword(password, authTarget.password);
      if (!isValid) {
        return res.status(401).json({ success: false, error: "密碼錯誤" });
      }
    }

    // Issue JWT
    const token = generateToken(phone);

    return res.json({
      success: true,
      token,
      students: regularStudents || [],
      hasElite: (eliteStudentList && eliteStudentList.length > 0) || false,
      needPasswordChange,
    });
  } catch (err: any) {
    console.error("[ParentAPI] login error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  PROTECTED (require JWT)
// ══════════════════════════════════════════════════════════════════════════
parentRouter.use(parentAuthMiddleware);

// ── GET /students ────────────────────────────────────────────────────────
parentRouter.get("/students", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const regular = await getStudentsByPhone(phone);
    const elite = await getEliteStudentsByPhone(phone);
    return res.json({ students: regular || [], eliteStudents: elite || [] });
  } catch (err: any) {
    console.error("[ParentAPI] students error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /elite-info ──────────────────────────────────────────────────────
parentRouter.get("/elite-info", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const info = await getParentEliteInfo(phone);
    return res.json(info);
  } catch (err: any) {
    console.error("[ParentAPI] elite-info error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /attendance?year=YYYY&month=MM ───────────────────────────────────
parentRouter.get("/attendance", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const data = await getParentAttendanceRecords(phone, year, month);
    return res.json(data);
  } catch (err: any) {
    console.error("[ParentAPI] attendance error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /monthly-statuses?year=YYYY ──────────────────────────────────────
parentRouter.get("/monthly-statuses", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const all = await getMonthlyPaymentStatuses(year);
    const filtered = all.filter((s: any) => s.phone === phone);
    return res.json(filtered);
  } catch (err: any) {
    console.error("[ParentAPI] monthly-statuses error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /payments ────────────────────────────────────────────────────────
parentRouter.get("/payments", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const students = await getStudentsByPhone(phone);
    if (!students || students.length === 0) {
      return res.json([]);
    }
    const studentIds = students.map((s: any) => s.id);
    const payments = await getPaymentRecordsByStudentIds(studentIds);
    return res.json(payments);
  } catch (err: any) {
    console.error("[ParentAPI] payments error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── POST /payments/upload (multipart: receipt file + JSON fields) ─────────
parentRouter.post(
  "/payments/upload",
  upload.single("receipt"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const phone = req.parentPhone!;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "請上傳收據圖片" });
      }

      const { studentId, paymentPeriod, customMonths, amount, classCount } = req.body;
      if (!studentId || !paymentPeriod || !amount) {
        return res.status(400).json({ success: false, error: "缺少必要欄位" });
      }

      const numericStudentId = parseInt(studentId);

      // Verify student belongs to this parent
      const parentStudents = await getStudentsByPhone(phone);
      const ownsStudent = parentStudents?.some((s: any) => s.id === numericStudentId);
      if (!ownsStudent) {
        return res.status(403).json({ success: false, error: "無權為此學生繳費" });
      }

      // Upload receipt to R2/local
      const receiptBuffer = file.buffer;
      const mimeType = file.mimetype;
      const fileExt = mimeType.split("/")[1] || "jpg";
      const receiptKey = `receipts/${numericStudentId}-${Date.now()}.${fileExt}`;
      const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, mimeType);

      // ── OCR ────────────────────────────────────────────────────────
      let extractedAmount = amount;
      let receiptTransferDate: Date | null = null;
      let extractedBank: string | null = null;
      let extractedStatus: string | null = null;
      let extractedDateTime: string | null = null;
      let extractedRecipientName: string | null = null;
      let extractedRecipientAccount: string | null = null;

      const base64Data = receiptBuffer.toString("base64");

      // 1) Local Tesseract
      try {
        const localResult = await ocrReceipt(base64Data, mimeType);
        if (localResult.amount) extractedAmount = localResult.amount;
        if (localResult.bank) extractedBank = localResult.bank;
        if (localResult.status) extractedStatus = localResult.status;
        if (localResult.recipientName) extractedRecipientName = localResult.recipientName;
        if (localResult.recipientAccount) extractedRecipientAccount = localResult.recipientAccount;
        if (localResult.date) {
          const dateStr = localResult.time
            ? `${localResult.date}T${localResult.time}`
            : localResult.date;
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) receiptTransferDate = parsed;
          extractedDateTime = localResult.time
            ? `${localResult.date} ${localResult.time}`
            : localResult.date;
        }
      } catch (e) {
        console.warn("[ParentAPI] Local OCR failed:", e);
      }

      // 2) LLM fallback
      if (!extractedAmount || extractedAmount === "0" || extractedAmount === amount) {
        try {
          const ocrResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  '你是一個銀行轉帳收據識別助手。請從收據中提取以下資訊並以純JSON格式回傳：\n{"amount":"金額","bank":"銀行名","status":"成功/失敗","date":"YYYY-MM-DD","time":"HH:mm","recipientName":"收款人","recipientAccount":"帳號"}\n無法識別的欄位回傳 null。只回傳JSON。',
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "請識別這張轉帳收據:" },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: "high" },
                  },
                ],
              },
            ],
          });
          const content = ocrResponse.choices[0]?.message?.content;
          if (typeof content === "string") {
            const clean = content
              .replace(/^```(?:json)?\s*\n?/i, "")
              .replace(/\n?```\s*$/i, "")
              .trim();
            const ocrData = JSON.parse(clean);
            if (ocrData.amount) {
              const p = parseFloat(ocrData.amount.replace(/[^0-9.]/g, ""));
              if (!isNaN(p) && p > 0) extractedAmount = p.toString();
            }
            if (ocrData.bank) extractedBank = ocrData.bank;
            if (ocrData.status) extractedStatus = ocrData.status;
            if (ocrData.recipientName && !extractedRecipientName) extractedRecipientName = ocrData.recipientName;
            if (ocrData.recipientAccount && !extractedRecipientAccount)
              extractedRecipientAccount = ocrData.recipientAccount.replace(/[^0-9]/g, "");
            if (ocrData.date) {
              const ds = ocrData.time ? `${ocrData.date}T${ocrData.time}` : ocrData.date;
              const pd = new Date(ds);
              if (!isNaN(pd.getTime())) receiptTransferDate = pd;
              extractedDateTime = ocrData.time ? `${ocrData.date} ${ocrData.time}` : ocrData.date;
            }
          }
        } catch (llmErr) {
          console.warn("[ParentAPI] LLM OCR failed:", llmErr);
        }
      }

      // ── Stamp receipt ──────────────────────────────────────────────
      const student = await getStudentById(numericStudentId);
      if (!student) {
        return res.status(404).json({ success: false, error: "學生不存在" });
      }

      let stampedReceiptUrl = receiptUrl;
      let stampedReceiptKey = receiptKey;
      try {
        const parsedCustomMonths = customMonths ? JSON.parse(customMonths) : undefined;
        const stampedBuffer = await stampReceipt(receiptBuffer, mimeType, {
          studentName: student.name,
          amount: extractedAmount || amount,
          paymentPeriod,
          customMonths: parsedCustomMonths,
          dojoName: student.venue || undefined,
        });
        const sKey = `receipts/stamped-${numericStudentId}-${Date.now()}.${fileExt}`;
        const sResult = await storagePut(sKey, stampedBuffer, mimeType);
        stampedReceiptUrl = sResult.url;
        stampedReceiptKey = sKey;
      } catch (e) {
        console.warn("[ParentAPI] Receipt stamp failed:", e);
      }

      // ── Validate amount & recipient ────────────────────────────────
      const parsedAmount = parseFloat(extractedAmount);
      const expectedAmount = parseFloat(student.feePerQuarter);
      const isAmountValid = parsedAmount === expectedAmount;

      let isRecipientValid = false;
      let recipientCheckNote = "";
      try {
        const validationEnabled = await getSystemConfig("receipt_validation_enabled");
        if (validationEnabled === "true") {
          const accepted = await getAcceptedPayeeAccounts();
          if (accepted.length === 0) {
            isRecipientValid = true;
          } else {
            const cleanAcct = (extractedRecipientAccount || "").replace(/[^0-9]/g, "");
            const cleanName = (extractedRecipientName || "").toUpperCase().trim();
            for (const a of accepted) {
              const ca = a.account.replace(/[^0-9]/g, "");
              const cn = a.name.toUpperCase().trim();
              if (
                (cleanAcct && ca && (cleanAcct.includes(ca) || ca.includes(cleanAcct))) ||
                (cleanName && cn && (cleanName.includes(cn) || cn.includes(cleanName)))
              ) {
                isRecipientValid = true;
                break;
              }
            }
            if (!isRecipientValid) {
              recipientCheckNote = `收款人不匹配: ${extractedRecipientName || "未識別"}`;
            }
          }
        } else {
          isRecipientValid = true;
        }
      } catch {
        isRecipientValid = true;
      }

      let pendingReason = "";
      if (!isAmountValid) pendingReason += `金額不符(識別=${parsedAmount}, 預期=${expectedAmount})`;
      if (!isRecipientValid) {
        if (pendingReason) pendingReason += "; ";
        pendingReason += recipientCheckNote;
      }
      const recordStatus = isAmountValid && isRecipientValid ? "confirmed" : "pending";

      // ── Insert payment record ──────────────────────────────────────
      const parsedCustomMonths2 = customMonths ? JSON.parse(customMonths) : null;
      const newPaymentId = await insertPaymentRecord({
        studentId: numericStudentId,
        paymentPeriod,
        customMonths: parsedCustomMonths2,
        amount: extractedAmount,
        classCount: classCount ? parseInt(classCount) : null,
        receiptUrl: stampedReceiptUrl,
        receiptKey: stampedReceiptKey,
        receiptTransferDate,
        paymentDate: new Date(),
        status: recordStatus,
        confirmedBy: "parent_upload",
      });

      // Auto sync confirmed to accounting
      if (recordStatus === "confirmed") {
        try {
          await syncPaymentToAccounting({
            paymentRecordId: newPaymentId,
            transactionDate: receiptTransferDate || new Date(),
            amount: extractedAmount,
            bank: extractedBank,
            studentName: student.name,
            coachName: student.coach,
            dojoName: student.venue || null,
            category: "tuition",
            receiptUrl: stampedReceiptUrl,
            receiptKey: stampedReceiptKey,
          });
        } catch (e) {
          console.error("[ParentAPI] Accounting sync failed:", e);
        }
      }

      return res.json({
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
      });
    } catch (err: any) {
      console.error("[ParentAPI] upload error:", err);
      return res.status(500).json({ success: false, error: "上傳失敗" });
    }
  }
);

// ── GET /events ──────────────────────────────────────────────────────────
parentRouter.get("/events", async (_req: AuthenticatedRequest, res) => {
  try {
    const events = await getOpenEvents();
    return res.json(events);
  } catch (err: any) {
    console.error("[ParentAPI] events error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /events/my-registrations ─────────────────────────────────────────
parentRouter.get("/events/my-registrations", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const registrations = await getEventRegistrations(undefined, phone);
    return res.json(registrations);
  } catch (err: any) {
    console.error("[ParentAPI] my-registrations error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── POST /events/register ────────────────────────────────────────────────
parentRouter.post("/events/register", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const { eventId, studentId, eliteStudentId, studentName, notes } = req.body;
    if (!eventId || !studentName) {
      return res.status(400).json({ success: false, error: "缺少必要欄位" });
    }

    // Check duplicate
    const existing = await getEventRegistrations(eventId, phone);
    const dup = existing.find(
      (r: any) => r.studentName === studentName && r.status !== "cancelled"
    );
    if (dup) {
      return res.status(409).json({ success: false, error: "該學生已報名此活動" });
    }

    // Check capacity
    const count = await getEventRegistrationCount(eventId);
    const allEvents = await getAllEvents();
    const event = allEvents.find((e: any) => e.id === eventId);
    if (event?.maxParticipants && count >= event.maxParticipants) {
      return res.status(409).json({ success: false, error: "報名人數已滿" });
    }

    const result = await registerForEvent({
      eventId,
      studentId: studentId || null,
      eliteStudentId: eliteStudentId || null,
      studentName,
      phone,
      status: "registered",
      notes: notes || null,
    });
    return res.json({ success: true, id: result.insertId });
  } catch (err: any) {
    console.error("[ParentAPI] register error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ── POST /events/cancel ──────────────────────────────────────────────────
parentRouter.post("/events/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "缺少報名 ID" });
    }
    await cancelEventRegistration(id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[ParentAPI] cancel error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ── GET /exam-results ────────────────────────────────────────────────────
parentRouter.get("/exam-results", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const results = await getExamResultsByPhone(phone);
    return res.json(results);
  } catch (err: any) {
    console.error("[ParentAPI] exam-results error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

// ── POST /change-password ────────────────────────────────────────────────
parentRouter.post("/change-password", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "請輸入舊密碼和新密碼" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "新密碼至少需要6個字元" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: "系統錯誤" });
    }

    const studentResult = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.phone, phone))
      .limit(1);
    if (studentResult.length === 0) {
      return res.status(404).json({ success: false, error: "找不到帳號" });
    }

    const student = studentResult[0] as any;
    let isValid = false;
    if (!student.password) {
      isValid = oldPassword === phone;
    } else {
      isValid = await verifyPassword(oldPassword, student.password);
    }
    if (!isValid) {
      return res.status(401).json({ success: false, error: "舊密碼錯誤" });
    }

    const hashed = await hashPassword(newPassword);
    await db
      .update(studentsTable)
      .set({ password: hashed } as any)
      .where(eq(studentsTable.phone, phone));

    return res.json({ success: true, message: "密碼已成功修改" });
  } catch (err: any) {
    console.error("[ParentAPI] change-password error:", err);
    return res.status(500).json({ success: false, error: "系統錯誤" });
  }
});

// ── GET /profile ─────────────────────────────────────────────────────────
// Returns a summary for the app's home screen
parentRouter.get("/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const phone = req.parentPhone!;
    const regular = await getStudentsByPhone(phone);
    const elite = await getEliteStudentsByPhone(phone);
    return res.json({
      phone,
      regularStudentCount: regular?.length || 0,
      eliteStudentCount: elite?.length || 0,
      students: (regular || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        belt: s.belt,
        venue: s.venue,
        coach: s.coach,
      })),
      eliteStudents: (elite || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        beltLevel: s.beltLevel,
      })),
    });
  } catch (err: any) {
    console.error("[ParentAPI] profile error:", err);
    return res.status(500).json({ error: "系統錯誤" });
  }
});

export { parentRouter };
