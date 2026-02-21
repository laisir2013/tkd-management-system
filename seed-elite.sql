SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE elite_attendance;
TRUNCATE TABLE elite_payments;
TRUNCATE TABLE elite_schedules;
TRUNCATE TABLE elite_students;

-- === ELITE STUDENTS (46 from Manus + 31 extras) ===
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('李泳霖', '90971420', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃天愉', '92756760', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('郭俊康', '67351169', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('韓灝南', '62556224', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('龐兆羽', '96224749', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('陳臻軒', '90192599', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('劉玥', '65015000', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('李梓皓', '92365066', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃煒庭', '94030392', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('鄧穎翹', '92355055', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('楊惜林', '90303283', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林恩同', '55792767', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('曾祉媃', '84891247', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('歐航瑋', '96852018', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('吳博立', '62066990/97352974', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林慧玲', '57266698', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('蔡宏鑫', '67090499', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('吳芷媛', '97992389', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('張溰榆', '98240781', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('葉栩靖', '95107971', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('葉駿輝', '95107971', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('施俊杰', '97339729', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('賴柏希', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林諾天', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('徐志杰', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('李弘正', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('蔡御霆', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃頌琛', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('葉晧晴', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('Luna Petralia', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('鄒曉澄', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('鄒詩雅', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('袁穗晴', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('袁逸朗', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('江哲男', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('王浩宇', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('吳傲天', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('陳梓軒', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃銘軒', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('朱棋楓', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('丁子聰', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('楊廷諄', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('譚子鋭', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('王嘉楷', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('楊猷宸', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('周泓謙', '', '星期日', '4:30-6:30pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('Enzo', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('余學然', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('侯兆洪', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('劉宇政', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('劉燊政', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('周泳謝', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林文傑', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林明慧', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林煒堯', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('林頴萳', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('梁熙朗', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('江柏僑', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('洪卓斐', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('葉明恩', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('蘇柏霖', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('袁梓睡', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('許雋昇', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('譚子鋐', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('鄧浚濵', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('陳景韜', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('陳雪瑩', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃曜軯', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃柏熙', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃璑霜', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黄顧頕', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('麥晉維', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('黃銀軯', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('梁珀豪', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('簡頌曦', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('陳孝謙', '', '星期日', '12:00-2:00pm', 0, 0, 'active');
INSERT INTO elite_students (name, phone, schedule_day, schedule_time, fee_per_class, remaining_classes, status) VALUES ('吳卓謙', '', '星期日', '12:00-2:00pm', 0, 0, 'active');

-- Link phone numbers from regular students
UPDATE elite_students es
INNER JOIN students s ON es.name = s.name
SET es.phone = s.phone
WHERE es.phone = '' OR es.phone IS NULL;

-- === ELITE SCHEDULES (152 schedules from Manus) ===
INSERT INTO elite_schedules (training_date, schedule_day, schedule_time, status, notes) VALUES
('2022-07-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第1堂'),
('2022-07-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第2堂'),
('2022-07-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第3堂'),
('2022-07-31 12:00:00', '星期日', '12:00-6:30pm', 'active', '第4堂'),
('2022-08-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第5堂'),
('2022-08-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第6堂'),
('2022-08-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第7堂'),
('2022-08-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第8堂'),
('2022-09-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第9堂'),
('2022-09-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第10堂'),
('2022-09-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第11堂'),
('2022-09-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第12堂'),
('2022-10-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第13堂'),
('2022-10-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第14堂'),
('2022-10-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第15堂'),
('2022-10-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第16堂'),
('2022-10-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第17堂'),
('2022-11-06 12:00:00', '星期日', '12:00-6:30pm', 'active', '第18堂'),
('2022-11-13 12:00:00', '星期日', '12:00-6:30pm', 'active', '第19堂'),
('2022-11-20 12:00:00', '星期日', '12:00-6:30pm', 'active', '第20堂'),
('2022-11-27 12:00:00', '星期日', '12:00-6:30pm', 'active', '第21堂'),
('2022-12-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第22堂'),
('2022-12-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第23堂'),
('2022-12-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第24堂'),
('2022-12-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第25堂'),
('2023-01-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第26堂'),
('2023-01-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第27堂'),
('2023-01-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第28堂'),
('2023-01-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第29堂'),
('2023-01-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第30堂'),
('2023-02-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第31堂'),
('2023-02-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第32堂'),
('2023-02-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第33堂'),
('2023-02-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第34堂'),
('2023-03-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第35堂'),
('2023-03-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第36堂'),
('2023-03-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第37堂'),
('2023-03-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第38堂'),
('2023-04-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第39堂'),
('2023-04-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第40堂'),
('2023-04-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第41堂'),
('2023-04-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第42堂'),
('2023-04-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第43堂'),
('2023-05-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第44堂'),
('2023-05-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第45堂'),
('2023-05-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第46堂'),
('2023-05-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第47堂'),
('2023-06-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第48堂'),
('2023-06-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第49堂'),
('2023-06-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第50堂'),
('2023-06-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第51堂'),
('2023-07-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第52堂'),
('2023-07-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第53堂'),
('2023-07-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第54堂'),
('2023-07-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第55堂'),
('2023-07-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第56堂'),
('2023-08-06 12:00:00', '星期日', '12:00-6:30pm', 'active', '第57堂'),
('2023-08-13 12:00:00', '星期日', '12:00-6:30pm', 'active', '第58堂'),
('2023-08-20 12:00:00', '星期日', '12:00-6:30pm', 'active', '第59堂'),
('2023-08-27 12:00:00', '星期日', '12:00-6:30pm', 'active', '第60堂'),
('2023-09-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第61堂'),
('2023-09-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第62堂'),
('2023-09-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第63堂'),
('2023-09-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第64堂'),
('2023-10-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第65堂'),
('2023-10-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第66堂'),
('2023-10-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第67堂'),
('2023-10-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第68堂'),
('2023-10-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第69堂'),
('2023-11-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第70堂'),
('2023-11-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第71堂'),
('2023-11-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第72堂'),
('2023-11-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第73堂'),
('2023-12-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第74堂'),
('2023-12-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第75堂'),
('2023-12-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第76堂'),
('2023-12-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第77堂'),
('2023-12-31 12:00:00', '星期日', '12:00-6:30pm', 'active', '第78堂'),
('2024-01-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第79堂'),
('2024-01-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第80堂'),
('2024-01-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第81堂'),
('2024-01-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第82堂'),
('2024-02-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第83堂'),
('2024-02-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第84堂'),
('2024-02-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第85堂'),
('2024-02-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第86堂'),
('2024-03-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第87堂'),
('2024-03-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第88堂'),
('2024-03-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第89堂'),
('2024-03-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第90堂'),
('2024-03-31 12:00:00', '星期日', '12:00-6:30pm', 'active', '第91堂'),
('2024-04-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第92堂'),
('2024-04-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第93堂'),
('2024-04-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第94堂'),
('2024-04-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第95堂'),
('2024-05-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第96堂'),
('2024-05-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第97堂'),
('2024-05-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第98堂'),
('2024-05-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第99堂'),
('2024-06-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第100堂'),
('2024-06-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第101堂'),
('2024-06-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第102堂'),
('2024-06-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第103堂'),
('2024-06-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第104堂'),
('2024-07-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第105堂'),
('2024-07-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第106堂'),
('2024-07-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第107堂'),
('2024-07-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第108堂'),
('2024-08-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第109堂'),
('2024-08-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第110堂'),
('2024-08-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第111堂'),
('2024-08-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第112堂'),
('2024-09-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第113堂'),
('2024-09-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第114堂'),
('2024-09-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第115堂'),
('2024-09-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第116堂'),
('2024-09-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第117堂'),
('2024-10-06 12:00:00', '星期日', '12:00-6:30pm', 'active', '第118堂'),
('2024-10-13 12:00:00', '星期日', '12:00-6:30pm', 'active', '第119堂'),
('2024-10-20 12:00:00', '星期日', '12:00-6:30pm', 'active', '第120堂'),
('2024-10-27 12:00:00', '星期日', '12:00-6:30pm', 'active', '第121堂'),
('2024-11-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第122堂'),
('2024-11-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第123堂'),
('2024-11-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第124堂'),
('2024-11-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第125堂'),
('2024-12-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第126堂'),
('2024-12-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第127堂'),
('2024-12-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第128堂'),
('2024-12-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第129堂'),
('2024-12-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第130堂'),
('2025-01-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第131堂'),
('2025-01-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第132堂'),
('2025-01-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第133堂'),
('2025-01-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第134堂'),
('2025-02-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第135堂'),
('2025-02-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第136堂'),
('2025-02-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第137堂'),
('2025-02-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第138堂'),
('2025-03-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第139堂'),
('2025-03-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第140堂'),
('2025-03-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第141堂'),
('2025-03-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第142堂'),
('2025-03-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第143堂'),
('2025-04-06 12:00:00', '星期日', '12:00-6:30pm', 'active', '第144堂'),
('2025-04-13 12:00:00', '星期日', '12:00-6:30pm', 'active', '第145堂'),
('2025-04-20 12:00:00', '星期日', '12:00-6:30pm', 'active', '第146堂'),
('2025-04-27 12:00:00', '星期日', '12:00-6:30pm', 'active', '第147堂'),
('2025-05-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第148堂'),
('2025-05-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第149堂'),
('2025-05-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第150堂'),
('2025-05-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第151堂'),
('2025-06-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第152堂'),
('2025-06-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第153堂'),
('2025-06-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第154堂'),
('2025-06-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第155堂'),
('2025-06-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第156堂'),
('2025-07-06 12:00:00', '星期日', '12:00-6:30pm', 'active', '第157堂'),
('2025-07-13 12:00:00', '星期日', '12:00-6:30pm', 'active', '第158堂'),
('2025-07-20 12:00:00', '星期日', '12:00-6:30pm', 'active', '第159堂'),
('2025-07-27 12:00:00', '星期日', '12:00-6:30pm', 'active', '第160堂'),
('2025-08-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第161堂'),
('2025-08-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第162堂'),
('2025-08-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第163堂'),
('2025-08-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第164堂'),
('2025-08-31 12:00:00', '星期日', '12:00-6:30pm', 'active', '第165堂'),
('2025-09-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第166堂'),
('2025-09-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第167堂'),
('2025-09-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第168堂'),
('2025-09-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第169堂'),
('2025-10-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第170堂'),
('2025-10-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第171堂'),
('2025-10-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第172堂'),
('2025-10-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第173堂'),
('2025-11-02 12:00:00', '星期日', '12:00-6:30pm', 'active', '第174堂'),
('2025-11-09 12:00:00', '星期日', '12:00-6:30pm', 'active', '第175堂'),
('2025-11-16 12:00:00', '星期日', '12:00-6:30pm', 'active', '第176堂'),
('2025-11-23 12:00:00', '星期日', '12:00-6:30pm', 'active', '第177堂'),
('2025-11-30 12:00:00', '星期日', '12:00-6:30pm', 'active', '第178堂'),
('2025-12-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第179堂'),
('2025-12-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第180堂'),
('2025-12-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第181堂'),
('2025-12-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第182堂'),
('2026-01-04 12:00:00', '星期日', '12:00-6:30pm', 'active', '第183堂'),
('2026-01-11 12:00:00', '星期日', '12:00-6:30pm', 'active', '第184堂'),
('2026-01-18 12:00:00', '星期日', '12:00-6:30pm', 'active', '第185堂'),
('2026-01-25 12:00:00', '星期日', '12:00-6:30pm', 'active', '第186堂'),
('2026-02-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第187堂'),
('2026-02-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第188堂'),
('2026-02-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第189堂'),
('2026-02-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第190堂'),
('2026-03-01 12:00:00', '星期日', '12:00-6:30pm', 'active', '第191堂'),
('2026-03-08 12:00:00', '星期日', '12:00-6:30pm', 'active', '第192堂'),
('2026-03-15 12:00:00', '星期日', '12:00-6:30pm', 'active', '第193堂'),
('2026-03-22 12:00:00', '星期日', '12:00-6:30pm', 'active', '第194堂'),
('2026-03-29 12:00:00', '星期日', '12:00-6:30pm', 'active', '第195堂'),
('2026-04-05 12:00:00', '星期日', '12:00-6:30pm', 'active', '第196堂'),
('2026-04-12 12:00:00', '星期日', '12:00-6:30pm', 'active', '第197堂'),
('2026-04-19 12:00:00', '星期日', '12:00-6:30pm', 'active', '第198堂'),
('2026-04-26 12:00:00', '星期日', '12:00-6:30pm', 'active', '第199堂'),
('2026-05-03 12:00:00', '星期日', '12:00-6:30pm', 'active', '第200堂'),
('2026-05-10 12:00:00', '星期日', '12:00-6:30pm', 'active', '第201堂'),
('2026-05-17 12:00:00', '星期日', '12:00-6:30pm', 'active', '第202堂'),
('2026-05-24 12:00:00', '星期日', '12:00-6:30pm', 'active', '第203堂'),
('2026-05-31 12:00:00', '星期日', '12:00-6:30pm', 'active', '第204堂'),
('2026-06-07 12:00:00', '星期日', '12:00-6:30pm', 'active', '第205堂'),
('2026-06-14 12:00:00', '星期日', '12:00-6:30pm', 'active', '第206堂'),
('2026-06-21 12:00:00', '星期日', '12:00-6:30pm', 'active', '第207堂'),
('2026-06-28 12:00:00', '星期日', '12:00-6:30pm', 'active', '第208堂');

SET FOREIGN_KEY_CHECKS = 1;