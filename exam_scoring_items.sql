-- 匯入各帶級的評分項目
-- 白帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園5次/小學8次/中學或以上12次', 'grade', 'fitness', 10, 1.00, 'white', 1),
('仰臥起坐', '幼稚園5次/小學8次/中學或以上12次', 'grade', 'fitness', 10, 1.00, 'white', 2),
('蹲坐跳', '幼稚園5次/小學8次/中學或以上12次', 'grade', 'fitness', 10, 1.00, 'white', 3),
('直拳', '直拳10次', 'grade', 'technique', 10, 1.00, 'white', 4),
('前踢', '前踢5次左5次右', 'grade', 'technique', 10, 1.00, 'white', 5),
('cutdown', 'cutdown 5次左5次右', 'grade', 'technique', 10, 1.00, 'white', 6),
('旋踢', '旋踢（小學以上）5次左5次右', 'grade', 'technique', 10, 1.00, 'white', 7);

-- 黃帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園8次/小學12次/中學或以上16次', 'grade', 'fitness', 10, 1.00, 'yellow', 1),
('仰臥起坐', '幼稚園8次/小學12次/中學或以上16次', 'grade', 'fitness', 10, 1.00, 'yellow', 2),
('蹲坐跳', '幼稚園8次/小學12次/中學或以上16次', 'grade', 'fitness', 10, 1.00, 'yellow', 3),
('太極一章', '', 'grade', 'poomsae', 10, 1.50, 'yellow', 4),
('旋踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'yellow', 5),
('上馬cut down', '5次左5次右', 'grade', 'technique', 10, 1.00, 'yellow', 6);

-- 黃綠帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園10次/小學15次/中學或以上20次', 'grade', 'fitness', 10, 1.00, 'yellow_green', 1),
('仰臥起坐', '幼稚園10次/小學15次/中學或以上20次', 'grade', 'fitness', 10, 1.00, 'yellow_green', 2),
('蹲坐跳', '幼稚園10次/小學15次/中學或以上20次', 'grade', 'fitness', 10, 1.00, 'yellow_green', 3),
('太極二章', '', 'grade', 'poomsae', 10, 1.50, 'yellow_green', 4),
('跳躍旋踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'yellow_green', 5),
('跳躍前踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'yellow_green', 6),
('上中雙前踢', '10組', 'grade', 'technique', 10, 1.00, 'yellow_green', 7);

-- 綠帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園10次/小學20次/中學或以上25次', 'grade', 'fitness', 10, 1.00, 'green', 1),
('仰臥起坐', '', 'grade', 'fitness', 10, 1.00, 'green', 2),
('蹲坐跳', '', 'grade', 'fitness', 10, 1.00, 'green', 3),
('太極三章', '', 'grade', 'poomsae', 10, 1.50, 'green', 4),
('後踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'green', 5),
('跳躍cutdown', '5次左5次右', 'grade', 'technique', 10, 1.00, 'green', 6),
('旋踢+旋踢+空中雙旋踢', '3次左3次右', 'grade', 'technique', 10, 1.00, 'green', 7),
('旋踢(木板)', '', 'grade', 'board', 10, 1.00, 'green', 8),
('前踢(木板)', '', 'grade', 'board', 10, 1.00, 'green', 9),
('cutdown(木板)', '', 'grade', 'board', 10, 1.00, 'green', 10),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'green', 11);

-- 綠藍帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '', 'grade', 'fitness', 10, 1.00, 'green_blue', 1),
('仰臥起坐', '', 'grade', 'fitness', 10, 1.00, 'green_blue', 2),
('蹲坐跳', '', 'grade', 'fitness', 10, 1.00, 'green_blue', 3),
('太極四章', '', 'grade', 'poomsae', 10, 1.50, 'green_blue', 4),
('側踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'green_blue', 5),
('旋踢+後踢', '5次左5次右', 'grade', 'technique', 10, 1.00, 'green_blue', 6),
('後踢(木板)', '', 'grade', 'board', 10, 1.00, 'green_blue', 7),
('跳躍cutdown(木板)', '', 'grade', 'board', 10, 1.00, 'green_blue', 8),
('跳躍旋踢(木板)', '', 'grade', 'board', 10, 1.00, 'green_blue', 9),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'green_blue', 10);

-- 藍帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '', 'grade', 'fitness', 10, 1.00, 'blue', 1),
('仰臥起坐', '', 'grade', 'fitness', 10, 1.00, 'blue', 2),
('蹲坐跳', '', 'grade', 'fitness', 10, 1.00, 'blue', 3),
('太極五章', '', 'grade', 'poomsae', 10, 1.50, 'blue', 4),
('跳躍側踢', '', 'grade', 'technique', 10, 1.00, 'blue', 5),
('跳躍後踢', '', 'grade', 'technique', 10, 1.00, 'blue', 6),
('360', '', 'grade', 'technique', 10, 1.00, 'blue', 7),
('肘擊(木板)', '', 'grade', 'board', 10, 1.00, 'blue', 8),
('側踢(木板)', '', 'grade', 'board', 10, 1.00, 'blue', 9),
('上馬後踢(木板)', '', 'grade', 'board', 10, 1.00, 'blue', 10),
('一字馬', '', 'pass_fail', 'split', 10, 1.00, 'blue', 11),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'blue', 12);

