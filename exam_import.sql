-- =============================================
-- 匯入 2026年2月升級試 完整資料
-- =============================================

-- 1. 建立考試場次
INSERT INTO exam_sessions (name, exam_date, location, description, status) VALUES
('2026年2月升級試', '2026-02-15', '寶林文娛活動會堂', '2026年2月跆拳道升級考試', 'completed');

SET @exam_id = LAST_INSERT_ID();

-- 2. 匯入第一批考生 (insert_candidates.sql - 含組別分配的考生)
-- A組 白帶→黃帶
INSERT INTO exam_candidates (exam_id, name, phone, dojo_name, gender, age, age_group, current_belt, target_belt, group_code, order_number, status) VALUES
(@exam_id, '蕭瑀', '95148890', '至善中心', 'male', 3, '幼稚園', 'white', 'yellow', 'A', 1, 'passed'),
(@exam_id, '周子翹', '61246186', '至善活動中心', 'female', 4, '幼稚園', 'white', 'yellow', 'A', 2, 'passed'),
(@exam_id, '蔡詩雅', '67090499', '蒲崗村道體育館', 'female', 4, '幼稚園', 'white', 'yellow', 'A', 3, 'passed'),
(@exam_id, '蔡承行', '98066019', '寶林體育館', 'male', 4, '幼稚園', 'white', 'yellow', 'A', 4, 'passed'),
(@exam_id, '梁雲岫', '98139623', '將軍澳至善中心', 'male', 4, '幼稚園', 'white', 'yellow', 'A', 5, 'passed'),
(@exam_id, '趙奕舜', '68068683', '至善社區中心', 'male', 4, '幼稚園', 'white', 'yellow', 'A', 6, 'registered'),
(@exam_id, '蕭慎行', '96522750', '九龍灣', 'male', 5, '幼稚園', 'white', 'yellow', 'A', 7, 'passed'),
(@exam_id, '黃皓鈞', '97887265', '寶琳文娛社區會堂', 'male', 5, '幼稚園', 'white', 'yellow', 'A', 8, 'passed'),

-- B組 白帶→黃帶
(@exam_id, '陳鏏琋', '90594674', '寶琳文娛社區會堂', 'female', 5, '幼稚園', 'white', 'yellow', 'B', 1, 'passed'),
(@exam_id, '翁喆楠', '69061109', '寶琳文娛社區會堂', 'male', 7, '小學', 'white', 'yellow', 'B', 2, 'passed'),
(@exam_id, '曾鎧淇', '94620771', '港島東體育館', 'female', 7, '小學', 'white', 'yellow', 'B', 2, 'passed'),
(@exam_id, '曾一平', '68237085', '九龍灣', 'male', 6, '小學', 'white', 'yellow', 'B', 3, 'passed'),
(@exam_id, '曾一凡', '68237085', '九龍灣', 'male', 6, '小學', 'white', 'yellow', 'B', 5, 'passed'),

-- C組 黃帶→黃綠帶
(@exam_id, '王靖喬', '92557326', '寶琳文娛社區會堂', 'male', 5, '幼稚園', 'yellow', 'yellow_green', 'C', 1, 'passed'),
(@exam_id, '丁弈曈', '60977125', '寶琳文娛社區會堂', 'female', 6, '小學', 'yellow', 'yellow_green', 'C', 2, 'passed'),
(@exam_id, '何嘉蕊', '91239014', '寶琳文娛社區會堂', 'female', 8, '小學', 'yellow', 'yellow_green', 'C', 3, 'passed'),
(@exam_id, '黃蜻蜓', '98544052', '彩榮體育館', 'male', 9, '小學', 'yellow', 'yellow_green', 'C', 4, 'passed'),
(@exam_id, '馮子健', '63737825', '保安道體育館', 'male', 9, '小學', 'yellow', 'yellow_green', 'C', 5, 'passed'),
(@exam_id, '龍萃欣', '98103369', '寶琳文娛社區會堂', 'female', 11, '小學', 'yellow', 'yellow_green', 'C', 6, 'passed'),
(@exam_id, '石朗霆', '61514310', '翠林體育館', 'male', 12, '中學或以上', 'yellow', 'yellow_green', 'C', 7, 'passed'),

