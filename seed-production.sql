-- =============================================
-- Taekwondo Fee System - Complete Seed Data
-- Extracted from Manus production database
-- =============================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE elite_attendance;
TRUNCATE TABLE elite_payments;
TRUNCATE TABLE elite_schedules;
TRUNCATE TABLE elite_students;
TRUNCATE TABLE attendance_records;
TRUNCATE TABLE training_schedules;
TRUNCATE TABLE paymentRecords;
TRUNCATE TABLE student_belt_history;
TRUNCATE TABLE courses;
TRUNCATE TABLE students;
TRUNCATE TABLE coaches;
TRUNCATE TABLE dojos;
TRUNCATE TABLE whatsapp_templates;
TRUNCATE TABLE users;
TRUNCATE TABLE belt_levels;

-- === USERS ===
INSERT INTO users (openId, name, email, loginMethod, role) VALUES ('admin-local', '系統管理員', 'admin@tkd.local', 'phone', 'admin');

-- === DOJOS ===
INSERT INTO dojos (name, address, phone) VALUES ('寶林道場', '寶林邨', '88888888');
INSERT INTO dojos (name, address, phone) VALUES ('蒲崗村道場', '蒲崗村道', '88888888');
INSERT INTO dojos (name, address, phone) VALUES ('至善道場', '至善街', '88888888');

