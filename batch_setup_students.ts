import mysql from 'mysql2/promise';

interface StudentSetup {
  name: string;
  joinDate: string; // YYYY-MM-DD
}

const students: StudentSetup[] = [
  { name: '徐志杰', joinDate: '2023-03-05' },
  { name: '李弘正', joinDate: '2023-01-29' },
  { name: '蔡御霆', joinDate: '2022-12-27' },
  { name: '黃頌琛', joinDate: '2023-01-15' },
  { name: '楊惜林', joinDate: '2022-12-27' },
  { name: 'Luna Petralia', joinDate: '2022-12-04' },
  { name: '鄒曉澄', joinDate: '2022-12-04' },
  { name: '鄒詩雅', joinDate: '2022-12-04' },
  { name: '江哲男', joinDate: '2022-12-27' },
  { name: '曾祉媃', joinDate: '2023-03-12' },
  { name: '王浩宇', joinDate: '2023-03-19' },
  { name: '吳傲天', joinDate: '2024-03-03' },
  { name: '黃銘軒', joinDate: '2024-07-07' },
  { name: '朱棋楓', joinDate: '2024-03-10' },
  { name: '葉栩靖', joinDate: '2024-09-08' },
  { name: '葉駿輝', joinDate: '2024-09-08' },
  { name: '李泳霖', joinDate: '2025-03-23' },
  { name: '郭俊康', joinDate: '2024-10-27' },
  { name: '丁子聰', joinDate: '2025-02-23' },
  { name: '楊廷諄', joinDate: '2024-03-03' },
  { name: '譚子鋭', joinDate: '2024-03-03' },
  { name: '黃天愉', joinDate: '2024-09-22' },
  { name: '黃煒庭', joinDate: '2024-10-27' },
  { name: '韓灝南', joinDate: '2024-09-22' },
  { name: '龐兆羽', joinDate: '2024-09-22' },
  { name: '施俊杰', joinDate: '2025-01-25' },
  { name: '李梓皓', joinDate: '2024-03-17' },
  { name: '蔡宏鑫', joinDate: '2025-02-26' },
  { name: '劉玥', joinDate: '2025-02-26' },
  { name: '王嘉楷', joinDate: '2025-02-22' },
  { name: '楊猷宸', joinDate: '2025-08-10' },
  { name: '周泓謙', joinDate: '2025-08-31' },
];