-- D組 黃綠帶→綠帶
(@exam_id, '周子睿', '64849229', '寶琳文娛社區會堂', 'male', 4, '幼稚園', 'yellow_green', 'green', 'D', 1, 'passed'),
(@exam_id, '范凱鈞', '67643898', '寶琳文娛社區會堂', 'male', 5, '幼稚園', 'yellow_green', 'green', 'D', 2, 'passed'),
(@exam_id, '余卓穎', '61946276', '寶琳文娛社區會堂', 'female', 5, '幼稚園', 'yellow_green', 'green', 'D', 3, 'passed'),
(@exam_id, '黃思迪', '96217401', '翠林體育館', 'male', 5, '幼稚園', 'yellow_green', 'green', 'D', 4, 'passed'),
(@exam_id, '黃睿浠', '64630040', '寶琳文娛社區會堂', 'male', 5, '幼稚園', 'yellow_green', 'green', 'D', 5, 'passed'),
(@exam_id, '茹海晴', '67544963', '蒲崗村道體育館', 'female', 6, '小學', 'yellow_green', 'green', 'D', 6, 'passed'),
(@exam_id, '關蔚蓁', '62769181', '九龍灣體育館', 'female', 6, '小學', 'yellow_green', 'green', 'D', 7, 'passed'),
(@exam_id, '麥志謙', '66753475', '翠林體育館', 'male', 12, '中學或以上', 'yellow_green', 'green', 'D', 8, 'passed'),
(@exam_id, '鄧綽翹', '92355055', '至善中心', 'male', 6, '小學', 'yellow_green', 'green', 'D', 9, 'passed'),
(@exam_id, '鄧予喬', '97100235', '寶林道場', 'female', 6, '小學', 'yellow_green', 'green', 'D', 10, 'passed'),
(@exam_id, '李籽睿', '54888308', '至善中心', 'male', 7, '小學', 'yellow_green', 'green', 'D', 11, 'failed'),
(@exam_id, '梁凱欣', '92330424', '寶林道場', 'female', 9, '小學', 'yellow_green', 'green', 'D', 12, 'passed'),

-- E組 綠帶→綠藍帶
(@exam_id, '黃瑛霖', '91316861', '寶琳文娛社區會堂', 'female', 5, '幼稚園', 'green', 'green_blue', 'E', 1, 'passed'),
(@exam_id, '黃曜軒', '90979276', '寶琳文娛社區會堂', 'male', 6, '幼稚園', 'green', 'green_blue', 'E', 2, 'failed'),
(@exam_id, '梁承楷', '53137553', '翠林體育館', 'male', 6, '小學', 'green', 'green_blue', 'E', 3, 'registered'),
(@exam_id, '周泓謙', '64849229', '寶琳文娛社區會堂', 'male', 6, '小學', 'green', 'green_blue', 'E', 4, 'passed'),
(@exam_id, '吳卓謙', '63521866', '寶琳文娛社區會堂', 'male', 6, '幼稚園', 'green', 'green_blue', 'E', 5, 'passed'),
(@exam_id, '葉明恩', '95107971', '蒲崗村道體育館', 'female', 6, '小學', 'green', 'green_blue', 'E', 6, 'passed'),
(@exam_id, '陳是言', '93807853', '翠林體育館', 'female', 7, '小學', 'green', 'green_blue', 'E', 7, 'failed'),
(@exam_id, '鍾君澤', '93472596', '寶琳文娛社區會堂', 'male', 8, '小學', 'green', 'green_blue', 'E', 8, 'passed'),

-- F組 綠帶→綠藍帶
(@exam_id, '鍾文淇', '93472596', '寶琳文娛社區會堂', 'female', 8, '小學', 'green', 'green_blue', 'F', 1, 'passed'),
(@exam_id, '黃智勤', '64974096', '藍田東區社區會堂', 'male', 8, '小學', 'green', 'green_blue', 'F', 2, 'passed'),
(@exam_id, '楊立勤', '55106359', '翠林體育館', 'male', 10, '小學', 'green', 'green_blue', 'F', 3, 'passed'),
(@exam_id, '梁凱忻', '92330424', '寶琳文娛社區會堂', 'female', 11, '小學', 'green', 'green_blue', 'F', 4, 'registered'),
(@exam_id, '黃顓頎', '56333770', '寶林道場', 'male', 7, '小學', 'green', 'green_blue', 'F', 4, 'failed'),

