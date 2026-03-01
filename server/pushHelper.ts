/**
 * Push Notification Helper Module
 * 
 * Provides utility functions for sending automated push notifications
 * with per-type enable/disable settings from push_settings table.
 * 
 * Uses student_contacts table to resolve phones for each student,
 * with fallback to the student's own phone field.
 * 
 * All push calls are wrapped in try-catch so failures never block the main operation.
 */
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import mysql from "mysql2/promise";

const expo = new Expo();

// ── Raw MySQL pool (shared with parentApi) ────────────────────────────
let _rawPool: mysql.Pool | null = null;
export async function getRawPool(): Promise<mysql.Pool | null> {
  if (!_rawPool && process.env.DATABASE_URL) {
    _rawPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return _rawPool;
}

// ── Check if a push setting is enabled ────────────────────────────────
export async function isPushEnabled(settingKey: string): Promise<boolean> {
  try {
    const pool = await getRawPool();
    if (!pool) return false;
    const [rows] = await pool.execute(
      "SELECT enabled FROM push_settings WHERE setting_key = ?",
      [settingKey]
    ) as any;
    if (rows.length > 0) return rows[0].enabled === 1;
    return false;
  } catch {
    return false;
  }
}

// ── Get push tokens by phone numbers ──────────────────────────────────
export async function getTokensByPhones(phones: string[]): Promise<string[]> {
  if (phones.length === 0) return [];
  try {
    const pool = await getRawPool();
    if (!pool) return [];
    const placeholders = phones.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT DISTINCT token FROM push_tokens WHERE phone IN (${placeholders})`,
      phones
    ) as any;
    return (rows || []).map((r: any) => r.token).filter((t: string) => Expo.isExpoPushToken(t));
  } catch {
    return [];
  }
}

// ── Get all parent tokens ─────────────────────────────────────────────
export async function getAllParentTokens(): Promise<string[]> {
  try {
    const pool = await getRawPool();
    if (!pool) return [];
    const [rows] = await pool.execute(
      "SELECT DISTINCT token FROM push_tokens WHERE role = 'parent'"
    ) as any;
    return (rows || []).map((r: any) => r.token).filter((t: string) => Expo.isExpoPushToken(t));
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Student Contacts — phone resolution
// ════════════════════════════════════════════════════════════════════════

/**
 * Get all push-enabled phone numbers for a student from student_contacts.
 * Falls back to the student's own phone if no contacts found.
 */
export async function getPushPhonesForStudent(
  studentId: number,
  studentType: "regular" | "elite" = "regular",
): Promise<string[]> {
  try {
    const pool = await getRawPool();
    if (!pool) return [];

    const [rows] = await pool.execute(
      `SELECT DISTINCT phone FROM student_contacts
       WHERE student_id = ? AND student_type = ? AND receive_push = 1`,
      [studentId, studentType]
    ) as any;

    const phones: string[] = (rows || []).map((r: any) => r.phone);

    // Fallback: if no contacts, use the student table phone
    if (phones.length === 0) {
      const table = studentType === "elite" ? "elite_students" : "students";
      const [fallback] = await pool.execute(
        `SELECT phone FROM ${table} WHERE id = ?`, [studentId]
      ) as any;
      if (fallback?.[0]?.phone) {
        phones.push(fallback[0].phone);
      }
    }

    return phones;
  } catch (err) {
    console.error("[PushHelper] getPushPhonesForStudent error:", err);
    return [];
  }
}

// ── Send push notifications (generic) ─────────────────────────────────
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: data || {},
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sentCount = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "ok") sentCount++;
      }
    } catch (err) {
      console.error("[PushHelper] send error:", err);
    }
  }

  return sentCount;
}

// ── Send + Log helper (internal) ─────────────────────────────────────
async function sendToStudentAndLog(
  settingKey: string,
  studentId: number,
  studentType: "regular" | "elite",
  title: string,
  body: string,
  senderPhone: string,
  senderRole: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    const enabled = await isPushEnabled(settingKey);
    if (!enabled) return false;

    const phones = await getPushPhonesForStudent(studentId, studentType);
    const tokens = await getTokensByPhones(phones);
    const sentCount = await sendPushNotifications(tokens, title, body, data);

    // Log to notifications table
    const pool = await getRawPool();
    if (pool) {
      await pool.execute(
        `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, body, senderPhone, senderRole, "individual", phones.join(","), sentCount]
      );
    }

    return true;
  } catch (err) {
    console.error("[PushHelper] sendToStudentAndLog error:", err);
    return false;
  }
}

