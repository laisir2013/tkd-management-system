import { getDb } from './server/db';

async function check() {
  const db = await getDb();
  if (!db) { console.log("DB not available"); return; }

  const [elitePayments] = await db.execute(`
    SELECT ep.id, ep.student_id, ep.class_count, ep.amount, ep.status, ep.payment_date, ep.confirmed_by, es.name as student_name
    FROM elite_payments ep
    LEFT JOIN elite_students es ON ep.student_id = es.id
    ORDER BY ep.payment_date DESC
  `);
  console.log("\n=== 精英班繳費記錄 (elite_payments) ===");
  console.log("共 " + (elitePayments as any[]).length + " 筆");
  for (const p of elitePayments as any[]) {
    console.log("  ID:" + p.id + " | " + p.student_name + " | " + p.class_count + "堂 | $" + p.amount + " | " + p.status + " | " + new Date(p.payment_date).toLocaleDateString('zh-HK') + " | " + p.confirmed_by);
  }

  const [accountingElite] = await db.execute(`
    SELECT id, elite_payment_record_id, amount, description, student_name, dojo_name, transaction_date, source
    FROM accounting_records
    WHERE elite_payment_record_id IS NOT NULL
    ORDER BY transaction_date DESC
  `);
  console.log("\n=== 會計記錄中精英班收入 ===");
  console.log("共 " + (accountingElite as any[]).length + " 筆");
  for (const a of accountingElite as any[]) {
    console.log("  ID:" + a.id + " | elite_pay_id:" + a.elite_payment_record_id + " | $" + a.amount + " | " + a.student_name + " | " + a.dojo_name + " | " + new Date(a.transaction_date).toLocaleDateString('zh-HK'));
  }

  const [orphaned] = await db.execute(`
    SELECT ep.id, ep.student_id, ep.amount, ep.payment_date, ep.status, es.name as student_name
    FROM elite_payments ep
    LEFT JOIN elite_students es ON ep.student_id = es.id
    LEFT JOIN accounting_records ar ON ar.elite_payment_record_id = ep.id
    WHERE ep.status = 'confirmed' AND ar.id IS NULL
    ORDER BY ep.payment_date DESC
  `);
  console.log("\n=== ⚠️ 已確認但未同步到會計的精英班繳費 ===");
  console.log("共 " + (orphaned as any[]).length + " 筆遺漏");
  for (const o of orphaned as any[]) {
    console.log("  ⚠️ elite_payment ID:" + o.id + " | " + o.student_name + " | $" + o.amount + " | " + new Date(o.payment_date).toLocaleDateString('zh-HK'));
  }

  const [allTuition] = await db.execute(`
    SELECT id, amount, description, student_name, dojo_name, payment_record_id, elite_payment_record_id, source, transaction_date
    FROM accounting_records
    WHERE category = 'tuition'
    ORDER BY transaction_date DESC
    LIMIT 30
  `);
  console.log("\n=== 會計記錄中所有學費 (最近30筆) ===");
  console.log("共 " + (allTuition as any[]).length + " 筆");
  for (const t of allTuition as any[]) {
    const tag = t.elite_payment_record_id ? '精英班' : t.payment_record_id ? '恆常班' : '手動';
    console.log("  ID:" + t.id + " | " + tag + " | $" + t.amount + " | " + (t.student_name || '-') + " | " + (t.dojo_name || '-') + " | " + new Date(t.transaction_date).toLocaleDateString('zh-HK') + " | " + t.source);
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
