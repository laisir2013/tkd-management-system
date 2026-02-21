-- ============ 管理員帳號 ============
INSERT INTO users (openId, name, email, phone, password, loginMethod, role, coach_name) VALUES
('admin-local', '系統管理員', 'admin@tkd.local', '88888888', '$2b$10$XQGe3D79hb/7ijqxwWTEx.KB9umi5qAxTAGEuQ2hvQAFlzbTlF1Tu', 'phone', 'admin', NULL);

-- ============ 教練帳號 ============
INSERT INTO users (openId, name, email, phone, password, loginMethod, role, coach_name) VALUES
('coach-lai', '賴政堡教練', 'coach@tkd.local', '99999999', '$2b$10$3mE4bo.KPz/DWbPEUnnEM.DqRsJpoxUFz/7jB3hONDNZaX1Q9k5cO', 'phone', 'coach', '賴政堡教練');

-- ============ 道場 ============
INSERT INTO dojos (name, schedule_day, schedule_time, coach_name, color, status) VALUES
('中正道場', '星期三', '18:30-20:00', '賴政堡教練', '#3b82f6', 'active'),
('信義道場', '星期六', '10:00-11:30', '賴政堡教練', '#10b981', 'active'),
('大安道場', '星期四', '19:00-20:30', '賴政堡教練', '#f59e0b', 'active');

-- ============ 恆常班學生 ============
INSERT INTO students (name, birthDate, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, status) VALUES
('陳小明', '2015-03-15', '98765432', '$2b$10$Ec.1XI24hTRM9HxEoDN7B.aIlIkH3OrMBuLCWSZejb1ZVyR9sFSE2', '中正道場', '星期三', '18:30-20:00', '3600.00', '白帶', 'active'),
('陳小華', '2017-08-20', '98765432', '$2b$10$Ec.1XI24hTRM9HxEoDN7B.aIlIkH3OrMBuLCWSZejb1ZVyR9sFSE2', '中正道場', '星期三', '18:30-20:00', '3600.00', '黃帶', 'active'),
('林志偉', '2014-11-05', '91234567', '$2b$10$surzagYdPRTjdqXwOiVolOLWllyM7klo5Vmm7s5HHCO5TyNRhbEMC', '信義道場', '星期六', '10:00-11:30', '3600.00', '綠帶', 'active'),
('王美玲', '2016-01-22', '91234567', '$2b$10$surzagYdPRTjdqXwOiVolOLWllyM7klo5Vmm7s5HHCO5TyNRhbEMC', '信義道場', '星期六', '10:00-11:30', '3600.00', '白帶', 'active'),
('張大偉', '2013-06-10', '92222222', NULL, '大安道場', '星期四', '19:00-20:30', '3600.00', '藍帶', 'active'),
('李小龍', '2015-09-30', '93333333', NULL, '大安道場', '星期四', '19:00-20:30', '3600.00', '黃帶', 'active'),
('黃小芳', '2016-12-01', '94444444', NULL, '中正道場', '星期三', '18:30-20:00', '3600.00', '白帶', 'active'),
('吳俊傑', '2014-04-18', '95555555', NULL, '信義道場', '星期六', '10:00-11:30', '3600.00', '紅帶', 'active');

