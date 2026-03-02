/**
 * Push Notification Helper Module
 * 
 * All automated push notifications are queued into push_queue table
 * and require admin approval before being sent.
 * 
 * Key functions:
 *   queuePushNotification()  — insert into push_queue (status = pending)
 *   executePushFromQueue()   — actually send push (called after admin approval)
 *   queue*()                 — scenario-specific queue helpers
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

// ════════════════════════════════════════════════════════════════════════
//  Push Queue — insert into push_queue table for admin review
// ════════════════════════════════════════════════════════════════════════

export interface QueuePushParams {
  title: string;
  body: string;
  targetType: "individual" | "role" | "all" | "class" | "coach_students";
  targetStudentIds?: Array<{ id: number; type: string; name: string }> | null;
  studentType?: "regular" | "elite" | "both";
  triggerSource: string;
  triggerDetail?: Record<string, any> | null;
}

/**
 * Insert a push notification into the push_queue for admin review.
 * Returns the queue item ID.
 */
export async function queuePushNotification(params: QueuePushParams): Promise<number | null> {
  try {
    const pool = await getRawPool();
    if (!pool) return null;

    const [result] = await pool.execute(
      `INSERT INTO push_queue (title, body, target_type, target_student_ids, student_type, trigger_source, trigger_detail, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        params.title,
        params.body,
        params.targetType,
        params.targetStudentIds ? JSON.stringify(params.targetStudentIds) : null,
        params.studentType || "regular",
        params.triggerSource,
        params.triggerDetail ? JSON.stringify(params.triggerDetail) : null,
      ]
    ) as any;

    const queueId = result?.insertId || null;
    console.log(`[PushQueue] Queued push #${queueId}: "${params.title}" (${params.triggerSource})`);
    return queueId;
  } catch (err) {
    console.error("[PushQueue] queuePushNotification error:", err);
    return null;
  }
}

/**
 * Execute (actually send) a queued push notification after admin approval.
 * Resolves tokens and sends via Expo, then logs to notifications table.
 */
export async function executePushFromQueue(queueId: number): Promise<{ sentCount: number; success: boolean }> {
  try {
    const pool = await getRawPool();
    if (!pool) return { sentCount: 0, success: false };

    // 1. Fetch the queue item
    const [rows] = await pool.execute(
      "SELECT * FROM push_queue WHERE id = ?",
      [queueId]
    ) as any;

    if (!rows || rows.length === 0) {
      console.error(`[PushQueue] Queue item #${queueId} not found`);
      return { sentCount: 0, success: false };
    }

    const item = rows[0];

    // 2. Resolve tokens based on target_type
    let tokens: string[] = [];
    const targetType = item.target_type;

    if (targetType === "all") {
      const [allRows] = await pool.execute("SELECT DISTINCT token FROM push_tokens") as any;
      tokens = (allRows || []).map((r: any) => r.token);
    } else if (targetType === "role") {
      // target_student_ids is used to store role name for 'role' type
      const roleName = "parent"; // default for auto pushes
      const [roleRows] = await pool.execute(
        "SELECT DISTINCT token FROM push_tokens WHERE role = ?",
        [roleName]
      ) as any;
      tokens = (roleRows || []).map((r: any) => r.token);
    } else if (targetType === "individual") {
      // Resolve phones for each student in target_student_ids
      const targets = typeof item.target_student_ids === "string"
        ? JSON.parse(item.target_student_ids)
        : item.target_student_ids;

      if (Array.isArray(targets)) {
        const allPhones: string[] = [];
        for (const t of targets) {
          const sType = (t.type === "elite" ? "elite" : "regular") as "regular" | "elite";
          const phones = await getPushPhonesForStudent(t.id, sType);
          allPhones.push(...phones);
        }
        const uniquePhones = [...new Set(allPhones)];
        tokens = await getTokensByPhones(uniquePhones);
      }
    }

    tokens = tokens.filter(t => Expo.isExpoPushToken(t));

    // 3. Send push notifications
    const sentCount = await sendPushNotifications(
      tokens,
      item.title,
      item.body,
      { type: item.trigger_source, queueId },
    );

    // 4. Update queue item with sent count
    await pool.execute(
      "UPDATE push_queue SET sent_count = ? WHERE id = ?",
      [sentCount, queueId]
    );

    // 5. Log to notifications table
    await pool.execute(
      `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.title, item.body, "system", "system", targetType, JSON.stringify(item.target_student_ids), sentCount]
    );

    console.log(`[PushQueue] Executed push #${queueId}: sent to ${sentCount} devices`);
    return { sentCount, success: true };
  } catch (err) {
    console.error("[PushQueue] executePushFromQueue error:", err);
    return { sentCount: 0, success: false };
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Push Queue Admin Operations
// ════════════════════════════════════════════════════════════════════════

/**
 * List push queue items by status
 */
export async function listPushQueue(status?: string, limit: number = 50, offset: number = 0) {
  try {
    const pool = await getRawPool();
    if (!pool) return [];

    let query = "SELECT * FROM push_queue";
    const params: any[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params) as any;

    // Parse JSON fields
    return (rows || []).map((row: any) => ({
      ...row,
      targetStudentIds: typeof row.target_student_ids === "string"
        ? JSON.parse(row.target_student_ids)
        : row.target_student_ids,
      triggerDetail: typeof row.trigger_detail === "string"
        ? JSON.parse(row.trigger_detail)
        : row.trigger_detail,
    }));
  } catch (err) {
    console.error("[PushQueue] listPushQueue error:", err);
    return [];
  }
}

/**
 * Get a single push queue item by ID
 */
export async function getPushQueueById(id: number) {
  try {
    const pool = await getRawPool();
    if (!pool) return null;

    const [rows] = await pool.execute("SELECT * FROM push_queue WHERE id = ?", [id]) as any;
    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    return {
      ...row,
      targetStudentIds: typeof row.target_student_ids === "string"
        ? JSON.parse(row.target_student_ids)
        : row.target_student_ids,
      triggerDetail: typeof row.trigger_detail === "string"
        ? JSON.parse(row.trigger_detail)
        : row.trigger_detail,
    };
  } catch (err) {
    console.error("[PushQueue] getPushQueueById error:", err);
    return null;
  }
}

/**
 * Approve a queued push → execute it
 */
export async function approvePushQueue(id: number, reviewedBy: string): Promise<{ success: boolean; sentCount: number }> {
  try {
    const pool = await getRawPool();
    if (!pool) return { success: false, sentCount: 0 };

    // Check current status
    const [rows] = await pool.execute("SELECT status FROM push_queue WHERE id = ?", [id]) as any;
    if (!rows?.length) return { success: false, sentCount: 0 };
    if (rows[0].status !== "pending") return { success: false, sentCount: 0 };

    // Mark as approved
    await pool.execute(
      "UPDATE push_queue SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [reviewedBy, id]
    );

    // Execute the push
    const result = await executePushFromQueue(id);
    return { success: result.success, sentCount: result.sentCount };
  } catch (err) {
    console.error("[PushQueue] approvePushQueue error:", err);
    return { success: false, sentCount: 0 };
  }
}

/**
 * Reject a queued push
 */
export async function rejectPushQueue(id: number, reviewedBy: string, reason?: string): Promise<boolean> {
  try {
    const pool = await getRawPool();
    if (!pool) return false;

    const [rows] = await pool.execute("SELECT status FROM push_queue WHERE id = ?", [id]) as any;
    if (!rows?.length || rows[0].status !== "pending") return false;

    await pool.execute(
      "UPDATE push_queue SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), reject_reason = ? WHERE id = ?",
      [reviewedBy, reason || null, id]
    );

    console.log(`[PushQueue] Rejected push #${id} by ${reviewedBy}: ${reason || "no reason"}`);
    return true;
  } catch (err) {
    console.error("[PushQueue] rejectPushQueue error:", err);
    return false;
  }
}

/**
 * Get count of pending push queue items
 */
export async function getPendingPushQueueCount(): Promise<number> {
  try {
    const pool = await getRawPool();
    if (!pool) return 0;

    const [rows] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM push_queue WHERE status = 'pending'"
    ) as any;
    return rows?.[0]?.cnt || 0;
  } catch {
    return 0;
  }
}

/**
 * Batch approve multiple queue items
 */
export async function batchApprovePushQueue(ids: number[], reviewedBy: string): Promise<{ approved: number; totalSent: number }> {
  let approved = 0;
  let totalSent = 0;
  for (const id of ids) {
    const result = await approvePushQueue(id, reviewedBy);
    if (result.success) {
      approved++;
      totalSent += result.sentCount;
    }
  }
  return { approved, totalSent };
}

/**
 * Batch reject multiple queue items
 */
export async function batchRejectPushQueue(ids: number[], reviewedBy: string, reason?: string): Promise<number> {
  let rejected = 0;
  for (const id of ids) {
    const ok = await rejectPushQueue(id, reviewedBy, reason);
    if (ok) rejected++;
  }
  return rejected;
}

// ════════════════════════════════════════════════════════════════════════
//  Scenario-specific QUEUE functions (replacing direct send)
// ════════════════════════════════════════════════════════════════════════

/**
 * 1. 精英班點名後 → 排入佇列「小明 已完成第 X/12 堂訓練」
 */
export async function queueEliteClassProgress(
  studentId: number,
  studentName: string,
  cycleNumber: number,
  totalAttended: number,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("elite_class_progress");
  if (!enabled) return null;

  return await queuePushNotification({
    title: "精英班訓練通知",
    body: `${studentName} 已完成第 ${cycleNumber}/12 堂訓練（累計第 ${totalAttended} 堂）`,
    targetType: "individual",
    targetStudentIds: [{ id: studentId, type: "elite", name: studentName }],
    studentType: "elite",
    triggerSource: "elite_class_progress",
    triggerDetail: { cycleNumber, totalAttended, senderPhone },
  });
}

/**
 * 2. 管理員確認繳費 → 排入佇列「繳費已確認」
 */
export async function queuePaymentConfirmed(
  studentId: number,
  studentType: "regular" | "elite",
  studentName: string,
  amount: string,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("payment_confirmed");
  if (!enabled) return null;

  return await queuePushNotification({
    title: "繳費確認",
    body: `${studentName} 的繳費 $${Number(amount).toLocaleString()} 已確認，感謝！`,
    targetType: "individual",
    targetStudentIds: [{ id: studentId, type: studentType, name: studentName }],
    studentType: studentType,
    triggerSource: "payment_confirmed",
    triggerDetail: { amount, senderPhone },
  });
}

/**
 * 3. 新活動/考試建立 → 排入佇列通知全部家長
 */
export async function queueNewEvent(
  eventTitle: string,
  eventDate: string | null,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("new_event");
  if (!enabled) return null;

  const body = eventDate
    ? `新活動：${eventTitle}（${eventDate}），請查看詳情並報名`
    : `新活動：${eventTitle}，請查看詳情並報名`;

  return await queuePushNotification({
    title: "新活動通知",
    body,
    targetType: "role",
    studentType: "both",
    triggerSource: "new_event",
    triggerDetail: { eventTitle, eventDate, senderPhone },
  });
}

/**
 * 4. 精英班剩餘堂數 ≤ 2 → 排入佇列「請準備續費」
 */
export async function queueEliteLowBalance(
  studentId: number,
  studentName: string,
  remainingClasses: number,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("elite_low_balance");
  if (!enabled) return null;

  return await queuePushNotification({
    title: "精英班續費提醒",
    body: `${studentName} 精英班剩餘 ${remainingClasses} 堂，請準備續費（12堂 $2,400）`,
    targetType: "individual",
    targetStudentIds: [{ id: studentId, type: "elite", name: studentName }],
    studentType: "elite",
    triggerSource: "elite_low_balance",
    triggerDetail: { remainingClasses, senderPhone },
  });
}

/**
 * 5. 考試成績公布 → 排入佇列通知相關家長
 */
export async function queueExamResult(
  studentId: number,
  examName: string,
  studentName: string,
  passed: boolean,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("exam_result");
  if (!enabled) return null;

  const body = passed
    ? `恭喜！${studentName} 在「${examName}」中通過考試，即將升級！`
    : `${studentName} 在「${examName}」的考試結果已公布，請查看詳情`;

  return await queuePushNotification({
    title: "考試結果通知",
    body,
    targetType: "individual",
    targetStudentIds: [{ id: studentId, type: "regular", name: studentName }],
    studentType: "both",
    triggerSource: "exam_result",
    triggerDetail: { examName, passed, senderPhone },
  });
}

/**
 * 6. 繳費逾期 30 天 → 排入佇列催繳通知
 */
export async function queuePaymentOverdue(
  studentId: number,
  studentName: string,
  senderPhone: string,
): Promise<number | null> {
  const enabled = await isPushEnabled("payment_overdue");
  if (!enabled) return null;

  return await queuePushNotification({
    title: "繳費提醒",
    body: `提醒：${studentName} 本季度學費尚未繳納，請盡快處理`,
    targetType: "individual",
    targetStudentIds: [{ id: studentId, type: "regular", name: studentName }],
    studentType: "regular",
    triggerSource: "payment_overdue",
    triggerDetail: { senderPhone },
  });
}

// ════════════════════════════════════════════════════════════════════════
//  7. 收據審查通知 — 這些仍然直接發送（不進佇列）因為是通知管理員
// ════════════════════════════════════════════════════════════════════════

/**
 * 通知管理員有新的待審查收據 (直接發送，不走佇列)
 */
export async function notifyAdminReviewNeeded(params: {
  studentName: string;
  amount: string;
  matchType: string;
  reason: string;
}) {
  try {
    const pool = await getRawPool();
    if (!pool) return;

    // 取得所有管理員的 push tokens
    const [rows] = await pool.execute(
      "SELECT DISTINCT token FROM push_tokens WHERE role = 'admin'"
    ) as any;
    const tokens = (rows || []).map((r: any) => r.token).filter((t: string) => Expo.isExpoPushToken(t));

    if (tokens.length === 0) {
      console.log("[PushHelper] 沒有管理員 push token，跳過審查通知");
      return;
    }

    const matchTypeLabels: Record<string, string> = {
      'same_amount_date': '同金額+同日期',
      'same_transaction_ref': '疑似同一筆交易',
      'exact_image': '相同收據圖片',
      'similar_image': '相似收據圖片',
    };

    const title = "📋 收據需要審查";
    const body = `${params.studentName} 上傳的收據($${params.amount})疑似重複：${matchTypeLabels[params.matchType] || params.matchType}`;

    await sendPushNotifications(tokens, title, body, { type: "receipt_review" });

    // 寫入 notifications 表
    await pool.execute(
      `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, body, "system", "system", "role", "admin", tokens.length]
    );

    console.log(`[PushHelper] 已通知 ${tokens.length} 位管理員審查收據`);
  } catch (err) {
    console.error("[PushHelper] notifyAdminReviewNeeded error:", err);
  }
}

/**
 * 通知家長收據審查結果 (直接發送，不走佇列)
 */
export async function notifyParentReviewResult(params: {
  studentId: number;
  studentType: 'regular' | 'elite';
  studentName: string;
  decision: 'approved' | 'rejected';
  amount: string;
}) {
  try {
    const enabled = await isPushEnabled("receipt_review_result");
    if (!enabled) return;

    const title = params.decision === 'approved' ? "✅ 收據審查通過" : "❌ 收據審查未通過";
    const body = params.decision === 'approved'
      ? `${params.studentName} 的繳費收據($${params.amount})已通過審查，繳費確認完成。`
      : `${params.studentName} 的繳費收據($${params.amount})審查未通過，請重新上傳正確的轉帳收據。`;

    const phones = await getPushPhonesForStudent(params.studentId, params.studentType);
    const tokens = await getTokensByPhones(phones);
    const sentCount = await sendPushNotifications(tokens, title, body, { type: "receipt_review_result", decision: params.decision });

    const pool = await getRawPool();
    if (pool) {
      await pool.execute(
        `INSERT INTO notifications (title, body, sender_phone, sender_role, target_type, target_value, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, body, "system", "system", "individual", phones.join(","), sentCount]
      );
    }
  } catch (err) {
    console.error("[PushHelper] notifyParentReviewResult error:", err);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Legacy exports — kept for backward compatibility during migration
//  These now queue instead of sending directly.
// ════════════════════════════════════════════════════════════════════════

/** @deprecated Use queueEliteClassProgress instead */
export const notifyEliteClassProgress = queueEliteClassProgress;

/** @deprecated Use queuePaymentConfirmed instead */
export const notifyPaymentConfirmed = queuePaymentConfirmed;

/** @deprecated Use queueNewEvent instead */
export const notifyNewEvent = queueNewEvent;

/** @deprecated Use queueEliteLowBalance instead */
export const notifyEliteLowBalance = queueEliteLowBalance;

/** @deprecated Use queueExamResult instead */
export const notifyExamResult = queueExamResult;

/** @deprecated Use queuePaymentOverdue instead */
export const notifyPaymentOverdue = queuePaymentOverdue;

// Keep old function for all parents (now queues)
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

    await queuePushNotification({
      title,
      body,
      targetType: "role",
      studentType: "both",
      triggerSource: settingKey,
      triggerDetail: { senderPhone, ...(data || {}) },
    });

    return true;
  } catch (err) {
    console.error("[PushHelper] sendToAllParentsAndLog error:", err);
    return false;
  }
}
