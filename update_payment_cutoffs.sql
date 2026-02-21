-- 計算邏輯：
-- cutoff date 那堂（含）之前的出席 present 堂數，向上取整到 12 的倍數 = paid_classes
-- 插入 elite_payments 記錄
-- remaining_classes = paid_classes - total_present (系統自動計算)

-- 先清除這8位學生的舊 payment 記錄（如有）
DELETE FROM elite_payments WHERE student_id IN (25, 26, 11, 30, 36, 4, 5, 17);

-- 徐志杰(25): cutoff 2025-07-27, present_before=95 → ceil(95/12)*12 = 8*12=96
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (25, 96, 19200.00, '2025-07-27', 'confirmed', '2025/7/27前視為已付款 (出席95堂，付96堂)');

-- 李弘正(26): cutoff 2025-06-22, present_before=96 → ceil(96/12)*12 = 8*12=96
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (26, 96, 19200.00, '2025-06-22', 'confirmed', '2025/6/22前視為已付款 (出席96堂，付96堂)');

-- 楊惜林(11): cutoff 2024-12-22, present_before=70 → ceil(70/12)*12 = 6*12=72
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (11, 72, 14400.00, '2024-12-22', 'confirmed', '2024/12/22前視為已付款 (出席70堂，付72堂)');

-- Luna Petralia(30): cutoff 2025-01-05, present_before=73 → ceil(73/12)*12 = 7*12=84
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (30, 84, 16800.00, '2025-01-05', 'confirmed', '2025/1/5前視為已付款 (出席73堂，付84堂)');

-- 王浩宇(36): cutoff 2026-01-04, present_before=91 → ceil(91/12)*12 = 8*12=96
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (36, 96, 19200.00, '2026-01-04', 'confirmed', '2026/1/4前視為已付款 (出席91堂，付96堂)');

-- 韓灝南(4): cutoff 2025-08-10, present_before=24 → ceil(24/12)*12 = 2*12=24
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (4, 24, 4800.00, '2025-08-10', 'confirmed', '2025/8/10前視為已付款 (出席24堂，付24堂)');

-- 龐兆羽(5): cutoff 2025-08-10, present_before=25 → ceil(25/12)*12 = 3*12=36
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (5, 36, 7200.00, '2025-08-10', 'confirmed', '2025/8/10前視為已付款 (出席25堂，付36堂)');

-- 蔡宏鑫(17): cutoff 2026-01-04, present_before=14 → ceil(14/12)*12 = 2*12=24
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, status, notes)
VALUES (17, 24, 4800.00, '2026-01-04', 'confirmed', '2026/1/4前視為已付款 (出席14堂，付24堂)');