-- 藍紅帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '', 'grade', 'fitness', 10, 1.00, 'blue_red', 1),
('仰臥起坐', '', 'grade', 'fitness', 10, 1.00, 'blue_red', 2),
('蹲坐跳', '', 'grade', 'fitness', 10, 1.00, 'blue_red', 3),
('雙膝跳', '', 'grade', 'fitness', 10, 1.00, 'blue_red', 4),
('太極六章', '', 'grade', 'poomsae', 10, 1.50, 'blue_red', 5),
('太極一至五抽籤', '', 'grade', 'poomsae', 10, 1.00, 'blue_red', 6),
('跳躍側踢(木板)', '', 'grade', 'board', 10, 1.00, 'blue_red', 7),
('跳躍後踢(木板)', '', 'grade', 'board', 10, 1.00, 'blue_red', 8),
('360(木板)', '', 'grade', 'board', 10, 1.00, 'blue_red', 9),
('一字馬', '', 'pass_fail', 'split', 10, 1.00, 'blue_red', 10),
('大字馬', '', 'pass_fail', 'side_split', 10, 1.00, 'blue_red', 11),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'blue_red', 12);

-- 紅帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '', 'grade', 'fitness', 10, 1.00, 'red', 1),
('仰臥起坐', '', 'grade', 'fitness', 10, 1.00, 'red', 2),
('蹲坐跳', '', 'grade', 'fitness', 10, 1.00, 'red', 3),
('雙膝跳', '', 'grade', 'fitness', 10, 1.00, 'red', 4),
('太極七章', '', 'grade', 'poomsae', 10, 1.50, 'red', 5),
('太極一至六抽籤', '', 'grade', 'poomsae', 10, 1.00, 'red', 6),
('原地空中雙旋踢', '', 'grade', 'technique', 10, 1.00, 'red', 7),
('跳躍空中側踢', '', 'grade', 'technique', 10, 1.00, 'red', 8),
('後旋踢', '', 'grade', 'technique', 10, 1.00, 'red', 9),
('跳躍雙前踢(木板)', '', 'grade', 'board', 10, 1.00, 'red', 10),
('空中雙旋踢(木板)', '', 'grade', 'board', 10, 1.00, 'red', 11),
('一字馬', '', 'pass_fail', 'split', 10, 1.00, 'red', 12),
('大字馬', '', 'pass_fail', 'side_split', 10, 1.00, 'red', 13),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'red', 14),
('外出比賽一次', '', 'yes_no', 'competition', 10, 1.00, 'red', 15);

