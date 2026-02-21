import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'tkd_user',
    password: 'tkd_pass_2026',
    database: 'taekwondo',
    charset: 'UTF8MB4_GENERAL_CI',
  });

  const rawLeaves: Record<string, string[]> = JSON.parse(fs.readFileSync('./elite_leaves.json', 'utf-8'));

  const [studentRows] = await pool.query('SELECT id, name FROM elite_students') as any[];
  const studentMap = new Map<string, number>();
  for (const s of studentRows) studentMap.set(s.name, s.id);

  const [scheduleRows] = await pool.query('SELECT id, DATE(training_date) as dt FROM elite_schedules') as any[];
  const scheduleMap = new Map<string, number>();
  for (const s of scheduleRows) {
    const dateStr = typeof s.dt === 'string' ? s.dt : s.dt.toISOString().slice(0, 10);
    scheduleMap.set(dateStr, s.id);
  }

  // Manual name → student name(s) mapping
  // value can be a single name or array of names (for multi-person entries)
  const manualAliases: Record<string, string | string[]> = {
    // English
    'Luna': 'Luna Petralia', 'Luna PETRALIA': 'Luna Petralia',
    'hon ho nam': '韓灝南',
    'Lam nok tin': '林諾天', 'Lam NokTin': '林諾天', 'LamNokTin': '林諾天',
    'Enzo': 'Enzo',
    'Andre Youchen Yang': '楊猷宸', 'Andre Youchen Yang 楊猷宸': '楊猷宸', 'Andre Youchen Yang楊猷宸': '楊猷宸',
    '楊猷宸Andre Youchen Yang': '楊猷宸',
    'Yeung ting chun': '楊廷諄',
    'kong pak kiu': '江柏僑',
    'Heiyu': '黃曜軯',
    'Torsten Yu': '',
    'Wong Tsz Ki': '', 'Wong Wing Lok': '',
    'ML': '', 'Sandy': '', 'kiko29123@gmail.com': '',
    'Tsoi Yung Shing': '',
    'Yu Ho Fei': '', 'Yu Ho Fri': '',
    'Lau san ching lau yu ching': '',

    // Chinese typos / variants
    '偶航瑋': '歐航瑋', '歐航偉': '歐航瑋',
    '张溰榆': '張溰榆', '張溢毊': '張溰榆',
    '曾𧘲媃': '曾祉媃', '曾祉媃（請假24/12）': '曾祉媃',
    '洪卓斌': '洪卓斐',
    '赖柏希': '賴柏希', '赖柏希(發燒病假)': '賴柏希',
    '賴柏希(病假）': '賴柏希', '賴柏希請假': '賴柏希', '賴柏希（病假）': '賴柏希',
    '皺曉澄': '鄒曉澄', '皺詩雅': '鄒詩雅',
    '鄒詩东': '鄒詩雅', '鄒詩誰': '鄒詩雅',
    '袁穂情': '袁穗晴', '袁穂晴': '袁穗晴', '袁穗睛': '袁穗晴',
    '袁穗晴(25年1月5日）': '袁穗晴', '袁穗晴(9月17日)': '袁穗晴',
    '袁遠朗': '袁逸朗', '袁逸朗9月17日': '袁逸朗',
    '袁梓睎': '袁梓睡',
    '鄧浚濠': '鄧浚濵',
    '葵御霆': '蔡御霆',
    '鄔子聰': '丁子聰',
    '陳梓銅': '陳梓軒',
    '黃曜軒': '黃曜軯',
    '黃柏熹': '黃柏熙',
    '黃頌一木': '黃頌琛',
    '黄顓頎': '黄顧頕',
    '鄧綽翹': '鄧穎翹', '鄧穎翹 Tang Wing Kiu': '鄧穎翹',
    '黃瑛霖': '黃銀軯',
    '慧玲': '林慧玲',
    '楊惜林 感冒': '楊惜林',
    '李啟鋒': '李弘正',  // possible match? skip if wrong - actually not in DB
    '李啓峰': '李弘正',
    '吳傲天（14/7）請假': '吳傲天',
    '李子昊🙇🏻‍♀️': '李弘正', // not sure

    // Multi-person entries → both students
    '葉晧晴 蘇柏霖': ['葉晧晴', '蘇柏霖'],
    '葉晧晴蘇柏霖': ['葉晧晴', '蘇柏霖'],
    '蘇柏霖 葉晧晴': ['蘇柏霖', '葉晧晴'],
    '鄒曉澄鄒詩雅': ['鄒曉澄', '鄒詩雅'],
    '鄒詩雅鄒曉澄': ['鄒詩雅', '鄒曉澄'],
    '林文傑林明慧': ['林文傑', '林明慧'],
    '林文傑 林明慧': ['林文傑', '林明慧'],
    '林明慧林文傑': ['林明慧', '林文傑'],
    '林穎萳，林煒堯': ['林頴萳', '林煒堯'],
    '林頴萳，林煒堯': ['林頴萳', '林煒堯'],
    '林煒堯，林頴萳': ['林煒堯', '林頴萳'],
    '林穎萳，林煒堯11/1/2026': ['林頴萳', '林煒堯'],
    '劉宇政 劉燊政': ['劉宇政', '劉燊政'],
    '劉燊政 劉宇政': ['劉燊政', '劉宇政'],
    '燊政 宇政': ['劉燊政', '劉宇政'],
    '許學彥+許晉彥': ['許雋昇'],
    '許學彥、許晉彥': ['許雋昇'],
    '許晉彥+許學彥': ['許雋昇'],
    '陳雪瑩 陳羽晴': [],
    '馮詩㦤、馮俊琂': [],
    '馮詩㦤': [],
    '謝子康 、謝子朗': [], '謝子康、謝子朗': [], '謝謝子康、謝子朗': [],
    '陸曉琳啊，只是': [],
    
    // Names NOT in DB (former students etc.) - empty = skip
    '張翊瑋': '', '周綽琪': '', '吳忻潼': '', '胡子琳': '', '潘睿晞': '',
    '趙晉翹': '', '黃恩諾': '', '劉承霖': '', '黃子淇': '',
    '何傲軒': '', '李子昊': '', '謝進烯': '', '鄭焯謙': '',
    '潘奕霖': '', '蔡雍誠': '', '余柏言': '', '李卓諾': '',
    '黎潼宇': '', '吳泳樑': '', '楊堃毅': '', '楊堃昊': '',
    '許學彥': '', '許晉彥': '', '陳柏穎': '',
    '丁曉慈': '', '丁曉正': '', '周映澄': '', '李柏年': '',
    '何梓浩': '', '何梓鍵': '', '潘志軒': '', '陳姿凝': '',
    '朱晴朗': '', '林雪曦': '', '陳迦翹': '', '馮俊琂': '',
    '李奕果': '', '甘子健': '', '郭昊翔': '', '陸曉琳': '',
    '馮詩懿': '', '黃子蕎': '', '劉彦餘': '', '黃永樂': '',
    '陳羽晴': '', '姚竣朗': '', '林恩賜': '', '蔡煒彬': '',
    '劉雨申': '', '李耀熙': '', '馮顯揚': '', '黃梓峻': '',
    '余昊飛': '', '劉丞霖': '', '吳天澔': '', '呂健峰': '',
    '張子芮': '', '林婉溋': '', '梁顥茗': '', '王彥喬': '', '王曉嵐': '',
    '蘇樂琳': '', '何欣婷': '', '吳連謙': '', '堃毅': '',
    '張翊璋': '', '朱熙瑜': '', '陳亮羽': '', '陳亮霏': '',
    '郭峻彥': '', '麥僥楓': '',
    '楊堃昊楊堃毅': '', '楊堃毅楊堃昊': '', '楊堃毅／楊堃昊': '', '楊堃昊毅': '',
  };

  // Build alias map
  const aliasMap = new Map<string, number[]>(); // name -> student IDs

  for (const name of Object.keys(rawLeaves)) {
    if (studentMap.has(name)) {
      aliasMap.set(name, [studentMap.get(name)!]);
      continue;
    }
    if (name in manualAliases) {
      const target = manualAliases[name];
      if (!target || (Array.isArray(target) && target.length === 0)) continue;
      const targets = Array.isArray(target) ? target : [target];
      const ids = targets.map(t => studentMap.get(t)).filter((id): id is number => id !== undefined);
      if (ids.length > 0) aliasMap.set(name, ids);
      continue;
    }
    // Case-insensitive
    const lower = name.toLowerCase().replace(/\s+/g, '');
    for (const [sName, sId] of studentMap.entries()) {
      if (sName.toLowerCase().replace(/\s+/g, '') === lower) {
        aliasMap.set(name, [sId]);
        break;
      }
    }
  }

  // Clear & reimport
  await pool.query("DELETE FROM elite_attendance WHERE status = 'excused'");

  const existingSet = new Set<string>();
  const [existingRows] = await pool.query("SELECT schedule_id, student_id FROM elite_attendance") as any[];
  for (const e of existingRows) existingSet.add(`${e.schedule_id}-${e.student_id}`);

  let inserted = 0;
  let skippedNoStudent = 0;
  let skippedNoSchedule = 0;
  const insertValues: [number, number, string][] = [];

  for (const [name, dates] of Object.entries(rawLeaves)) {
    const studentIds = aliasMap.get(name);
    if (!studentIds || studentIds.length === 0) {
      skippedNoStudent += dates.length;
      continue;
    }
    for (const dateStr of dates) {
      const scheduleId = scheduleMap.get(dateStr);
      if (!scheduleId) { skippedNoSchedule++; continue; }
      for (const studentId of studentIds) {
        const key = `${scheduleId}-${studentId}`;
        if (existingSet.has(key)) continue;
        insertValues.push([scheduleId, studentId, 'excused']);
        existingSet.add(key);
      }
    }
  }

  const chunkSize = 500;
  for (let i = 0; i < insertValues.length; i += chunkSize) {
    const chunk = insertValues.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
    await pool.query(`INSERT INTO elite_attendance (schedule_id, student_id, status) VALUES ${placeholders}`, chunk.flat());
    inserted += chunk.length;
  }

  console.log('========== Import Summary ==========');
  console.log(`Total leave entries: ${Object.values(rawLeaves).reduce((s, d) => s + d.length, 0)}`);
  console.log(`✅ Inserted as excused: ${inserted}`);
  console.log(`⏭️  No student match:    ${skippedNoStudent} (former students / not in DB)`);
  console.log(`⏭️  No schedule match:   ${skippedNoSchedule}`);

  const [verifyRows] = await pool.query("SELECT COUNT(*) as cnt FROM elite_attendance WHERE status = 'excused'") as any[];
  console.log(`\n📊 Total excused records: ${verifyRows[0].cnt}`);

  // Per-student summary
  const [perStudentRows] = await pool.query(`
    SELECT es.name, COUNT(*) as leave_count
    FROM elite_attendance ea
    JOIN elite_students es ON es.id = ea.student_id
    WHERE ea.status = 'excused'
    GROUP BY es.id, es.name
    ORDER BY leave_count DESC
    LIMIT 15
  `) as any[];
  console.log('\n📋 Top 15 leave counts:');
  for (const r of perStudentRows) {
    console.log(`   ${r.name}: ${r.leave_count} 次`);
  }

  await pool.end();
}

main().catch(console.error);
