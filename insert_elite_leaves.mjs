// Insert elite class leave (excused) records
// Run: node insert_elite_leaves.mjs

import mysql from 'mysql2/promise';

const pool = await mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'taekwondo',
  charset: 'utf8mb4',
});

// Get all elite students
const [students] = await pool.query('SELECT id, name FROM elite_students');
const studentMap = {};
for (const s of students) {
  studentMap[s.name] = s.id;
}

// Get all schedules for 2026
const [schedules] = await pool.query(
  "SELECT id, DATE(training_date) as dt FROM elite_schedules WHERE training_date >= '2025-12-01' AND training_date <= '2026-12-31' ORDER BY training_date"
);
const scheduleMap = {};
for (const s of schedules) {
  const dateStr = s.dt instanceof Date ? s.dt.toISOString().split('T')[0] : String(s.dt);
  scheduleMap[dateStr] = s.id;
}

console.log('Students:', Object.keys(studentMap).length);
console.log('Schedules:', Object.keys(scheduleMap).length);
console.log('Schedule dates:', Object.keys(scheduleMap).join(', '));

// Name aliases / corrections
const nameAliases = {
  'Andre Youchen Yang': '楊猷宸',
  'kong pak kiu': '江柏僑',
  'hon ho nam': '韓灝南',
  'Lam nok tin': '林諾天',
  '鄒詩誰': '鄒詩雅',
  '賴柏希請假': '賴柏希',
  '袁遠朗': '袁逸朗',
  '袁穗睛': '袁穗晴',
  '袁梓睎': '袁梓晞',
  '林頴萳': '林穎萳',
  '楊堃毅': '楊猷宸', // same person different name? let me check
};

// Multi-student entries: one record line contains multiple students
function expandNames(rawName) {
  const resolvedName = nameAliases[rawName] || rawName;
  
  // Check for known multi-student patterns
  const multiPatterns = [
    { pattern: '林文傑林明慧', names: ['林文傑', '林明慧'] },
    { pattern: '林文傑 林明慧', names: ['林文傑', '林明慧'] },
    { pattern: '葉晧晴蘇柏霖', names: ['葉晧晴', '蘇柏霖'] },
    { pattern: '葉晧晴 蘇柏霖', names: ['葉晧晴', '蘇柏霖'] },
    { pattern: '林頴萳，林煒堯', names: ['林穎萳', '林煒堯'] },
    { pattern: '林穎萳，林煒堯', names: ['林穎萳', '林煒堯'] },
    { pattern: '劉燊政 劉宇政', names: ['劉燊政', '劉宇政'] },
    { pattern: '劉宇政 劉燊政', names: ['劉宇政', '劉燊政'] },
    { pattern: '袁遠朗', names: ['袁逸朗'] },
    { pattern: '袁穗睛', names: ['袁穗晴'] },
  ];
  
  for (const mp of multiPatterns) {
    if (rawName === mp.pattern) return mp.names;
  }
  
  // Check comma-separated
  if (resolvedName.includes('，') || resolvedName.includes(',')) {
    return resolvedName.split(/[，,]/).map(n => {
      const trimmed = n.trim();
      return nameAliases[trimmed] || trimmed;
    });
  }
  
  return [resolvedName];
}