-- G組 綠藍帶→藍帶
(@exam_id, '黃天愉', '92756760', '寶林體育館', 'female', 7, '小學', 'green_blue', 'blue', 'G', 1, 'failed'),
(@exam_id, '麥崇倬', '69922129', '藍田東區社區會堂', 'male', 7, '小學', 'green_blue', 'blue', 'G', 2, 'passed'),
(@exam_id, '黃奕森', '97576271', '藍田東區社區會堂', 'male', 7, '小學', 'green_blue', 'blue', 'G', 3, 'passed'),
(@exam_id, '陳承浠', '67570269', '翠林體育館', 'male', 7, '小學', 'green_blue', 'blue', 'G', 4, 'passed'),
(@exam_id, '李駿𤋮', '96668584', '翠林體育館', 'male', 7, '小學', 'green_blue', 'blue', 'G', 5, 'failed'),
(@exam_id, '梁珀豪', '96613148', '寶琳文娛社區會堂', 'male', 7, '小學', 'green_blue', 'blue', 'G', 6, 'passed'),
(@exam_id, '龐兆羽', '96224749', '寶琳文娛社區會堂', 'male', 8, '小學', 'green_blue', 'blue', 'G', 7, 'passed'),
(@exam_id, '林晉熙', '52825972', '順利邨社區會堂', 'male', 8, '小學', 'green_blue', 'blue', 'G', 8, 'passed'),

-- H組 綠藍帶→藍帶
(@exam_id, '黃信恩', '91204372', '油塘社區會堂', 'male', 8, '小學', 'green_blue', 'blue', 'H', 1, 'passed'),
(@exam_id, '鄧浚濠', '98299766', '寶琳文娛社區會堂', 'male', 9, '小學', 'green_blue', 'blue', 'H', 2, 'passed'),
(@exam_id, '石浩謙', '65383771', '翠林體育館', 'male', 9, '小學', 'green_blue', 'blue', 'H', 3, 'passed'),
(@exam_id, '陳梓軒', '61521528', '寶琳文娛社區會堂', 'male', 10, '小學', 'green_blue', 'blue', 'H', 4, 'passed'),
(@exam_id, '賴日希', '61912400', '九龍灣體育館', 'male', 10, '小學', 'green_blue', 'blue', 'H', 5, 'passed'),

-- I組 藍帶→藍紅帶
(@exam_id, '蔡宏鑫', '67090499', '蒲崗村道體育館', 'male', 6, '小學', 'blue', 'blue_red', 'I', 1, 'passed'),
(@exam_id, '陳臻軒', '90192599', '寶琳文娛社區會堂', 'male', 6, '小學', 'blue', 'blue_red', 'I', 2, 'passed'),
(@exam_id, '郭俊康', '67351169', '寶琳文娛社區會堂', 'male', 6, '小學', 'blue', 'blue_red', 'I', 3, 'passed'),
(@exam_id, '林文傑', '85291234338', '蒲崗村道體育館', 'male', 7, '小學', 'blue', 'blue_red', 'I', 4, 'passed'),
(@exam_id, '林慧玲', '57266698', '蒲崗村道體育館', 'female', 7, '小學', 'blue', 'blue_red', 'I', 5, 'passed'),
(@exam_id, '陳孝謙', '60777261', '至善道場', 'male', 9, '小學', 'blue', 'blue_red', 'I', 6, 'passed'),
(@exam_id, '譚子鋭', '96769072', '至善道場', 'male', 9, '小學', 'blue', 'blue_red', 'I', 7, 'passed'),
(@exam_id, '趙栢臻', '96402758', '油塘社區會堂', 'male', 9, '小學', 'blue', 'blue_red', 'I', 8, 'passed'),
(@exam_id, '黃銘軒', '91392077', '寶琳文娛社區會堂', 'male', 12, '中學或以上', 'blue', 'blue_red', 'I', 8, 'passed'),