-- ============ 精英班學生 ============
INSERT INTO elite_students (name, phone, password, belt_level, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES
('陳小明', '98765432', '$2b$10$Ec.1XI24hTRM9HxEoDN7B.aIlIkH3OrMBuLCWSZejb1ZVyR9sFSE2', '白帶', '星期日', '12:00-2:00pm', '200.00', 8, 'active'),
('林志偉', '91234567', '$2b$10$surzagYdPRTjdqXwOiVolOLWllyM7klo5Vmm7s5HHCO5TyNRhbEMC', '綠帶', '星期日', '12:00-2:00pm', '200.00', 5, 'active'),
('張大偉', '92222222', NULL, '藍帶', '星期日', '4:30-6:30pm', '200.00', 12, 'active');

-- ============ 繳費記錄（模擬 Q1 已繳費） ============
INSERT INTO paymentRecords (studentId, `year`, paymentPeriod, amount, paymentDate, status, confirmedBy) VALUES
(1, 2026, 'Q1', '3600.00', '2026-01-10 10:00:00', 'confirmed', 'admin_approved'),
(2, 2026, 'Q1', '3600.00', '2026-01-10 10:00:00', 'confirmed', 'admin_approved'),
(3, 2026, 'Q1', '3600.00', '2026-01-15 14:00:00', 'confirmed', 'parent_upload'),
(5, 2026, 'Q1', '3600.00', '2026-01-20 09:00:00', 'confirmed', 'admin_approved');

-- ============ 精英班繳費記錄 ============
INSERT INTO elite_payments (student_id, class_count, amount, payment_date, confirmed_by, status) VALUES
(1, 12, '2400.00', '2026-01-05 10:00:00', 'admin_approved', 'confirmed'),
(2, 12, '2400.00', '2026-01-08 14:00:00', 'admin_approved', 'confirmed'),
(3, 12, '2400.00', '2026-01-10 09:00:00', 'admin_approved', 'confirmed');

-- ============ 精英班訓練日期（2026年2月的星期日） ============
INSERT INTO elite_schedules (training_date, schedule_day, schedule_time, status) VALUES
('2026-02-01 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-08 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-15 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-22 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-01 00:00:00', '星期日', '4:30-6:30pm', 'active'),
('2026-02-08 00:00:00', '星期日', '4:30-6:30pm', 'active'),
('2026-02-15 00:00:00', '星期日', '4:30-6:30pm', 'active'),
('2026-02-22 00:00:00', '星期日', '4:30-6:30pm', 'active');

-- ============ 恆常班訓練日期（2026年2月） ============
INSERT INTO training_schedules (training_date, venue, schedule_day, schedule_time, status) VALUES
('2026-02-04 00:00:00', '中正道場', '星期三', '18:30-20:00', 'active'),
('2026-02-11 00:00:00', '中正道場', '星期三', '18:30-20:00', 'active'),
('2026-02-18 00:00:00', '中正道場', '星期三', '18:30-20:00', 'active'),
('2026-02-25 00:00:00', '中正道場', '星期三', '18:30-20:00', 'active'),
('2026-02-07 00:00:00', '信義道場', '星期六', '10:00-11:30', 'active'),
('2026-02-14 00:00:00', '信義道場', '星期六', '10:00-11:30', 'active'),
('2026-02-21 00:00:00', '信義道場', '星期六', '10:00-11:30', 'active'),
('2026-02-28 00:00:00', '信義道場', '星期六', '10:00-11:30', 'active'),
('2026-02-05 00:00:00', '大安道場', '星期四', '19:00-20:30', 'active'),
('2026-02-12 00:00:00', '大安道場', '星期四', '19:00-20:30', 'active'),
('2026-02-19 00:00:00', '大安道場', '星期四', '19:00-20:30', 'active'),
('2026-02-26 00:00:00', '大安道場', '星期四', '19:00-20:30', 'active');

-- ============ 課程（用於出席記錄的 FK） ============
INSERT INTO courses (name, description, dojo_id, day_of_week, start_time, end_time, status) VALUES
('中正道場-星期三', '中正道場 星期三班', 1, 'wednesday', '18:30', '20:00', 'active'),
('信義道場-星期六', '信義道場 星期六班', 2, 'saturday', '10:00', '11:30', 'active'),
('大安道場-星期四', '大安道場 星期四班', 3, 'thursday', '19:00', '20:30', 'active');

-- ============ 出席記錄（course_id 對應 training_schedules.id） ============
-- 在實際系統中 course_id 存的是 training_schedules.id
INSERT INTO attendance_records (course_id, student_id, attendance_date, status) VALUES
(1, 1, '2026-02-04 00:00:00', 'present'),
(1, 2, '2026-02-04 00:00:00', 'present'),
(1, 7, '2026-02-04 00:00:00', 'absent'),
(2, 1, '2026-02-11 00:00:00', 'present'),
(2, 2, '2026-02-11 00:00:00', 'late'),
(2, 7, '2026-02-11 00:00:00', 'present'),
(2, 3, '2026-02-07 00:00:00', 'present'),
(2, 4, '2026-02-07 00:00:00', 'present'),
(2, 8, '2026-02-07 00:00:00', 'present');

-- ============ 精英班出席記錄 ============
INSERT INTO elite_attendance (schedule_id, student_id, status) VALUES
(1, 1, 'present'),
(1, 2, 'present'),
(2, 1, 'present'),
(2, 2, 'absent'),
(3, 1, 'present'),
(3, 2, 'present'),
(4, 1, 'present'),
(5, 3, 'present'),
(6, 3, 'present'),
(7, 3, 'present');

-- ============ WhatsApp 範本 ============
INSERT INTO whatsapp_templates (name, content, is_default, is_active) VALUES
('繳費提醒（標準）', '{{studentName}} 家長您好，提醒您本季度學費尚未繳交。請儘快完成繳費，謝謝！', 1, 1),
('精英班繳費提醒', '{{studentName}} 家長您好，您的孩子在精英班的剩餘堂數即將用完，請及時繳費。繳費金額: $2,400（12堂）', 0, 1);
