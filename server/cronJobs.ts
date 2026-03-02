/**
 * Cron Jobs Module
 * 
 * Scheduled tasks that run on a timer, e.g. overdue payment reminders.
 * Uses node-cron for scheduling. All notifications go through pushHelper
 * which now queues them into push_queue for admin review.
 */
import cron from "node-cron";
import { getRawPool, isPushEnabled, queuePaymentOverdue } from "./pushHelper";

/**
 * Check for overdue payments and queue reminders.
 * 
 * Logic:
 * - Find active students whose latest payment status is "pending" (unconfirmed)
 *   AND the paymentDate is older than 30 days.
 * - Avoid spamming: only re-queue if the last overdue notification for
 *   that student was sent more than 7 days ago.
 */
export async function checkOverduePayments(): Promise<void> {
  console.log("[CronJob] checkOverduePayments running at", new Date().toISOString());

  try {
    // 1. Check if this push type is enabled
    const enabled = await isPushEnabled("payment_overdue");
    if (!enabled) {
      console.log("[CronJob] payment_overdue push disabled, skipping");
      return;
    }

    const pool = await getRawPool();
    if (!pool) {
      console.log("[CronJob] No DB pool, skipping");
      return;
    }

    // 2. Find students with pending payments older than 30 days
    const [rows] = await pool.execute(`
      SELECT 
        pr.id AS paymentRecordId,
        pr.studentId,
        s.name AS studentName,
        s.phone AS parentPhone,
        pr.paymentDate,
        pr.amount,
        pr.paymentPeriod
      FROM paymentRecords pr
      JOIN students s ON s.id = pr.studentId
      WHERE pr.status = 'pending'
        AND s.status = 'active'
        AND pr.paymentDate < DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY pr.paymentDate ASC
    `) as any;

    if (!rows || rows.length === 0) {
      console.log("[CronJob] No overdue payments found");
      return;
    }

    console.log(`[CronJob] Found ${rows.length} overdue payment(s)`);

    // 3. For each overdue payment, check last notification time
    for (const row of rows) {
      try {
        // Check if we already notified/queued this student within last 7 days
        const [recent] = await pool.execute(`
          SELECT id FROM notifications 
          WHERE target_type = 'individual' 
            AND title = '繳費提醒'
            AND body LIKE ?
            AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          LIMIT 1
        `, [`%${row.studentName}%`]) as any;

        if (recent && recent.length > 0) {
          console.log(`[CronJob] Already notified ${row.studentName} within 7 days, skipping`);
          continue;
        }

        // Also check if there's a pending queue item for this student
        const [pendingQueue] = await pool.execute(`
          SELECT id FROM push_queue 
          WHERE trigger_source = 'payment_overdue' 
            AND status = 'pending'
            AND body LIKE ?
            AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          LIMIT 1
        `, [`%${row.studentName}%`]) as any;

        if (pendingQueue && pendingQueue.length > 0) {
          console.log(`[CronJob] Already queued ${row.studentName} within 7 days, skipping`);
          continue;
        }

        // 4. Queue notification (now goes to push_queue for admin review)
        await queuePaymentOverdue(
          row.studentId,
          row.studentName,
          "system", // sender is system/cron
        );

        console.log(`[CronJob] Queued overdue notification for ${row.studentName} (studentId: ${row.studentId})`);
      } catch (innerErr) {
        console.error(`[CronJob] Error processing student ${row.studentId}:`, innerErr);
      }
    }

    console.log("[CronJob] checkOverduePayments completed");
  } catch (err) {
    console.error("[CronJob] checkOverduePayments error:", err);
  }
}

/**
 * Start all scheduled cron jobs.
 * Call this once from server entry.
 */
export function startCronJobs(): void {
  // Run daily at 10:00 AM (Hong Kong time / server time)
  cron.schedule("0 10 * * *", () => {
    checkOverduePayments();
  }, {
    timezone: "Asia/Hong_Kong",
  });

  console.log("[CronJob] Scheduled: checkOverduePayments daily at 10:00 (Asia/Hong_Kong)");
}