-- K組 藍紅帶→紅帶
(@exam_id, '韓灝南', '62556224', '寶琳文娛社區會堂', 'male', 6, '小學', 'blue_red', 'red', 'K', 1, 'passed'),
(@exam_id, '林明慧', '91234338', '蒲崗村道體育館', 'female', 7, '小學', 'blue_red', 'red', 'K', 2, 'passed'),
(@exam_id, '任正彥', '95565515', '藍田東區社區會堂', 'male', 9, '小學', 'blue_red', 'red', 'K', 3, 'failed'),
(@exam_id, '葉駿輝', '95107971', '蒲崗村道體育館', 'male', 10, '小學', 'blue_red', 'red', 'K', 4, 'passed'),
(@exam_id, '王皓晴', '96522750', '九龍灣', 'female', 11, '小學', 'blue_red', 'red', 'K', 4, 'failed'),
(@exam_id, '葉栩靖', '95107971', '蒲崗村道體育館', 'female', 11, '小學', 'blue_red', 'red', 'K', 6, 'passed'),
(@exam_id, '黃信行', '91204372', '', 'male', NULL, NULL, 'blue_red', 'red', 'K', 7, 'passed'),

-- L組 紅帶→紅黑帶
(@exam_id, '李梓皓', '92365066', '寶琳文娛社區會堂', 'male', 8, '小學', 'red', 'red_black', 'L', 1, 'passed'),
(@exam_id, '楊猷宸', '96849267', '寶琳文娛社區會堂', 'male', 9, '小學', 'red', 'red_black', 'L', 2, 'registered'),
(@exam_id, '蔡御霆', '97478091', '寶琳文娛社區會堂', 'male', 10, '小學', 'red', 'red_black', 'L', 3, 'passed'),
(@exam_id, '黃梓峻', '63313232', '九龍城體育館', 'male', 11, '小學', 'red', 'red_black', 'L', 4, 'passed'),
(@exam_id, '黃信行', '91204372', '油塘社區會堂', 'male', 12, '中學或以上', 'red', 'red_black', 'L', 5, 'registered'),
(@exam_id, '謝進烯', '90835119', '寶琳文娛社區會堂', 'male', 14, '中學或以上', 'red', 'red_black', 'L', 6, 'failed'),

-- L組 紅黑帶→黑帶
(@exam_id, '曾祉媃', '84891247', '寶琳文娛社區會堂', 'female', 9, '小學', 'red_black', 'black', 'L', 6, 'passed'),
(@exam_id, '黃子諾', '93664239', '順利邨社區會堂', 'male', 10, '小學', 'red_black', 'black', 'L', 7, 'passed'),
(@exam_id, '楊惜林', '90303283', '寶琳文娛社區會堂', 'male', 11, '小學', 'red_black', 'black', 'L', 9, 'failed'),

-- L組 黑帶→黑帶二段
(@exam_id, '楊惜林', '90303283', '寶琳文娛社區會堂', 'male', 11, '小學', 'black', 'black_2dan', 'L', 8, 'checked_in');

