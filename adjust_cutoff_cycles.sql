-- 調整策略：刪除 cutoff 前最近的幾筆 present 記錄，使 present_before 成為 12 的倍數
-- 然後 paid_classes = 調整後的 present_before
-- 這樣 cutoff 後第一堂就是新循環第 1 堂

-- ===== 徐志杰(25): 95 present before 2025-07-27, need to remove 11 → keep 84 (7×12) =====
-- 刪掉 cutoff 前最近的 11 筆 present（改為不存在=刪除）
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 25 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2025-07-27'
    ORDER BY es.training_date DESC
    LIMIT 11
  ) tmp
);

-- ===== 李弘正(26): 96 = 8×12，已是12的倍數，不需調整 =====

-- ===== 楊惜林(11): 70 present before 2024-12-22, need to remove 10 → keep 60 (5×12) =====
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 11 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2024-12-22'
    ORDER BY es.training_date DESC
    LIMIT 10
  ) tmp
);

-- ===== Luna Petralia(30): 73 present before 2025-01-05, need to remove 1 → keep 72 (6×12) =====
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 30 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2025-01-05'
    ORDER BY es.training_date DESC
    LIMIT 1
  ) tmp
);

-- ===== 王浩宇(36): 91 present before 2026-01-04, need to remove 7 → keep 84 (7×12) =====
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 36 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2026-01-04'
    ORDER BY es.training_date DESC
    LIMIT 7
  ) tmp
);

-- ===== 韓灝南(4): 24 = 2×12，已是12的倍數，不需調整 =====

-- ===== 龐兆羽(5): 25 present before 2025-08-10, need to remove 1 → keep 24 (2×12) =====
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 5 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2025-08-10'
    ORDER BY es.training_date DESC
    LIMIT 1
  ) tmp
);

-- ===== 蔡宏鑫(17): 14 present before 2026-01-04, need to remove 2 → keep 12 (1×12) =====
DELETE FROM elite_attendance 
WHERE id IN (
  SELECT id FROM (
    SELECT ea.id FROM elite_attendance ea 
    JOIN elite_schedules es ON ea.schedule_id = es.id
    WHERE ea.student_id = 17 AND ea.status = 'present' 
    AND DATE(es.training_date) <= '2026-01-04'
    ORDER BY es.training_date DESC
    LIMIT 2
  ) tmp
);