// ── Send to all parents + Log ─────────────────────────────────────────
export async function sendToAllParentsAndLog(
  settingKey: string,
  title: string,
  body: string,
  senderPhone: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    const enabled = await isPushEnabled(settingKey);
    if (!enabled) return false;

    const tokens = await getAllParentTokens();
    const sentCount = await sendPushNotifications(tokens, title, body, data);

    const pool = await getRawPool();
    if (pool) {
      await pool.execute(
        `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, body, senderPhone, "system", "role", "parent", sentCount]
      );
    }

    return true;
  } catch (err) {
    console.error("[PushHelper] sendToAllParentsAndLog error:", err);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Scenario-specific push functions (using student_contacts)
// ════════════════════════════════════════════════════════════════════════

/**
 * 1. 精英班點名後 → 通知家長「小明 已完成第 X/12 堂訓練」
 */
export async function notifyEliteClassProgress(
  studentId: number,
  studentName: string,
  cycleNumber: number,
  totalAttended: number,
  senderPhone: string,
) {
  const title = "精英班訓練通知";
  const body = `${studentName} 已完成第 ${cycleNumber}/12 堂訓練（累計第 ${totalAttended} 堂）`;

  await sendToStudentAndLog(
    "elite_class_progress",
    studentId, "elite",
    title, body,
    senderPhone, "system",
    { type: "elite_progress", cycleNumber, totalAttended },
  );
}

/**
 * 2. 管理員確認繳費 → 通知家長「繳費已確認」
 */
export async function notifyPaymentConfirmed(
  studentId: number,
  studentType: "regular" | "elite",
  studentName: string,
  amount: string,
  senderPhone: string,
) {
  const title = "繳費確認";
  const body = `${studentName} 的繳費 $${Number(amount).toLocaleString()} 已確認，感謝！`;

  await sendToStudentAndLog(
    "payment_confirmed",
    studentId, studentType,
    title, body,
    senderPhone, "admin",
    { type: "payment_confirmed" },
  );
}

/**
 * 3. 新活動/考試建立 → 通知全部家長
 */
export async function notifyNewEvent(
  eventTitle: string,
  eventDate: string | null,
  senderPhone: string,
) {
  const title = "新活動通知";
  const body = eventDate
    ? `新活動：${eventTitle}（${eventDate}），請查看詳情並報名`
    : `新活動：${eventTitle}，請查看詳情並報名`;

  await sendToAllParentsAndLog(
    "new_event",
    title, body,
    senderPhone,
    { type: "new_event" },
  );
}

/**
 * 4. 精英班剩餘堂數 ≤ 2 → 通知家長「請準備續費」
 */
export async function notifyEliteLowBalance(
  studentId: number,
  studentName: string,
  remainingClasses: number,
  senderPhone: string,
) {
  const title = "精英班續費提醒";
  const body = `${studentName} 精英班剩餘 ${remainingClasses} 堂，請準備續費（12堂 $2,400）`;

  await sendToStudentAndLog(
    "elite_low_balance",
    studentId, "elite",
    title, body,
    senderPhone, "system",
    { type: "elite_low_balance", remainingClasses },
  );
}

/**
 * 5. 考試成績公布 → 通知相關家長
 *    考生可能是恆常班或精英班，兩邊都查
 */
export async function notifyExamResult(
  studentId: number,
  examName: string,
  studentName: string,
  passed: boolean,
  senderPhone: string,
) {
  try {
    const enabled = await isPushEnabled("exam_result");
    if (!enabled) return;

    // Gather phones from both regular and elite contacts
    const regularPhones = await getPushPhonesForStudent(studentId, "regular");
    const elitePhones = await getPushPhonesForStudent(studentId, "elite");
    const phones = [...new Set([...regularPhones, ...elitePhones])];

    const title = "考試結果通知";
    const body = passed
      ? `恭喜！${studentName} 在「${examName}」中通過考試，即將升級！`
      : `${studentName} 在「${examName}」的考試結果已公布，請查看詳情`;

    const tokens = await getTokensByPhones(phones);
    const sentCount = await sendPushNotifications(tokens, title, body, { type: "exam_result", passed });

    const pool = await getRawPool();
    if (pool) {
      await pool.execute(
        `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, body, senderPhone, "admin", "individual", phones.join(","), sentCount]
      );
    }
  } catch (err) {
    console.error("[PushHelper] notifyExamResult error:", err);
  }
}

/**
 * 6. 繳費逾期 30 天 → 催繳通知
 */
export async function notifyPaymentOverdue(
  studentId: number,
  studentName: string,
  senderPhone: string,
) {
  const title = "繳費提醒";
  const body = `提醒：${studentName} 本季度學費尚未繳納，請盡快處理`;

  await sendToStudentAndLog(
    "payment_overdue",
    studentId, "regular",
    title, body,
    senderPhone, "system",
    { type: "payment_overdue" },
  );
}