-- 3. 匯入第二批高段位考生 (import_candidates.sql - M~U組)
INSERT INTO exam_candidates (exam_id, name, phone, dojo_name, gender, age, age_group, current_belt, target_belt, group_code, order_number, status) VALUES
(@exam_id, '劉宇政', '93461169', '油塘社區會堂', 'male', 10, '小學', 'blue', 'blue_red', 'M', 7, 'registered'),
(@exam_id, '黃子淇', '91813441', '寶琳文娛社區會堂', 'female', 9, '小學', 'blue', 'blue_red', 'M', 8, 'registered'),
(@exam_id, '葉明祐', '94761601', '九龍灣體育館', 'male', 13, '中學或以上', 'blue', 'blue_red', 'N', 1, 'registered'),
(@exam_id, '葉紋希', '94761601', '九龍灣體育館', 'female', 10, '小學', 'blue', 'blue_red', 'N', 2, 'registered'),
(@exam_id, '譚子鋭', '96769072', '至善社區中心', 'male', 8, '小學', 'blue', 'blue_red', 'N', 3, 'registered'),
(@exam_id, '黃煒庭', '94030392', '寶琳文娛社區會堂', 'male', 7, '小學', 'blue', 'blue_red', 'N', 4, 'registered'),
(@exam_id, '朱棋楓', '62238604', '寶琳文娛社區會堂', 'male', 8, '小學', 'blue', 'blue_red', 'N', 5, 'registered'),
(@exam_id, '楊廷諄', '92760188', '寶琳文娛社區會堂', 'male', 8, '小學', 'blue_red', 'red', 'O', 1, 'registered'),
(@exam_id, '黃思朗', '96217401', '翠林體育館', 'male', 8, '小學', 'blue_red', 'red', 'O', 2, 'registered'),
(@exam_id, '吳博立', '97352974', '蒲崗村道體育館', 'male', 8, '小學', 'blue_red', 'red', 'O', 3, 'registered'),
(@exam_id, '劉衍銳', '93893713', '翠林體育館', 'male', 13, '中學或以上', 'blue_red', 'red', 'O', 4, 'registered'),
(@exam_id, '李梓皓', '92365066', '寶琳玻璃屋', 'male', 8, '小學', 'blue_red', 'red', 'O', 5, 'registered'),
(@exam_id, '王皓晴', '96522750', '九龍灣', 'female', 11, '小學', 'blue_red', 'red', 'O', 6, 'registered'),
(@exam_id, '黃信行', '91204372', '油塘社區會堂', 'male', 12, '中學或以上', 'blue_red', 'red', 'O', 7, 'registered'),
(@exam_id, '謝進烯', '90835119', '寶琳文娛社區會堂', 'male', 14, '中學或以上', 'blue_red', 'red', 'O', 8, 'registered'),
(@exam_id, '侯兆洪', '64321400', '油塘社區會堂', 'male', 10, '小學', 'blue_red', 'red', 'P', 1, 'registered'),
(@exam_id, '馮顯揚', '57033893', '寶琳文娛社區會堂', 'male', 10, '小學', 'blue_red', 'red', 'P', 2, 'registered'),
(@exam_id, '粱顥茗', '69333975', '寶琳文娛社區會堂', 'male', 10, '小學', 'blue_red', 'red', 'P', 3, 'registered'),
(@exam_id, '施俊杰', '97339729', '寶琳文娛社區會堂', 'male', 12, '中學或以上', 'blue_red', 'red', 'P', 4, 'registered'),
(@exam_id, '李俊熹', '66228863', '寶琳文娛社區會堂', 'male', 7, '小學', 'blue_red', 'red', 'P', 5, 'registered'),
(@exam_id, '余偉軒', '92390937', '順利邨社區會堂', 'male', 9, '小學', 'blue_red', 'red', 'P', 6, 'registered'),
(@exam_id, '林文傑', '91234338', '蒲崗村道體育館', 'male', 7, '小學', 'blue_red', 'red', 'P', 7, 'registered'),
(@exam_id, '賴柏希', '62242679', '九龍城體育館', 'male', 8, '小學', 'red', 'red_black', 'Q', 1, 'registered'),
(@exam_id, '蔡御霆', '97478091', '寶琳文娛社區會堂', 'male', 9, '小學', 'red', 'red_black', 'Q', 2, 'registered'),
(@exam_id, '馬晞', '94578668', '翠林體育館', 'male', 11, '小學', 'red', 'red_black', 'Q', 3, 'registered'),
(@exam_id, '楊逸僖', '94614779', '順利邨社區會堂', 'male', 11, '小學', 'red', 'red_black', 'Q', 4, 'registered'),
(@exam_id, '楊逸賢', '94614779', '順利邨社區會堂', 'male', 9, '小學', 'red', 'red_black', 'Q', 5, 'registered'),
(@exam_id, '孔晞雅', '96019280', '寶琳文娛社區會堂', 'female', 11, '中學或以上', 'red', 'red_black', 'Q', 6, 'registered'),
(@exam_id, '陳曦儀', '96734167', '翠林體育館', 'female', 13, '中學或以上', 'red', 'red_black', 'Q', 7, 'registered'),
(@exam_id, '李思毅', '96201077', '寶琳文娛社區會堂', 'male', 16, '中學或以上', 'red', 'red_black', 'Q', 8, 'registered'),
(@exam_id, '葉晧晴', '67685606', '港島東體育館', 'male', 11, '小學', 'red', 'red_black', 'R', 1, 'registered'),
(@exam_id, '林恩同', '55792767', '寶琳文娛社區會堂', 'male', 10, '小學', 'red', 'red_black', 'R', 2, 'registered'),
(@exam_id, '楊猷宸', '96849267', '寶琳文娛社區會堂', 'male', 9, '小學', 'red', 'red_black', 'R', 3, 'registered'),
(@exam_id, '林明慧', '91234338', '蒲崗村道體育館', 'female', 7, '小學', 'red', 'red_black', 'R', 4, 'registered'),
(@exam_id, '任正謙', '95565515', '藍田東區社區會堂', 'male', 10, '小學', 'red_black', 'black', 'S', 1, 'registered'),
(@exam_id, '曾祉媃', '84891247', '寶琳文娛社區會堂', 'female', 8, '小學', 'red_black', 'black', 'S', 2, 'registered'),
(@exam_id, '黃子諾', '93664239', '順利邨社區會堂', 'male', 10, '小學', 'red_black', 'black', 'S', 3, 'registered'),
(@exam_id, '李卓諾', '93339521', '寶琳文娛社區會堂', 'male', 13, '中學或以上', 'black', 'black_2dan', 'T', 1, 'registered'),
(@exam_id, '陳雪瑩', '52323246', '油塘社區會堂', 'female', 16, '中學或以上', 'black_2dan', 'black_3dan', 'U', 1, 'registered'),
(@exam_id, '黎潼宇', '68729183', '油塘社區會堂', 'male', 20, '中學或以上', 'black_2dan', 'black_3dan', 'U', 2, 'registered');