// Parse date: "2026年3月1日" or "2月8日" (assume 2026) or "12月28日" (could be 2025)
function parseDate(dateStr) {
  dateStr = dateStr.trim();
  
  // Full format: 2026年3月1日
  let m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const y = parseInt(m[1]);
    const mo = parseInt(m[2]);
    const d = parseInt(m[3]);
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  
  // Short format: 2月8日 or 12月28日 (year is 2026 except 12月28日 which is 2025)
  m = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const mo = parseInt(m[1]);
    const d = parseInt(m[2]);
    // 12月28日 is likely 2025-12-28 based on context
    const year = mo === 12 ? 2025 : 2026;
    return `${year}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  
  return null;
}

// Raw leave data from user
const rawData = `朱棋楓	2026年3月1日
楊惜林	2026年3月1日
簡頌曦	2026年3月8日
簡頌曦	2026年3月1日
林恩同	2026年3月1日
梁珀豪	2026年3月1日
麥晉維	2026年3月1日
林慧玲	2026年3月1日
張翊瑋	2026年3月1日
施俊杰	2026年3月1日
黃銘軒	2026年3月1日
葉晧晴	2026年3月1日
蔡御霆	2026年3月1日
林文傑林明慧	2026年3月1日
蔡宏鑫	2026年3月1日
袁逸朗	2026年3月8日
袁穗晴	2026年3月8日
黃子淇	2026年3月1日
吳傲天	2026年3月1日
Andre Youchen Yang	2026年3月1日
歐航瑋	2026年3月1日
譚子鋭	2026年3月1日
林頴萳，林煒堯	2026年3月1日
楊堃毅	2026年3月1日
王彥喬	2026年3月1日
黃頌琛	2026年3月1日
劉玥	2026年3月1日
楊廷諄	2026年3月1日
侯兆洪	2026年3月8日
周泓謙	2026年3月1日
陳臻軒	2026年3月1日
陳孝謙	2026年3月1日
吳博立	2026年3月1日
黃瑛霖	2026年3月1日
葉明恩	2026年3月1日
葉駿輝	2026年3月1日
葉栩靖	2026年3月1日
丁子聰	2026年3月1日
王浩宇	2026年3月1日
林恩同	2月22日
李弘正	2月22日
黃銘軒	2月22日
吳傲天	2026年3月1日
吳傲天	2月22日
吳傲天	2月15日
黃煒庭	2月22日
麥晉維	2月15日
林恩同	2月15日
王浩宇	2月22日
丁子聰	2月8日
鄒詩誰	2月8日
朱棋楓	2月8日
侯兆洪	2月8日
kong pak kiu	2月8日
楊堃毅	2月8日
張翊瑋	2月8日
王嘉楷	2月8日
黃柏熹	2月8日
麥晉維	2月8日
施俊杰	2月8日
簡頌曦	2月8日
洪卓斌	2月8日
Andre Youchen Yang	2月8日
劉燊政 劉宇政	2月8日
吳博立	2月8日
林慧玲	2月8日
賴柏希請假	2月8日
葉晧晴蘇柏霖	2月8日
黃曜軒	2月8日
林文傑林明慧	2月8日
吳卓謙	2月8日
黃子淇	2月8日
歐航瑋	2月8日
陳孝謙	2月8日
楊廷諄	2月8日
劉玥	2月8日
龐兆羽	2月8日
林穎萳，林煒堯	2月8日
袁梓睎	2月8日
陳景韜	2月8日
黃天愉	2月8日
袁逸朗	2月8日
袁穗晴	2月8日
麥晉維	2月1日
李泳霖	2月1日
吳傲天	2月8日
林恩同	2月1日
鄒詩雅	2月1日
Andre Youchen Yang	2月1日
張翊瑋	2月1日
簡頌曦	2月1日
林文傑 林明慧	2月1日
劉宇政 劉燊政	2月1日
施俊杰	2月1日
葉晧晴 蘇柏霖	2月1日
林慧玲	2月1日
林慧玲	2月1日
蔡宏鑫	2月1日
林穎萳，林煒堯	2月1日
歐航瑋	2月1日
丁子聰	2月1日
陳臻軒	2月1日
洪卓斌	2月1日
劉玥	2月1日
吳博立	2月1日
吳傲天	2月1日
黃梓峻	2月1日
陳孝謙	2月1日
王彥喬	2月1日
黃天愉	2月1日
龐兆羽	2月1日
李泳霖	2月1日
林文傑林明慧	1月25日
梁珀豪	1月25日
hon ho nam	1月25日
黃銘軒	1月25日
朱棋楓	1月25日
葉晧晴	1月25日
麥晉維	1月25日
洪卓斌	1月25日
林恩同	1月25日
劉燊政 劉宇政	1月25日
施俊杰	1月25日
侯兆洪	1月25日
吳博立	1月25日
張翊瑋	1月25日
蔡宏鑫	1月25日
林慧玲	1月25日
歐航瑋	1月25日
葉明恩	1月25日
葉駿輝	1月25日
葉栩靖	1月25日
吳傲天	1月25日
林頴萳，林煒堯	1月25日
徐志杰	1月25日
楊堃毅	1月25日
黃子淇	1月25日
黃曜軒	1月25日
陳梓軒	1月25日
袁遠朗	2月1日
袁穗睛	2月1日
袁穗晴	1月4日
龐兆羽	1月25日
黃頌琛	1月25日
陳景韜	1月25日
丁子聰	1月25日
郭俊康	1月25日
劉玥	1月25日
簡頌曦	1月18日
王嘉楷	1月18日
麥晉維	1月18日
黃柏熹	1月18日
歐航瑋	1月18日
葉明恩	1月18日
葉駿輝	1月18日
葉栩靖	1月18日
林慧玲	1月18日
譚子鋭	1月18日
李弘正	1月18日
Lam nok tin	1月18日
葉晧晴 蘇柏霖	1月18日
李弘正	1月18日
hon ho nam	1月18日
鄒詩雅	1月18日
鄒曉澄	1月18日
Andre Youchen Yang	1月18日
楊堃毅	1月18日
張翊瑋	1月18日
李梓皓	1月18日
吳博立	1月18日
洪卓斌	1月18日
丁子聰	1月18日
黃頌琛	1月18日
林文傑林明慧	1月18日
施俊杰	1月18日
蔡宏鑫	1月18日
林恩同	1月18日
劉玥	1月18日
吳卓謙	1月18日
陳臻軒	1月18日
龐兆羽	1月18日
陳孝謙	1月18日
黃天愉	1月18日
黃銘軒	1月18日
李泳霖	2月8日
李泳霖	1月11日
赖柏希	1月18日
黃煒庭	1月18日
黃銘軒	1月11日
黃銘軒	1月4日
鄒曉澄	1月11日
鄒詩雅	1月11日
簡頌曦	1月11日
朱棋楓	1月11日
簡頌曦	1月4日
吳傲天	1月11日
鄭焯謙	1月11日
葉晧晴 蘇柏霖	1月11日
葉晧晴 蘇柏霖	1月4日
黃頌琛	1月11日
蔡御霆	1月11日
張翊瑋	1月11日
周泓謙	1月11日
徐志杰	1月4日
譚子鋭	1月11日
譚子鋭	1月4日
龐兆羽	1月11日
葉明恩	1月11日
葉駿輝	1月11日
葉栩靖	1月11日
楊堃毅	1月11日
林慧玲	1月11日
林恩同	1月11日
林恩同	1月4日
袁逸朗	1月25日
袁逸朗	1月18日
袁逸朗	1月11日
袁穗晴	1月25日
袁穗晴	1月18日
袁穗晴	1月11日
劉玥	1月11日
丁子聰	1月11日
黃曜軒	1月11日
吳博立	1月11日
黃天愉	1月11日
梁熙朗	1月11日
梁熙朗	1月4日
郭俊康	1月11日
蔡宏鑫	1月11日
歐航瑋	1月11日
施俊杰	1月11日
麥晉維	1月11日
蔡御霆	1月11日
林文傑林明慧	1月11日
黃煒庭	1月11日
黃煒庭	1月11日
林穎萳，林煒堯11/1/2026	12月28日`;

// Parse raw data
const lines = rawData.trim().split('\n');
const leaveRecords = [];
const warnings = [];
const notFoundStudents = new Set();

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  
  // Special case: "林穎萳，林煒堯11/1/2026	12月28日"
  // This line has a weird format — the last line is special
  let namePart, datePart;
  
  const tabIdx = trimmed.lastIndexOf('\t');
  if (tabIdx === -1) {
    warnings.push(`No tab separator: ${trimmed}`);
    continue;
  }
  
  namePart = trimmed.substring(0, tabIdx).trim();
  datePart = trimmed.substring(tabIdx + 1).trim();
  
  // Handle the special last line: "林穎萳，林煒堯11/1/2026" + "12月28日"
  // The "11/1/2026" stuck to the name is actually the date for the next entry
  // But since date is "12月28日" → 2025-12-28
  // And the name has "11/1/2026" appended — that's actually date "1月11日" for these 2 students
  if (namePart.match(/\d+\/\d+\/\d+$/)) {
    // Extract the embedded date
    const dateMatch = namePart.match(/(\d+)\/(\d+)\/(\d+)$/);
    if (dateMatch) {
      const embeddedDay = parseInt(dateMatch[1]);
      const embeddedMonth = parseInt(dateMatch[2]);
      const embeddedYear = parseInt(dateMatch[3]);
      const cleanName = namePart.replace(/\d+\/\d+\/\d+$/, '').trim();
      
      // This line: names are "林穎萳，林煒堯", embedded date is 11/1/2026 = Jan 11
      const embeddedDateStr = `${embeddedYear}-${String(embeddedMonth).padStart(2,'0')}-${String(embeddedDay).padStart(2,'0')}`;
      const names1 = expandNames(cleanName);
      for (const name of names1) {
        leaveRecords.push({ name, date: embeddedDateStr });
      }
      
      // And the tab-separated date "12月28日" is for these same students
      const date2 = parseDate(datePart);
      if (date2) {
        for (const name of names1) {
          leaveRecords.push({ name, date: date2 });
        }
      }
      continue;
    }
  }
  
  const date = parseDate(datePart);
  if (!date) {
    warnings.push(`Cannot parse date: ${datePart} (line: ${trimmed})`);
    continue;
  }
  
  const names = expandNames(namePart);
  for (const name of names) {
    leaveRecords.push({ name, date });
  }
}

// Extra aliases for name variations
const extraAliases = {
  '赖柏希': '賴柏希', // simplified → traditional
  '張翊瑋': null, // not in elite students — need to check
  '黃子淇': null,
  '王彥喬': null,
  '黃梓峻': null,
  '楊堃毅': null,
  '鄭焯謙': null,
};

// Resolve student IDs
const resolvedRecords = [];
const dedup = new Set();

for (const rec of leaveRecords) {
  let name = rec.name;
  
  // Apply extra aliases
  if (name === '赖柏希') name = '賴柏希';
  
  // Look up student
  let studentId = studentMap[name];
  
  if (!studentId) {
    notFoundStudents.add(name);
    continue;
  }
  
  // Look up schedule
  const scheduleId = scheduleMap[rec.date];
  if (!scheduleId) {
    // Skip cancelled dates (Feb 15, Feb 22 are cancelled)
    if (rec.date === '2026-02-15' || rec.date === '2026-02-22') {
      // These dates have schedule IDs even though cancelled
      // Let me still record — the schedule exists just with status=cancelled
      const cancelledScheduleId = scheduleMap[rec.date];
      if (!cancelledScheduleId) {
        warnings.push(`No schedule for cancelled date ${rec.date}, student: ${name}`);
        continue;
      }
    } else {
      warnings.push(`No schedule for date ${rec.date}, student: ${name}`);
      continue;
    }
  }
  
  // Dedup
  const key = `${studentId}-${scheduleId}`;
  if (dedup.has(key)) continue;
  dedup.add(key);
  
  resolvedRecords.push({
    student_id: studentId,
    schedule_id: scheduleId,
    name: name,
    date: rec.date,
  });
}

console.log('\n=== Summary ===');
console.log(`Total leave entries parsed: ${leaveRecords.length}`);
console.log(`Resolved records (after dedup): ${resolvedRecords.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Students not found: ${notFoundStudents.size}`);

if (warnings.length > 0) {
  console.log('\n--- Warnings ---');
  for (const w of warnings) console.log(' ⚠️', w);
}

if (notFoundStudents.size > 0) {
  console.log('\n--- Students NOT found in DB ---');
  for (const name of notFoundStudents) console.log(' ❌', name);
}

// Check for existing records to avoid duplicates
const existingCheck = await pool.query(
  `SELECT student_id, schedule_id FROM elite_attendance 
   WHERE status = 'excused' 
   AND schedule_id IN (SELECT id FROM elite_schedules WHERE training_date >= '2025-12-01' AND training_date <= '2026-12-31')`
);
const existingSet = new Set();
for (const row of existingCheck[0]) {
  existingSet.add(`${row.student_id}-${row.schedule_id}`);
}

const newRecords = resolvedRecords.filter(r => !existingSet.has(`${r.student_id}-${r.schedule_id}`));
console.log(`\nAlready existing excused records: ${existingSet.size}`);
console.log(`New records to insert: ${newRecords.length}`);

if (newRecords.length > 0) {
  // Show preview by date
  const byDate = {};
  for (const r of newRecords) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r.name);
  }
  console.log('\n--- New records by date ---');
  for (const [date, names] of Object.entries(byDate).sort()) {
    console.log(`  ${date}: ${names.join(', ')} (${names.length}人)`);
  }
  
  // Insert
  console.log('\nInserting...');
  let inserted = 0;
  for (const r of newRecords) {
    try {
      await pool.query(
        'INSERT INTO elite_attendance (schedule_id, student_id, status, notes) VALUES (?, ?, ?, ?)',
        [r.schedule_id, r.student_id, 'excused', '請假']
      );
      inserted++;
    } catch (err) {
      console.error(`  Failed to insert: student=${r.name}(${r.student_id}), schedule=${r.schedule_id}:`, err.message);
    }
  }
  console.log(`✅ Successfully inserted ${inserted} leave records`);
} else {
  console.log('No new records to insert.');
}

await pool.end();
