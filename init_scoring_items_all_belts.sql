-- 插入缺失的5個帶級評分項目: green_blue, blue, blue_red, red_black, black

-- green_blue (綠藍帶) - 11項
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園15次/小學20次/中學或以上25次', 'grade', 'fitness', '10.00', '1', 'green_blue', 0),
('仰臥起坐', '幼稚園15次/小學20次/中學或以上25次', 'grade', 'fitness', '10.00', '1', 'green_blue', 1),
('蹲坐跳', '幼稚園15次/小學20次/中學或以上25次', 'grade', 'fitness', '10.00', '1', 'green_blue', 2),
('太極四章', '', 'grade', 'poomsae', '10.00', '1.5', 'green_blue', 3),
('側踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'green_blue', 4),
('旋踢+後踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'green_blue', 5),
('退後旋踢+退後旋踢+退後空中雙旋踢', '3次左3次右', 'grade', 'technique', '10.00', '1', 'green_blue', 6),
('後踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'green_blue', 7),
('跳躍cutdown(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'green_blue', 8),
('跳躍旋踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'green_blue', 9),
('搏擊', '', 'pass_fail', 'sparring', '10.00', '1', 'green_blue', 10);

-- blue (藍帶) - 13項
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園20次/小學30次/中學或以上35次', 'grade', 'fitness', '10.00', '1', 'blue', 0),
('仰臥起坐', '幼稚園20次/小學30次/中學或以上35次', 'grade', 'fitness', '10.00', '1', 'blue', 1),
('蹲坐跳', '幼稚園20次/小學30次/中學或以上35次', 'grade', 'fitness', '10.00', '1', 'blue', 2),
('太極五章', '', 'grade', 'poomsae', '10.00', '1.5', 'blue', 3),
('跳躍側踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue', 4),
('跳躍後踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue', 5),
('360', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue', 6),
('跳躍旋踢+跳躍cutdown', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue', 7),
('肘擊(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue', 8),
('側踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue', 9),
('上馬後踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue', 10),
('一字馬', '', 'pass_fail', 'split', '10.00', '1', 'blue', 11),
('搏擊', '', 'pass_fail', 'sparring', '10.00', '1', 'blue', 12);

-- blue_red (藍紅帶) - 15項
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園25次/小學40次/中學或以上50次', 'grade', 'fitness', '10.00', '1', 'blue_red', 0),
('仰臥起坐', '幼稚園25次/小學40次/中學或以上50次', 'grade', 'fitness', '10.00', '1', 'blue_red', 1),
('蹲坐跳', '幼稚園20次/小學30次/中學或以上35次', 'grade', 'fitness', '10.00', '1', 'blue_red', 2),
('雙膝跳', '幼稚園20次/小學30次/中學或以上35次', 'grade', 'fitness', '10.00', '1', 'blue_red', 3),
('太極六章', '', 'grade', 'poomsae', '10.00', '1.5', 'blue_red', 4),
('太極一至五抽籤', '', 'grade', 'poomsae', '10.00', '1', 'blue_red', 5),
('退後跳躍後踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue_red', 6),
('旋踢+360旋踢', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue_red', 7),
('跳躍側踢+跳躍cutdown', '5次左5次右', 'grade', 'technique', '10.00', '1', 'blue_red', 8),
('跳躍側踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue_red', 9),
('跳躍後踢(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue_red', 10),
('360(木板)', '幼稚園2分板/小學3分板/中學4分板/18歲以上6分板', 'grade', 'board', '10.00', '1', 'blue_red', 11),
('一字馬', '', 'pass_fail', 'split', '10.00', '1', 'blue_red', 12),
('大字馬', '', 'pass_fail', 'side_split', '10.00', '1', 'blue_red', 13),
('搏擊', '', 'pass_fail', 'sparring', '10.00', '1', 'blue_red', 14);

-- red_black (紅黑帶) - 14項
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '幼稚園30次/小學45次/中學或以上60次', 'grade', 'fitness', '10.00', '1', 'red_black', 0),
('仰臥起坐', '幼稚園30次/小學45次/中學或以上60次', 'grade', 'fitness', '10.00', '1', 'red_black', 1),
('蹲坐跳', '幼稚園30次/小學35次/中學或以上40次', 'grade', 'fitness', '10.00', '1', 'red_black', 2),
('雙膝跳', '幼稚園30次/小學35次/中學或以上40次', 'grade', 'fitness', '10.00', '1', 'red_black', 3),
('太極一章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 4),
('太極二章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 5),
('太極三章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 6),
('太極四章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 7),
('太極五章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 8),
('太極六章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 9),
('太極七章', NULL, 'grade', 'poomsae', '10.00', '1', 'red_black', 10),
('太極八章', NULL, 'grade', 'poomsae', '10.00', '1.5', 'red_black', 11),
('一字馬', '', 'pass_fail', 'split', '10.00', '1', 'red_black', 12),
('大字馬', '', 'pass_fail', 'side_split', '10.00', '1', 'red_black', 13);

-- black (黑帶) - 10項
INSERT INTO exam_scoring_items (name, description, type, category, max_score, weight, belt_level, sort_order) VALUES
('掌上壓', '小學30次X2set/中學40次X2set', 'grade', 'fitness', '10.00', '1', 'black', 0),
('仰臥起坐', '小學30次X2set/中學40次X2set', 'grade', 'fitness', '10.00', '1', 'black', 1),
('蹲坐跳', '小學30次X2set/中學40次X2set', 'grade', 'fitness', '10.00', '1', 'black', 2),
('雙膝跳', '小學30次X2set/中學40次X2set', 'grade', 'fitness', '10.00', '1', 'black', 3),
('太極一至八章', NULL, 'grade', 'poomsae', '10.00', '1.5', 'black', 4),
('一字馬', '', 'pass_fail', 'split', '10.00', '1', 'black', 5),
('大字馬', '', 'pass_fail', 'side_split', '10.00', '1', 'black', 6),
('搏擊', '', 'pass_fail', 'sparring', '10.00', '1', 'black', 7),
('外出比賽一次(搏擊)', '', 'yes_no', 'competition', '10.00', '1', 'black', 8),
('外出比賽一次(套拳)', '', 'yes_no', 'competition', '10.00', '1', 'black', 9);