-- 紅黑帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園30次/小學45次/中學或以上60次', 'grade', 'fitness', 10, 1.00, 'red_black', 1),
('仰臥起坐', '幼稚園30次/小學45次/中學或以上60次', 'grade', 'fitness', 10, 1.00, 'red_black', 2),
('蹲坐跳', '幼稚園30次/小學35次/中學或以上40次', 'grade', 'fitness', 10, 1.00, 'red_black', 3),
('雙膝跳', '幼稚園30次/小學35次/中學或以上40次', 'grade', 'fitness', 10, 1.00, 'red_black', 4),
('太極一章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 5),
('太極二章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 6),
('太極三章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 7),
('太極四章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 8),
('太極五章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 9),
('太極六章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 10),
('太極七章', '', 'grade', 'poomsae', 10, 1.00, 'red_black', 11),
('太極八章', '', 'grade', 'poomsae', 10, 1.50, 'red_black', 12),
('跳躍前踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 13),
('跳躍橫踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 14),
('跳躍側踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 15),
('跳躍下壓踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 16),
('跳躍後踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 17),
('360度橫踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 18),
('跳躍凌空側踢(要跳箱)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 19),
('後旋踢(左右)(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 20),
('空中雙旋踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 21),
('分飛踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 22),
('雙飛踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 23),
('空中雙前踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', 10, 1.00, 'red_black', 24),
('單手刀劈地(左右)(木板)', '幼稚園2分板X3塊/小學3分板X3塊/中學4分板X5塊/18歲以上6分板X5塊', 'grade', 'board', 10, 1.00, 'red_black', 25),
('直拳(左右)(木板)', '幼稚園2分板X3塊/小學3分板X3塊/中學4分板X5塊/18歲以上6分板X5塊', 'grade', 'board', 10, 1.00, 'red_black', 26),
('一字馬', '', 'pass_fail', 'split', 10, 1.00, 'red_black', 27),
('大字馬', '', 'pass_fail', 'side_split', 10, 1.00, 'red_black', 28);

-- 黑帶
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '小學30次X2set/中學40次X2set', 'grade', 'fitness', 10, 1.00, 'black', 1),
('仰臥起坐', '小學30次X2set/中學40次X2set', 'grade', 'fitness', 10, 1.00, 'black', 2),
('蹲坐跳', '小學30次X2set/中學40次X2set', 'grade', 'fitness', 10, 1.00, 'black', 3),
('雙膝跳', '小學30次X2set/中學40次X2set', 'grade', 'fitness', 10, 1.00, 'black', 4),
('太極一章', '', 'grade', 'poomsae', 10, 1.00, 'black', 5),
('太極二章', '', 'grade', 'poomsae', 10, 1.00, 'black', 6),
('太極三章', '', 'grade', 'poomsae', 10, 1.00, 'black', 7),
('太極四章', '', 'grade', 'poomsae', 10, 1.00, 'black', 8),
('太極五章', '', 'grade', 'poomsae', 10, 1.00, 'black', 9),
('太極六章', '', 'grade', 'poomsae', 10, 1.00, 'black', 10),
('太極七章', '', 'grade', 'poomsae', 10, 1.00, 'black', 11),
('太極八章', '', 'grade', 'poomsae', 10, 1.50, 'black', 12),
('跳躍前踢(左右)(木板)', '幼稚園3分板/小學4分板/中學6分板', 'grade', 'board', 10, 1.00, 'black', 13),
('跳躍旋踢(左右)(木板)', '幼稚園3分板/小學4分板/中學6分板', 'grade', 'board', 10, 1.00, 'black', 14),
('跳躍側踢(左右)(木板)', '幼稚園3分板/小學4分板/中學6分板', 'grade', 'board', 10, 1.00, 'black', 15),
('跳躍下壓踢(左右)(木板)', '幼稚園3分板/小學4分板/中學6分板', 'grade', 'board', 10, 1.00, 'black', 16),
('跳躍後踢(左右)(木板)', '幼稚園3分板/小學4分板/中學6分板', 'grade', 'board', 10, 1.00, 'black', 17),
('一字馬', '', 'pass_fail', 'split', 10, 1.00, 'black', 18),
('大字馬', '', 'pass_fail', 'side_split', 10, 1.00, 'black', 19),
('搏擊', '', 'pass_fail', 'sparring', 10, 1.00, 'black', 20),
('外出比賽一次(搏擊)', '', 'yes_no', 'competition', 10, 1.00, 'black', 21),
('外出比賽一次(套拳)', '', 'yes_no', 'competition', 10, 1.00, 'black', 22);