// 所有學生的繳費截止日統一為今天（即到目前為止都算已付清）
const CUTOFF = '2026-02-22';

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost', user: 'tkd_user', password: 'tkd_pass_2026',
    database: 'taekwondo', charset: 'UTF8MB4_GENERAL_CI',
  });

  // 預載 schedule map
  const [schedRows] = await pool.query('SELECT id, DATE(training_date) as dt, status FROM elite_schedules ORDER BY training_date') as any[];
  const schedules = schedRows.map((r: any) => ({
    id: r.id,
    date: typeof r.dt === 'string' ? r.dt : r.dt.toISOString().slice(0, 10),
    status: r.status,
  }));

  console.log(`共 ${students.length} 位學生需要處理\n`);

  for (const s of students) {
    // 1. 找到學生 ID
    const [rows] = await pool.query('SELECT id, name FROM elite_students WHERE name = ?', [s.name]) as any[];
    if (rows.length === 0) {
      console.log(`❌ 找不到學生: ${s.name}`);
      continue;
    }
    const studentId = rows[0].id;

    // 2. 設定 join_date
    await pool.query('UPDATE elite_students SET join_date = ? WHERE id = ?', [`${s.joinDate} 00:00:00`, studentId]);

    // 3. 找出 joinDate ~ CUTOFF 之間的活躍訓練日
    const eligibleSchedules = schedules.filter((sc: any) =>
      sc.status === 'active' && sc.date >= s.joinDate && sc.date < CUTOFF
    );

    // 4. 查看已有的 attendance 記錄
    const [existingRows] = await pool.query(
      'SELECT schedule_id, status FROM elite_attendance WHERE student_id = ?', [studentId]
    ) as any[];
    const existingMap = new Map<number, string>();
    existingRows.forEach((r: any) => existingMap.set(r.schedule_id, r.status));

    // 5. 對每個符合條件的訓練日：沒記錄的 → 插入 present
    const toInsert: number[] = [];
    let excusedCount = 0;
    let alreadyPresent = 0;

    for (const sc of eligibleSchedules) {
      const existing = existingMap.get(sc.id);
      if (!existing) {
        toInsert.push(sc.id);
      } else if (existing === 'excused') {
        excusedCount++;
      } else if (existing === 'present' || existing === 'late') {
        alreadyPresent++;
      }
    }

    // Batch insert
    if (toInsert.length > 0) {
      const placeholders = toInsert.map(() => '(?, ?, ?)').join(', ');
      const values = toInsert.flatMap(schedId => [schedId, studentId, 'present']);
      await pool.query(
        `INSERT INTO elite_attendance (schedule_id, student_id, status) VALUES ${placeholders}`,
        values
      );
    }

    const totalPresent = toInsert.length + alreadyPresent;
    const totalAttended = totalPresent; // present + late

    // 6. 計算繳費堂數，讓循環歸零（12的倍數）
    // 先算全部 present/late 記錄（含 CUTOFF 之後的）
    const [allAttRows] = await pool.query(
      "SELECT COUNT(*) as cnt FROM elite_attendance WHERE student_id = ? AND status IN ('present', 'late')",
      [studentId]
    ) as any[];
    const totalAllPresent = allAttRows[0].cnt;

    // 繳費堂數 = 最接近且 >= totalAllPresent 的 12 的倍數（或剛好等於 totalAllPresent 如果是 12 的倍數）
    const paidClasses = Math.ceil(totalAllPresent / 12) * 12;

    // 7. 清除舊繳費記錄，插入新的
    await pool.query('DELETE FROM elite_payments WHERE student_id = ?', [studentId]);
    if (paidClasses > 0) {
      await pool.query(
        `INSERT INTO elite_payments (student_id, class_count, amount, payment_date, confirmed_by, status, notes)
         VALUES (?, ?, 0.00, ?, 'admin_approved', 'confirmed', ?)`,
        [studentId, paidClasses, `${s.joinDate} 00:00:00`, `${s.joinDate}~目前 期間已付款（系統補錄，${paidClasses}堂）`]
      );
    }

    const remaining = paidClasses - totalAllPresent;

    console.log(`✅ ${s.name} (id=${studentId})`);
    console.log(`   加入: ${s.joinDate} | 新增出席: ${toInsert.length} | 請假: ${excusedCount} | 已繳: ${paidClasses} | 剩餘: ${remaining}`);
  }

  // 最終驗證
  console.log('\n========== 驗證 ==========');
  const [verifyRows] = await pool.query(`
    SELECT es.name, es.join_date,
      (SELECT COUNT(*) FROM elite_attendance ea WHERE ea.student_id = es.id AND ea.status = 'present') as present_cnt,
      (SELECT COUNT(*) FROM elite_attendance ea WHERE ea.student_id = es.id AND ea.status = 'excused') as excused_cnt,
      (SELECT COALESCE(SUM(ep.class_count), 0) FROM elite_payments ep WHERE ep.student_id = es.id AND ep.status = 'confirmed') as paid
    FROM elite_students es
    WHERE es.name IN (${students.map(() => '?').join(',')})
    ORDER BY es.id
  `, students.map(s => s.name)) as any[];

  for (const r of verifyRows) {
    const present = r.present_cnt;
    const cycleNum = present === 0 ? 0 : ((present - 1) % 12) + 1;
    const remaining = r.paid - present;
    console.log(`${r.name}: 出席=${present}, 請假=${r.excused_cnt}, 已繳=${r.paid}, 剩餘=${remaining}, 循環=${cycleNum}/12`);
  }

  await pool.end();
}

main().catch(console.error);
