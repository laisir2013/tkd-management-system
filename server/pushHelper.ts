/**
 * Push Notification Helper Module
 * 
 * Provides utility functions for sending automated push notifications
 * with per-type enable/disable settings from push_settings table.
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

// ── Send + Log to notifications table ─────────────────────────────────
export async function sendAndLog(
  settingKey: string,
  phones: string[],
  title: string,
  body: string,
  senderPhone: string,
  senderRole: string,
  targetType: string,
  targetValue: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    const enabled = await isPushEnabled(settingKey);
    if (!enabled) return false;

    const tokens = await getTokensByPhones(phones);
    const sentCount = await sendPushNotifications(tokens, title, body, data);

    // Log to notifications table
    const pool = await getRawPool();
    if (pool) {
      await pool.execute(
        `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, body, senderPhone, senderRole, targetType, targetValue, sentCount]
      );
    }

    return true;
  } catch (err) {
    console.error("[PushHelper] sendAndLog error:", err);
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
//  Scenario-specific push functions
// ════════════════════════════════════════════════════════════════════════

/**
 * 1. 精英班點名後 → 通知家長「小明 已完成第 X/12 堂訓練」
 */
export async function notifyEliteClassProgress(
  studentName: string,
  studentPhone: string,
  cycleNumber: number,
  totalAttended: number,
  senderPhone: string,
) {
  const title = "精英班訓練通知";
  const body = `${studentName} 已完成第 ${cycleNumber}/12 堂訓練（累計第 ${totalAttended} 堂）`;

  await sendAndLog(
    "elite_class_progress",
    [studentPhone],
    title, body,
    senderPhone, "system",
    "individual", studentPhone,
    { type: "elite_progress", cycleNumber, totalAttended },
  );
}

/**
 * 2. 管理員確認繳費 → 通知家長「繳費已確認」
 */
export async function notifyPaymentConfirmed(
  studentName: string,
  parentPhone: string,
  amount: string,
  senderPhone: string,
) {
  const title = "繳費確認";
  const body = `${studentName} 的繳費 $${Number(amount).toLocaleString()} 已確認，感謝！`;

  await sendAndLog(
    "payment_confirmed",
    [parentPhone],
    title, body,
    senderPhone, "admin",
    "individual", parentPhone,
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
  studentName: string,
  studentPhone: string,
  remainingClasses: number,
  senderPhone: string,
) {
  const title = "精英班續費提醒";
  const body = `${studentName} 精英班剩餘 ${remainingClasses} 堂，請準備續費（12堂 $2,400）`;

  await sendAndLog(
    "elite_low_balance",
    [studentPhone],
    title, body,
    senderPhone, "system",
    "individual", studentPhone,
    { type: "elite_low_balance", remainingClasses },
  );
}

/**
 * 5. 考試成績公布 → 通知相關家長
 */
export async function notifyExamResult(
  examName: string,
  studentName: string,
  studentPhone: string,
  passed: boolean,
  senderPhone: string,
) {
  const title = "考試結果通知";
  const body = passed
    ? `恭喜！${studentName} 在「${examName}」中通過考試，即將升級！`
    : `${studentName} 在「${examName}」的考試結果已公布，請查看詳情`;

  await sendAndLog(
    "exam_result",
    [studentPhone],
    title, body,
    senderPhone, "admin",
    "individual", studentPhone,
    { type: "exam_result", passed },
  );
}

/**
 * 6. 繳費逾期 30 天 → 催繳通知
 */
export async function notifyPaymentOverdue(
  studentName: string,
  parentPhone: string,
  senderPhone: string,
) {
  const title = "繳費提醒";
  const body = `提醒：${studentName} 本季度學費尚未繳納，請盡快處理`;

  await sendAndLog(
    "payment_overdue",
    [parentPhone],
    title, body,
    senderPhone, "system",
    "individual", parentPhone,
    { type: "payment_overdue" },
  );
}
