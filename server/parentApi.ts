/**
 * Parent App REST API Router
 * 
 * Provides a complete REST API for the parent mobile app.
 * All routes are prefixed with /api/v1/parent.
 * 
 * Public routes (no auth):
 *   POST /login
 * 
 * Protected routes (JWT required):
 *   GET  /me                    - Get current parent info
 *   GET  /students              - Get parent's students (regular + elite)
 *   GET  /attendance            - Get attendance records
 *   GET  /monthly-statuses      - Get monthly payment statuses
 *   GET  /elite-info            - Get elite class info
 *   GET  /payments              - Get payment records
 *   POST /payments/upload       - Upload receipt (multipart/form-data)
 *   GET  /events                - Get open events
 *   GET  /events/my             - Get parent's event registrations
 *   POST /events/register       - Register for event
 *   POST /events/cancel         - Cancel event registration
 *   GET  /exam-results          - Get exam results
 *   POST /change-password       - Change password
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  generateToken,
  parentAuthMiddleware,
  type AuthenticatedRequest,
} from "./parentAuth";
import { verifyPassword, hashPassword } from "./password";
import {
  getDb,
  getStudentsByPhone,
  getEliteStudentsByPhone,
  getParentAttendanceRecords,
  getParentEliteInfo,
  getMonthlyPaymentStatuses,
  getPaymentRecordsByStudentIds,
  insertPaymentRecord,
  getStudentById,
  getOpenEvents,
  getEventRegistrations,
  getEventRegistrationCount,
  registerForEvent,
  cancelEventRegistration,
  getAllEvents,
  getExamResultsByPhone,
} from "./db";
import { storagePut } from "./storage";
import { ocrReceipt } from "./_core/localOcr";
import { invokeLLM } from "./_core/llm";
import { stampReceipt } from "./_core/receiptStamp";
import { getAcceptedPayeeAccounts, syncPaymentToAccounting } from "./db";
import { students, eliteStudents } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";

// ── Multer config ────────────────────────────────────────────────────────
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
export const parentRouter = Router();

// ── Helper: wrap async handlers ──────────────────────────────────────────
function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response) => Promise<void>
) {
  return (req: Request, res: Response) => {
    fn(req as AuthenticatedRequest, res).catch((err) => {
      console.error("[ParentAPI] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "伺服器錯誤", code: "SERVER_ERROR" });
      }
    });
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC: Login
// ═══════════════════════════════════════════════════════════════════════════
parentRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ success: false, error: "請輸入電話號碼和密碼" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ success: false, error: "系統錯誤" });
      return;
    }

    // Query both regular and elite students
    const regularStudents = await getStudentsByPhone(phone);
    const eliteStudentList = await getEliteStudentsByPhone(phone);

    if (
      (!regularStudents || regularStudents.length === 0) &&
      (!eliteStudentList || eliteStudentList.length === 0)
    ) {
      res.status(401).json({ success: false, error: "找不到此電話號碼的學生記錄" });
      return;
    }

    // Use regular student for auth, fallback to elite
    const primaryStudent =
      regularStudents && regularStudents.length > 0 ? regularStudents[0] : null;
    const primaryElite =
      eliteStudentList && eliteStudentList.length > 0
        ? eliteStudentList[0]
        : null;
    const authTarget: any = primaryStudent || primaryElite;

    if (!authTarget) {
      res.status(401).json({ success: false, error: "找不到此電話號碼的學生記錄" });
      return;
    }

    // No password set → phone number is default password
    let needPasswordChange = false;
    if (!authTarget.password) {
      if (password === phone) {
        needPasswordChange = true;
      } else {
        res.status(401).json({ success: false, error: "密碼錯誤" });
        return;
      }
    } else {
      const isValid = await verifyPassword(password, authTarget.password);
      if (!isValid) {
        res.status(401).json({ success: false, error: "密碼錯誤" });
        return;
      }
    }

    // Generate JWT
    const token = generateToken(phone);

    res.json({
      success: true,
      token,
      needPasswordChange,
      students: regularStudents || [],
      hasElite: (eliteStudentList && eliteStudentList.length > 0) || false,
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
//  All routes below require JWT
// ═══════════════════════════════════════════════════════════════════════════
parentRouter.use(parentAuthMiddleware as any);

// ── GET /me ──────────────────────────────────────────────────────────────
parentRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const [regularStudents, eliteStudentList] = await Promise.all([
      getStudentsByPhone(phone),
      getEliteStudentsByPhone(phone),
    ]);
    res.json({
      phone,
      students: regularStudents || [],
      eliteStudents: eliteStudentList || [],
    });
  })
);

// ── GET /students ────────────────────────────────────────────────────────
parentRouter.get(
  "/students",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const [regularStudents, eliteStudentList] = await Promise.all([
      getStudentsByPhone(phone),
      getEliteStudentsByPhone(phone),
    ]);
    res.json({
      regular: regularStudents || [],
      elite: eliteStudentList || [],
    });
  })
);

// ── GET /attendance?year=&month= ─────────────────────────────────────────
parentRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const records = await getParentAttendanceRecords(phone, year, month);
    res.json(records);
  })
);

// ── GET /monthly-statuses?year= ──────────────────────────────────────────
parentRouter.get(
  "/monthly-statuses",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;
    const all = await getMonthlyPaymentStatuses(year);
    const filtered = all.filter((s: any) => s.phone === phone);
    res.json(filtered);
  })
);

// ── GET /elite-info ──────────────────────────────────────────────────────
parentRouter.get(
  "/elite-info",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const info = await getParentEliteInfo(phone);
    res.json(info);
  })
);

// ── GET /payments ────────────────────────────────────────────────────────
parentRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const regularStudents = await getStudentsByPhone(phone);
    if (!regularStudents || regularStudents.length === 0) {
      res.json([]);
      return;
    }
    const studentIds = regularStudents.map((s: any) => s.id);
    const payments = await getPaymentRecordsByStudentIds(studentIds);
    res.json(payments);
  })
);

// ── POST /payments/upload ────────────────────────────────────────────────
// multipart/form-data:
//   receipt: File (image)
//   studentId: number
//   paymentPeriod: Q1 | Q2 | Q3 | Q4 | CUSTOM
//   customMonths: string (JSON array, optional)
//   amount: string
//   classCount: number (optional, for elite)
parentRouter.post(
  "/payments/upload",
  upload.single("receipt"),
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;

    if (!req.file) {
      res.status(400).json({ error: "請上傳收據圖片" });
      return;
    }

    const { studentId, paymentPeriod, customMonths, amount, classCount } = req.body;

    if (!studentId || !paymentPeriod || !amount) {
      res.status(400).json({ error: "缺少必要欄位 (studentId, paymentPeriod, amount)" });
      return;
    }

    const parsedStudentId = parseInt(studentId);

    // Verify student belongs to this parent
    const parentStudents = await getStudentsByPhone(phone);
    const isOwned = parentStudents?.some((s: any) => s.id === parsedStudentId);
    if (!isOwned) {
      res.status(403).json({ error: "無權限為此學生上傳收據" });
      return;
    }

    // Upload receipt to storage
    const receiptBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const fileExt = mimeType.split("/")[1] || "jpg";
    const receiptKey = `receipts/${parsedStudentId}-${Date.now()}.${fileExt}`;
    const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, mimeType);

    // OCR to extract info
    let extractedAmount = amount;
    let receiptTransferDate: Date | null = null;
    let extractedBank: string | null = null;
    let extractedStatus: string | null = null;
    let extractedDateTime: string | null = null;
    let extractedRecipientName: string | null = null;
    let extractedRecipientAccount: string | null = null;

    const base64 = receiptBuffer.toString("base64");

    // Method 1: Local Tesseract OCR
    try {
      const localResult = await ocrReceipt(base64, mimeType);
      if (localResult.amount) extractedAmount = localResult.amount;
      if (localResult.bank) extractedBank = localResult.bank;
      if (localResult.status) extractedStatus = localResult.status;
      if (localResult.recipientName) extractedRecipientName = localResult.recipientName;
      if (localResult.recipientAccount) extractedRecipientAccount = localResult.recipientAccount;
      if (localResult.date) {
        const dateStr = localResult.time ? `${localResult.date}T${localResult.time}` : localResult.date;
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) receiptTransferDate = parsedDate;
        extractedDateTime = localResult.time ? `${localResult.date} ${localResult.time}` : localResult.date;
      }
    } catch (err) {
      console.warn("[ParentAPI/OCR] Tesseract failed:", err instanceof Error ? err.message : String(err));
    }

    // Method 2: LLM fallback
    if (!extractedAmount || extractedAmount === "0" || extractedAmount === amount) {
      try {
        const ocrResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                '你是一個銀行轉帳收據識別助手。請從收據中提取以下資訊並以純JSON回傳：\n{"amount":"金額","bank":"銀行","status":"狀態","date":"YYYY-MM-DD","time":"HH:mm","recipientName":"收款人","recipientAccount":"帳號"}\n無法識別的欄位回傳null。',
            },
            {
              role: "user",
              content: [
                { type: "text", text: "請識別這張轉帳收據:" },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
                },
              ],
            },
          ],
        });

        const content = ocrResponse.choices[0]?.message?.content;
        if (typeof content === "string") {
          const cleanJson = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          const ocrData = JSON.parse(cleanJson);
          if (ocrData.amount) {
            const p = parseFloat(ocrData.amount.replace(/[^0-9.]/g, ""));
            if (!isNaN(p) && p > 0) extractedAmount = p.toString();
          }
          if (ocrData.bank) extractedBank = ocrData.bank;
          if (ocrData.status) extractedStatus = ocrData.status;
          if (ocrData.recipientName && !extractedRecipientName) extractedRecipientName = ocrData.recipientName;
          if (ocrData.recipientAccount && !extractedRecipientAccount) extractedRecipientAccount = ocrData.recipientAccount.replace(/[^0-9]/g, "");
          if (ocrData.date) {
            const dateStr = ocrData.time ? `${ocrData.date}T${ocrData.time}` : ocrData.date;
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) receiptTransferDate = parsedDate;
          }
        }
      } catch (llmErr) {
        console.warn("[ParentAPI/OCR] LLM failed:", llmErr instanceof Error ? llmErr.message : String(llmErr));
      }
    }

    // Stamp receipt
    const student = await getStudentById(parsedStudentId);
    let stampedReceiptUrl = receiptUrl;
    let stampedReceiptKey = receiptKey;
    if (student) {
      try {
        const parsedCustomMonths = customMonths ? JSON.parse(customMonths) : undefined;
        const stampedBuffer = await stampReceipt(receiptBuffer, mimeType, {
          studentName: student.name,
          amount: extractedAmount || amount,
          paymentPeriod,
          customMonths: parsedCustomMonths,
          dojoName: (student as any).venue || undefined,
        });
        const stampedKey = `receipts/stamped-${parsedStudentId}-${Date.now()}.${fileExt}`;
        const stamped = await storagePut(stampedKey, stampedBuffer, mimeType);
        stampedReceiptUrl = stamped.url;
        stampedReceiptKey = stampedKey;
      } catch (e) {
        console.warn("[ParentAPI] Receipt stamp failed:", e);
      }
    }

    // Verify receipt against accepted payee accounts
    let receiptVerified: boolean | null = null;
    try {
      if (extractedRecipientName || extractedRecipientAccount) {
        const acceptedAccounts = await getAcceptedPayeeAccounts();
        if (acceptedAccounts.length > 0) {
          receiptVerified = acceptedAccounts.some(
            (a: any) =>
              (extractedRecipientAccount && a.accountNumber === extractedRecipientAccount) ||
              (extractedRecipientName && a.accountName && extractedRecipientName.includes(a.accountName))
          );
        }
      }
    } catch (_e) {}

    // Insert payment record
    const parsedCustomMonthsForDb = customMonths
      ? typeof customMonths === "string" ? customMonths : JSON.stringify(customMonths)
      : null;

    const paymentRecordId = await insertPaymentRecord({
      studentId: parsedStudentId,
      paymentPeriod,
      customMonths: parsedCustomMonthsForDb,
      amount: extractedAmount || amount,
      classCount: classCount ? parseInt(classCount) : null,
      receiptUrl: stampedReceiptUrl,
      receiptKey: stampedReceiptKey,
      receiptTransferDate,
      paymentDate: new Date(),
      status: "pending",
      confirmedBy: "parent_upload",
      receiptBank: extractedBank,
      receiptStatus: extractedStatus,
      receiptDateTime: extractedDateTime,
      receiptRecipientName: extractedRecipientName,
      receiptRecipientAccount: extractedRecipientAccount,
      receiptVerified,
    } as any);

    res.json({
      success: true,
      paymentRecordId,
      extractedAmount,
      receiptUrl: stampedReceiptUrl,
      receiptVerified,
    });
  })
);

// ── GET /events ──────────────────────────────────────────────────────────
parentRouter.get(
  "/events",
  asyncHandler(async (_req, res) => {
    const events = await getOpenEvents();
    res.json(events);
  })
);

// ── GET /events/my ───────────────────────────────────────────────────────
parentRouter.get(
  "/events/my",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const registrations = await getEventRegistrations(undefined, phone);
    res.json(registrations);
  })
);

// ── POST /events/register ────────────────────────────────────────────────
parentRouter.post(
  "/events/register",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const { eventId, studentId, eliteStudentId, studentName, notes } = req.body;

    if (!eventId || !studentName) {
      res.status(400).json({ error: "缺少 eventId 或 studentName" });
      return;
    }

    // Check duplicate registration
    const existing = await getEventRegistrations(eventId, phone);
    const already = existing.find(
      (r: any) => r.studentName === studentName && r.status !== "cancelled"
    );
    if (already) {
      res.status(409).json({ error: "該學生已報名此活動" });
      return;
    }

    // Check participant limit
    const count = await getEventRegistrationCount(eventId);
    const allEvents = await getAllEvents();
    const event = allEvents.find((e: any) => e.id === eventId);
    if (event?.maxParticipants && count >= event.maxParticipants) {
      res.status(409).json({ error: "報名人數已滿" });
      return;
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

    res.json({ success: true, id: result.insertId });
  })
);

// ── POST /events/cancel ──────────────────────────────────────────────────
parentRouter.post(
  "/events/cancel",
  asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: "缺少報名 id" });
      return;
    }
    await cancelEventRegistration(id);
    res.json({ success: true });
  })
);

// ── GET /exam-results ────────────────────────────────────────────────────
parentRouter.get(
  "/exam-results",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const results = await getExamResultsByPhone(phone);
    res.json(results);
  })
);

// ── POST /change-password ────────────────────────────────────────────────
parentRouter.post(
  "/change-password",
  asyncHandler(async (req, res) => {
    const phone = req.parentPhone!;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: "請輸入舊密碼和新密碼" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "新密碼至少需要6個字元" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "系統錯誤" });
      return;
    }

    // Find student record
    const studentResult = await db
      .select()
      .from(students)
      .where(eq(students.phone, phone))
      .limit(1);

    if (studentResult.length === 0) {
      res.status(404).json({ error: "找不到此電話號碼的帳號" });
      return;
    }

    const student = studentResult[0] as any;

    // Verify old password
    let isValid = false;
    if (!student.password) {
      isValid = oldPassword === phone;
    } else {
      isValid = await verifyPassword(oldPassword, student.password);
    }

    if (!isValid) {
      res.status(401).json({ error: "舊密碼錯誤" });
      return;
    }

    // Update password
    const hashed = await hashPassword(newPassword);
    await db
      .update(schema.students)
      .set({ password: hashed } as any)
      .where(eq(schema.students.phone, phone));

    res.json({ success: true, message: "密碼已成功修改" });
  })
);