-- === COURSES ===
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (1, '寶林道場 星期一 4:00-5:00pm', 1, 'monday', '04:00', '05:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (2, '寶林道場 星期一 5:00-6:00pm', 1, 'monday', '05:00', '06:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (3, '寶林道場 星期三 4:00-5:00pm', 1, 'wednesday', '04:00', '05:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (4, '寶林道場 星期三 5:00-6:30pm', 1, 'wednesday', '05:00', '06:30');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (5, '寶林道場 星期六 10:00-11:30am', 1, 'saturday', '10:00', '11:30');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (6, '寶林道場 星期六 10：00-11：30', 1, 'saturday', '10:00', '11:30');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (7, '寶林道場 星期日 10：00-11：00', 1, 'sunday', '10:00', '11:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (8, '寶林道場 星期日 11：00-12：00', 1, 'sunday', '11:00', '12:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (9, '寶林道場 星期日 3：00-4：30', 1, 'sunday', '03:00', '04:30');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (10, '至善道場 星期二 6：00-7：00', 3, 'tuesday', '06:00', '07:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (11, '至善道場 星期四 6：00-7：00', 3, 'thursday', '06:00', '07:00');
INSERT INTO courses (id, name, dojo_id, day_of_week, start_time, end_time) VALUES (12, '蒲崗村道場 星期五 6：00-7：00', 2, 'friday', '06:00', '07:00');

-- === STUDENTS (104 records from production) ===
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李泳霖', '90971420', '90971420', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '藍帶', '2019-07-27', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃天愉', '92756760', '92756760', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '綠藍帶', '2018-02-19', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('郭俊康', '67351169', '67351169', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '藍帶', '2019-02-07', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('韓灝南', '62556224', '62556224', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '藍紅帶', '2019-02-17', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('龐兆羽', '96224749', '96224749', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '綠藍帶', '2017-10-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳臻軒', '90192599', '90192599', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '藍帶', '2019-10-24', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('劉玥', '65015000', '65015000', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '藍帶', '2019-10-19', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('翁喆楠', '69061109', '69061109', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '白帶', '2019-01-02', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李梓皓', '92365066', '92365066', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '紅帶', '2017-04-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('麥晉維', '96799633', '96799633', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '綠藍帶', '2019-07-22', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃煒庭', '94030392', '94030392', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '藍紅帶', '2017-10-05', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('吳卓謙', '63521866', '63521866', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '綠帶', '2020-01-12', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('梁珀豪', '96613148', '96613148', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '綠藍帶', '2019-02-13', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林奕辰', '62270911', '62270911', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '黃綠帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王靖喬', '92557326', '92557326', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '綠帶', '2020-07-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李聿朗', '92760849', '92760849', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '白帶', '2019-12-06', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李星玥', '92760849', '92760849', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '白帶', '2023-03-11', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳鏏琋', '90594674', '90594674', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '白帶', '2020-03-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃卓鏗', '91335093', '91335093', '寶林道場', '星期一', '5:00-6:00pm', 1800.0, '白帶', '2022-02-17', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄧綽翹', '92355055', '92355055', '至善道場', '星期四', '6：00-7：00', 1800.0, '黃綠帶', '2020-07-13', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('周卓謙', '91224220', '91224220', '至善道場', '星期四', '6：00-7：00', 1800.0, '綠藍帶', '2019-02-08', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李籽睿', '54888308', '54888308', '至善道場', '星期四', '6：00-7：00', 1800.0, '黃綠帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄧穎翹', '92355055', '92355055', '至善道場', '星期四', '6：00-7：00', 1800.0, '藍帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('袁梓睎', '61980823', '61980823', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '綠帶', '2020-06-02', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄧予喬', '97100235', '97100235', '寶林道場', '星期一', '4:00-5:00pm', 1800.0, '黃綠帶', '2020-05-09', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('余卓穎', '61946276', '61946276', '寶林道場', '星期三', '4:00-5:00pm', 1800.0, '黃綠帶', '2020-06-01', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃睿浠', '64630040/61760596', '64630040/61760596', '寶林道場', '星期三', '4:00-5:00pm', 1800.0, '黃綠帶', '2020-02-22', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('范凱鈞', '67643898', '67643898', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '黃綠帶', '2020-08-05', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃曜軒', '90979276', '90979276', '寶林道場', '星期三', '4:00-5:00pm', 1800.0, '黃綠帶', '2019-11-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃瑛霖', '91316861/60181061', '91316861/60181061', '寶林道場', '星期三', '4:00-5:00pm', 1800.0, '綠帶', '2020-03-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃皓鈞', '97887265', '97887265', '寶林道場', '星期三', '4:00-5:00pm', 1800.0, '白帶', '2020-06-16', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('梁凱忻', '92330424', '92330424', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '黃綠帶', '2014-12-16', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('楊惜林', '90303283', '90303283', '寶林道場', '星期六', '10:00-11:30am', 1800.0, '紅黑帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林恩同', '55792767', '55792767', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '紅黑帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('曾祉媃', '84891247', '84891247', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅黑帶', '2016-10-31', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王彥喬', '61820245', '61820245', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '綠帶', '2014-04-21', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('龍萃欣', '98103369', '98103369', '寶林道場', '星期三', '5:00-6:30pm', 1800.0, '黃帶', '2014-08-15', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('梁雲岫', '98139623', '98139623', '至善道場', '星期二', '6：00-7：00', 1800.0, '白帶', '2022-01-31', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('蕭瑀', '95148890', '95148890', '至善道場', '星期二', '6：00-7：00', 1800.0, '白帶', '2022-05-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('趙奕舜', '68068683', '68068683', '至善道場', '星期二', '6：00-7：00', 1800.0, '白帶', '2021-11-29', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('譚芷澄', '96735433', '96735433', '至善道場', '星期二', '6：00-7：00', 1800.0, '白帶', '2022-03-03', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('周子翹', '61246186', '61246186', '至善道場', '星期二', '6：00-7：00', 1800.0, '白帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('劉晉瑜', '62034209', '62034209', '至善道場', '星期二', '6：00-7：00', 1800.0, '黃帶', '2022-03-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('歐航瑋', '96852018', '96852018', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '紅黑帶', '2017-03-19', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('吳博立', '62066990/97352974', '62066990/97352974', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '紅帶', '2021-11-14', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林慧玲', '57266698', '57266698', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍帶', '2018-09-05', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('郭辰羽', '68431041', '68431041', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '綠帶', '2017-11-09', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('蔡宏鑫', '67090499', '67090499', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍帶', '2019-12-03', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('江柏僑', '60686558', '60686558', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '紅黑帶', '2013-06-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('吳芷媛', '97992389', '97992389', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍紅帶', '2011-10-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林書行', '97296818', '97296818', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '黑帶', '2016-07-16', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('張溰榆', '98240781', '98240781', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '綠藍帶', '2010-04-05', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林文傑', '91234338', '91234338', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍帶', '2018-02-21', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林明慧', '91234338', '91234338', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍紅帶', '2018-02-21', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('茹海晴', '67544963', '67544963', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '黃綠帶', '2019-12-03', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳景韜', '90965636', '90965636', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '綠藍帶', '2017-11-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('葉明恩', '95107971', '95107971', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '綠帶', '2019-12-16', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('葉栩靖', '95107971', '95107971', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍紅帶', '2014-06-01', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('葉駿輝', '95107971', '95107971', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '藍紅帶', '2016-01-15', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王樂寧', '61051516', '61051516', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '黃帶', '2020-04-17', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王樂澄', '61051516', '61051516', '蒲崗村道場', '星期五', '6：00-7：00', 1440.0, '黃帶', '2020-04-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('施俊杰', '97339729', '97339729', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2021-09-29', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃銘軒', '91392077', '91392077', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍帶', '2013-07-31', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林學謙', '93498497', '93498497', '寶林道場', '星期六', '10：00-11：30', 1800.0, '綠帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('謝進烯', '90835119', '90835119', '寶林道場', '星期六', '10：00-11：30', 1800.0, '藍紅帶', '2011-05-20', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李俊熹', '66228863', '66228863', '寶林道場', '星期六', '10：00-11：30', 1800.0, '紅帶', '2017-11-04', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('簡頌曦', '98356407', '98356407', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠帶', '2019-10-22', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃顓頎', '56333770', '56333770', '寶林道場', '星期六', '10：00-11：30', 1800.0, '綠帶', '2019-10-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鍾浚皓', '69289234', '69289234', '寶林道場', '星期六', '10：00-11：30', 1800.0, '黃帶', '2020-06-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('朱睿賢', '98467227', '98467227', '寶林道場', '星期六', '10：00-11：30', 1800.0, '黃帶', '2020-01-28', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳仲寧', '90423665', '90423665', '寶林道場', '星期六', '10：00-11：30', 1800.0, '黃帶', '2020-10-22', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('丁弈曈', '60977125', '60977125', '寶林道場', '星期六', '10：00-11：30', 1800.0, '黃帶', '2019-09-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃柏熹', '66226137', '66226137', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠藍帶', '2017-12-07', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄧浚濠', '96124300', '96124300', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠藍帶', '2016-07-01', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('周泓謙', '64849229', '64849229', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠帶', '2019-10-12', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林煒堯', '93498497', '93498497', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠帶', '2017-07-12', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林穎萳', '93498497', '93498497', '寶林道場', '星期日', '10：00-11：00', 1800.0, '綠藍帶', '2017-07-12', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('周子睿', '64849229', '64849229', '寶林道場', '星期日', '10：00-11：00', 1800.0, '黃綠帶', '2021-04-07', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('蔡承行', '98066019', '98066019', '寶林道場', '星期日', '11：00-12：00', 1800.0, '白帶', '2021-08-07', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃意桐', '92853082', '92853082', '寶林道場', '星期日', '11：00-12：00', 1800.0, '白帶', '2022-09-10', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('洪敏翀', '67730148', '67730148', '寶林道場', '星期日', '11：00-12：00', 1800.0, '白帶', '2022-04-15', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李卓諾', '93339521', '93339521', '寶林道場', '星期日', '3：00-4：30', 1800.0, '黑帶', '2012-08-22', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃頌琛', '98597310', '98597310', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅帶', '2019-01-26', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('李弘正', '98350858', '98350858', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅黑帶', '2015-06-07', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('蔡御霆', '97478091', '97478091', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅帶', '2016-01-21', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄭焯謙', '98483822', '98483822', '寶林道場', '星期日', '3：00-4：30', 1800.0, '黑帶', '2012-03-12', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王浩宇', '92507585', '92507585', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('江哲男', '61214704', '61214704', '寶林道場', '星期日', '3：00-4：30', 1800.0, '黑帶', '2012-12-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('馮顯揚', '57033893', '57033893', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2015-01-05', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('譚鍶齊', '92729422', '92729422', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2014-12-02', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('譚栩澄', '92729422', '92729422', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2016-09-19', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳孝謙', '60777261', '60777261', '至善道場', '星期四', '6：00-7：00', 1800.0, '藍帶', '2016-03-03', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('鄧皓駿', '62223444', '62223444', '至善道場', '星期四', '6：00-7：00', 1800.0, '綠藍帶', '2023-12-23', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('楊猷宸', '96849267', '96849267', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅帶', '2016-03-26', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('孔晞雅', '96019280', '96019280', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2013-11-28', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('譚子銳', '96769072', '96769072', '至善道場', '星期四', '6：00-7：00', 1800.0, '藍紅帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('楊廷諄', '92760188', '92760188', '至善道場', '星期四', '6：00-7：00', 1800.0, '紅帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('陳梓軒', '61521528', '61521528', '寶林道場', '星期日', '3：00-4：30', 1800.0, '綠藍帶', NULL, 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('朱棋楓', '62238604', '62238604', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2017-04-14', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('黃子淇', '91813441', '91813441', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2016-08-18', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('王嘉楷', '53822755', '53822755', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2013-10-08', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('林諾天', '97291797', '97291797', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍紅帶', '2013-08-31', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('吳傲天', '93537253', '93537253', '寶林道場', '星期日', '3：00-4：30', 1800.0, '藍帶', '2018-01-08', 'active');
INSERT INTO students (name, phone, password, venue, scheduleDay, scheduleTime, feePerQuarter, beltLevel, birthDate, status) VALUES ('Andre', '96849267', '96849267', '寶林道場', '星期日', '3：00-4：30', 1800.0, '紅帶', '2016-03-26', 'active');

-- === ELITE STUDENTS ===
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES
('Enzo', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('余學然', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('侯兆洪', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('劉宇政', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('劉燊政', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('吳卓謙', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('周泳謝', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('林文傑', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('林明慧', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('林煒堯', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('林頴萳', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('梁熙朗', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('梁珀豪', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('江柏僑', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('洪卓斐', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('簡頌曦', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('葉明恩', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('蘇柏霖', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('袁梓睡', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('許雋昇', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('譚子鋐', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('鄧浚濵', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('陳孝謙', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('陳景韜', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('陳雪瑩', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('麥晉維', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('黃曜軯', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('黃柏熙', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('黃銀軯', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('黃璑霜', '', '星期日', '12:00-2:00pm', 0, 0, 'active'),
('黄顧頕', '', '星期日', '12:00-2:00pm', 0, 0, 'active');

-- Add elite students linked from regular class
INSERT IGNORE INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status)
SELECT s.name, s.phone, '星期日', '12:00-2:00pm', 0, 0, 'active'
FROM students s
WHERE s.name IN ('楊惜林', '曾祉媃', '歐航瑋', '葉栩靖', '葉駿輝', '吳芷媛', '李泳霖', '郭俊康', '張溰榆', '鄧穎翹', '黃天愉', '林慧玲', '黃煒庭', '林恩同', '韓灝南', '龐兆羽', '施俊杰', '李梓皓', '陳臻軒', '蔡宏鑫', '劉玥', '林諾天', '李弘正', '蔡御霆', '黃頌琛')
AND s.name NOT IN (SELECT name FROM elite_students);

-- === PAYMENT RECORDS (Q1 2026 confirmed) ===
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '鄭焯謙' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '江哲男' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '馮顯揚' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '譚鍶齊' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '譚栩澄' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '陳孝謙' AND venue = '至善道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '鄧皓駿' AND venue = '至善道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '楊猷宸' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '孔晞雅' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '譚子銳' AND venue = '至善道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '楊廷諄' AND venue = '至善道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '陳梓軒' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '黃子淇' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '李卓諾' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '黃頌琛' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '李弘正' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '蔡御霆' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '王浩宇' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '施俊杰' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '黃銘軒' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '朱棋楓' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '王嘉楷' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '林諾天' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = '吳傲天' AND venue = '寶林道場' LIMIT 1;
INSERT IGNORE INTO paymentRecords (studentId, paymentPeriod, amount, paymentDate, status, createdAt, updatedAt)
SELECT id, 'Q1', 1800.0, '2026-01-15', 'confirmed', NOW(), NOW()
FROM students WHERE name = 'Andre' AND venue = '寶林道場' LIMIT 1;

-- === ELITE SCHEDULES (2025-2026) ===
INSERT INTO elite_schedules (training_date, schedule_day, schedule_time, status) VALUES
('2025-01-05 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-01-12 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-01-19 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-01-26 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-02-02 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-02-09 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-02-16 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-02-23 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-03-02 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-03-09 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-03-16 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-03-23 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-03-30 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-04-06 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-04-13 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-04-20 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-04-27 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-05-04 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-05-11 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-05-18 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-05-25 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-06-01 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-06-08 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-06-15 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-06-22 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-06-29 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-07-06 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-07-13 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-07-20 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-07-27 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-08-03 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-08-10 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-08-17 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-08-24 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-08-31 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-09-07 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-09-14 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-09-21 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-09-28 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-10-05 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-10-12 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-10-19 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-10-26 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-11-02 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-11-09 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-11-16 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-11-23 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-11-30 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-12-07 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-12-14 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-12-21 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2025-12-28 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-01-04 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-01-11 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-01-18 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-01-25 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-01 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-08 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-15 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-02-22 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-03-01 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-03-08 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-03-15 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-03-22 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-03-29 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-04-05 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-04-12 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-04-19 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-04-26 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-05-03 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-05-10 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-05-17 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-05-24 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-05-31 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-06-07 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-06-14 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-06-21 00:00:00', '星期日', '12:00-2:00pm', 'active'),
('2026-06-28 00:00:00', '星期日', '12:00-2:00pm', 'active');

SET FOREIGN_KEY_CHECKS = 1;

-- === SEED COMPLETE ===