-- 4. 匯入考試時間表
INSERT INTO exam_schedules (exam_id, belt_level, group_code, start_time, end_time, time_slot, venue) VALUES
(@exam_id, 'yellow', 'A', '11:00', '11:30', '11:00-11:30', '寶林文娛活動會堂'),
(@exam_id, 'yellow', 'B', '11:30', '12:00', '11:30-12:00', '寶林文娛活動會堂'),
(@exam_id, 'yellow_green', 'C', '12:00', '12:30', '12:00-12:30', '寶林文娛活動會堂'),
(@exam_id, 'green', 'D', '12:45', '13:15', '12:45-13:15', '寶林文娛活動會堂'),
(@exam_id, 'green_blue', 'E', '13:15', '13:45', '13:15-13:45', '寶林文娛活動會堂'),
(@exam_id, 'green_blue', 'F', '13:45', '14:15', '13:45-14:15', '寶林文娛活動會堂'),
(@exam_id, 'blue', 'G', '14:30', '15:00', '14:30-15:00', '寶林文娛活動會堂'),
(@exam_id, 'blue', 'H', '15:00', '15:30', '15:00-15:30', '寶林文娛活動會堂'),
(@exam_id, 'blue_red', 'I', '15:30', '16:00', '15:30-16:00', '寶林文娛活動會堂'),
(@exam_id, 'blue_red', 'J', '17:00', '17:30', '17:00-17:30', '寶林文娛活動會堂'),
(@exam_id, 'red', 'K', '17:30', '18:00', '17:30-18:00', '寶林文娛活動會堂'),
(@exam_id, 'red_black', 'L', '18:00', '18:30', '18:00-18:30', '寶林文娛活動會堂'),
(@exam_id, 'black', 'M', '18:45', '19:15', '18:45-19:15', '寶林文娛活動會堂'),
(@exam_id, 'black_2dan', 'N', '19:15', '19:45', '19:15-19:45', '寶林文娛活動會堂');

-- 5. 驗證匯入結果
SELECT 'exam_sessions' as tbl, COUNT(*) as cnt FROM exam_sessions
UNION ALL
SELECT 'exam_candidates', COUNT(*) FROM exam_candidates
UNION ALL
SELECT 'exam_schedules', COUNT(*) FROM exam_schedules;

SELECT status, COUNT(*) as cnt FROM exam_candidates GROUP BY status;
