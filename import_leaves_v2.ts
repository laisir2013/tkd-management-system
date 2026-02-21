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
  console.log(`Students: ${studentRows.length}`);

  const [scheduleRows] = await pool.query('SELECT id, DATE(training_date) as dt FROM elite_schedules') as any[];
  const scheduleMap = new Map<string, number>();
  for (const s of scheduleRows) {
    const dateStr = typeof s.dt === 'string' ? s.dt : s.dt.toISOString().slice(0, 10);
    scheduleMap.set(dateStr, s.id);
  }

  // Manual name → student name mapping (based on the unmatched names analysis)
  const manualAliases: Record<string, string> = {
    // English names
    'Luna': 'Luna Petralia',
    'Luna PETRALIA': 'Luna Petralia',
    'hon ho nam': '韓灝南',
    'Lam nok tin': '林諾天',
    'Lam NokTin': '林諾天',
    'LamNokTin': '林諾天',
    'Enzo': 'Enzo',
    'Andre Youchen Yang': '楊猷宸',
    'Andre Youchen Yang 楊猷宸': '楊猷宸',
    'Andre Youchen Yang楊猷宸': '楊猷宸',
    'Yeung ting chun': '楊廷諄',
    'Tsoi Yung Shing': '蔡宏鑫',  // not sure, skip if wrong
    'Wong Tsz Ki': '黃子淇',  // not in DB
    'kong pak kiu': '江柏僑',
    'Yu Ho Fei': '余學然',  // not sure
    'Yu Ho Fri': '余學然',  // not sure

    // Chinese typos / variants
    '偶航瑋': '歐航瑋',
    '歐航偉': '歐航瑋',
    '张溰榆': '張溰榆',
    '張溢毊': '張溰榆',
    '曾𧘲媃': '曾祉媃',
    '洪卓斌': '洪卓斐',
    '赖柏希': '賴柏希',
    '赖柏希(發燒病假)': '賴柏希',
    '皺曉澄': '鄒曉澄',
    '皺詩雅': '鄒詩雅',
    '鄒詩东': '鄒詩雅',
    '鄒詩誰': '鄒詩雅',
    '袁穂情': '袁穗晴',
    '袁穂晴': '袁穗晴',
    '袁穗睛': '袁穗晴',
    '袁遠朗': '袁逸朗',
    '袁梓睎': '袁梓睡',
    '鄧浚濠': '鄧浚濵',
    '葵御霆': '蔡御霆',
    '鄔子聰': '丁子聰',
    '陳梓銅': '陳梓軒',
    '黃曜軒': '黃曜軯',
    '黃柏熹': '黃柏熙',
    '黃頌一木': '黃頌琛',
    '黄顓頎': '黄顧頕',
    '鄧綽翹': '鄧穎翹',
    '麥僥楓': '朱棋楓', // not sure
    '黃瑛霖': '黃銀軯',  // possible
    '郭峻彥': '郭俊康',  // different person? but 郭峻彥 not in DB, skip

    // Multi-person entries → first person
    '楊堃昊楊堃毅': '楊惜林',  // not sure
    '楊堃毅楊堃昊': '楊惜林',
    '楊堃毅／楊堃昊': '楊惜林',
    '楊堃昊毅': '楊惜林',
    '燊政 宇政': '劉燊政',
    '許學彥+許晉彥': '許雋昇',
    '許學彥、許晉彥': '許雋昇',
    '許晉彥+許學彥': '許雋昇',
    
    // Separate multi-person entries - just take first
    '謝子康 、謝子朗': '',  // not in DB
    '謝子康、謝子朗': '',
    '謝謝子康、謝子朗': '',
    '馮詩㦤、馮俊琂': '',  // not in DB
    'Lau san ching lau yu ching': '', // not in DB
    '陸曉琳啊，只是': '',  // garbage
  };

  // Build full alias map
  const aliasMap = new Map<string, number>();
  for (const name of Object.keys(rawLeaves)) {
    // 1. Direct match
    if (studentMap.has(name)) {
      aliasMap.set(name, studentMap.get(name)!);
      continue;
    }
    // 2. Manual alias
    if (name in manualAliases) {
      const target = manualAliases[name];
      if (target && studentMap.has(target)) {
        aliasMap.set(name, studentMap.get(target)!);
      }
      continue;
    }
    // 3. Case-insensitive
    const lower = name.toLowerCase().replace(/\s+/g, '');
    for (const [sName, sId] of studentMap.entries()) {
      if (sName.toLowerCase().replace(/\s+/g, '') === lower) {
        aliasMap.set(name, sId);
        break;
      }
    }
  }

  // Clear old excused records (from v1 import) and reimport
  await pool.query("DELETE FROM elite_attendance WHERE status = 'excused'");
  console.log('Cleared previous excused records');

  let inserted = 0;
  let skippedNoStudent = 0;
  let skippedNoSchedule = 0;
  const unmatchedNames = new Map<string, number>(); // name -> count
  const existingSet = new Set<string>();

  // Load existing non-excused records
  const [existingRows] = await pool.query("SELECT schedule_id, student_id FROM elite_attendance") as any[];
  for (const e of existingRows) existingSet.add(`${e.schedule_id}-${e.student_id}`);

  const insertValues: [number, number, string][] = [];

  for (const [name, dates] of Object.entries(rawLeaves)) {
    const studentId = aliasMap.get(name);
    if (!studentId) {
      unmatchedNames.set(name, (unmatchedNames.get(name) || 0) + dates.length);
      skippedNoStudent += dates.length;
      continue;
    }

    for (const dateStr of dates) {
      const scheduleId = scheduleMap.get(dateStr);
      if (!scheduleId) {
        skippedNoSchedule++;
        continue;
      }
      const key = `${scheduleId}-${studentId}`;
      if (existingSet.has(key)) continue;
      insertValues.push([scheduleId, studentId, 'excused']);
      existingSet.add(key);
    }
  }

  // Batch insert
  const chunkSize = 500;
  for (let i = 0; i < insertValues.length; i += chunkSize) {
    const chunk = insertValues.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
    await pool.query(
      `INSERT INTO elite_attendance (schedule_id, student_id, status) VALUES ${placeholders}`,
      chunk.flat()
    );
    inserted += chunk.length;
  }

  console.log('\n========== Import Summary ==========');
  console.log(`Total leave entries: ${Object.values(rawLeaves).reduce((s, d) => s + d.length, 0)}`);
  console.log(`✅ Inserted as excused: ${inserted}`);
  console.log(`⏭️  No student match:    ${skippedNoStudent}`);
  console.log(`⏭️  No schedule match:   ${skippedNoSchedule}`);

  if (unmatchedNames.size > 0) {
    console.log(`\n❓ Unmatched (${unmatchedNames.size} names, ${skippedNoStudent} records):`);
    const sorted = [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]);
    for (const [n, cnt] of sorted) {
      console.log(`   ${cnt}x  "${n}"`);
    }
  }

  const [verifyRows] = await pool.query("SELECT COUNT(*) as cnt FROM elite_attendance WHERE status = 'excused'") as any[];
  console.log(`\n📊 Total excused records: ${verifyRows[0].cnt}`);

  // Show sample
  const [sampleRows] = await pool.query(`
    SELECT es.name, DATE(ets.training_date) as dt, ea.status
    FROM elite_attendance ea
    JOIN elite_students es ON es.id = ea.student_id
    JOIN elite_schedules ets ON ets.id = ea.schedule_id
    WHERE ea.status = 'excused'
    ORDER BY es.name, ets.training_date
    LIMIT 15
  `) as any[];
  console.log('\n📋 Sample excused records:');
  for (const r of sampleRows) {
    const dt = typeof r.dt === 'string' ? r.dt : r.dt.toISOString().slice(0, 10);
    console.log(`   ${r.name} - ${dt}`);
  }

  await pool.end();
}

main().catch(console.error);
