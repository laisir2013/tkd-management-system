import mysql from 'mysql2/promise';
import fs from 'fs';

const LEAVE_JSON = './elite_leaves.json';

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'tkd_user',
    password: 'tkd_pass_2026',
    database: 'taekwondo',
    charset: 'UTF8MB4_GENERAL_CI',
  });

  // 1. Load leave data
  const rawLeaves: Record<string, string[]> = JSON.parse(fs.readFileSync(LEAVE_JSON, 'utf-8'));

  // 2. Load all elite students
  const [studentRows] = await pool.query('SELECT id, name FROM elite_students') as any[];
  const studentMap = new Map<string, number>();
  const studentNameLower = new Map<string, number>();
  for (const s of studentRows) {
    studentMap.set(s.name, s.id);
    studentNameLower.set(s.name.toLowerCase().replace(/\s+/g, ''), s.id);
  }
  console.log(`Loaded ${studentRows.length} elite students`);

  // 3. Load all schedules (map date string to schedule id)
  const [scheduleRows] = await pool.query('SELECT id, DATE(training_date) as dt FROM elite_schedules') as any[];
  const scheduleMap = new Map<string, number>();
  for (const s of scheduleRows) {
    // dt is a Date object from mysql2, format it as YYYY-MM-DD
    const dateStr = typeof s.dt === 'string' ? s.dt : s.dt.toISOString().slice(0, 10);
    scheduleMap.set(dateStr, s.id);
  }
  console.log(`Loaded ${scheduleRows.length} schedules`);

  // 4. Load existing attendance to avoid duplicates
  const [existingRows] = await pool.query('SELECT schedule_id, student_id, status FROM elite_attendance') as any[];
  const existingSet = new Set<string>();
  for (const e of existingRows) {
    existingSet.add(`${e.schedule_id}-${e.student_id}`);
  }
  console.log(`Existing attendance records: ${existingRows.length}`);

  // 5. Build name alias map: multiple names in JSON may refer to same student
  // e.g., "Luna Petralia", "Luna PETRALIA", "Luna" all -> student "Luna Petralia" (id=30)
  const nameAliases = buildNameAliases(rawLeaves, studentMap, studentNameLower);

  // 6. Process leaves
  let inserted = 0;
  let skippedNoStudent = 0;
  let skippedNoSchedule = 0;
  let skippedExisting = 0;
  let skippedAlreadyPresent = 0;
  const unmatchedNames = new Set<string>();

  const insertValues: [number, number, string][] = [];

  for (const [name, dates] of Object.entries(rawLeaves)) {
    const studentId = nameAliases.get(name);
    if (!studentId) {
      unmatchedNames.add(name);
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
      if (existingSet.has(key)) {
        // Check if already present -> don't overwrite
        const existing = existingRows.find((e: any) => e.schedule_id === scheduleId && e.student_id === studentId);
        if (existing && existing.status === 'present') {
          skippedAlreadyPresent++;
        } else {
          skippedExisting++;
        }
        continue;
      }

      insertValues.push([scheduleId, studentId, 'excused']);
      existingSet.add(key); // prevent duplicates within same import
    }
  }

  // Batch insert
  if (insertValues.length > 0) {
    // Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < insertValues.length; i += chunkSize) {
      const chunk = insertValues.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
      const flatValues = chunk.flat();
      await pool.query(
        `INSERT INTO elite_attendance (schedule_id, student_id, status) VALUES ${placeholders}`,
        flatValues
      );
      inserted += chunk.length;
      console.log(`  Inserted ${Math.min(i + chunkSize, insertValues.length)}/${insertValues.length} ...`);
    }
  }

  console.log('\n========== Import Summary ==========');
  console.log(`Total leave entries in JSON: ${Object.values(rawLeaves).reduce((s, d) => s + d.length, 0)}`);
  console.log(`✅ Inserted as excused:     ${inserted}`);
  console.log(`⏭️  Skipped (no student):    ${skippedNoStudent}`);
  console.log(`⏭️  Skipped (no schedule):   ${skippedNoSchedule}`);
  console.log(`⏭️  Skipped (already exists): ${skippedExisting}`);
  console.log(`⏭️  Skipped (already present): ${skippedAlreadyPresent}`);

  if (unmatchedNames.size > 0) {
    console.log(`\n❓ Unmatched names (${unmatchedNames.size}):`);
    for (const n of [...unmatchedNames].sort()) {
      console.log(`   - "${n}"`);
    }
  }

  // Verify
  const [verifyRows] = await pool.query(
    "SELECT COUNT(*) as cnt FROM elite_attendance WHERE status = 'excused'"
  ) as any[];
  console.log(`\n📊 Total 'excused' records in DB: ${verifyRows[0].cnt}`);

  await pool.end();
}

function buildNameAliases(
  rawLeaves: Record<string, string[]>,
  studentMap: Map<string, number>,
  studentNameLower: Map<string, number>
): Map<string, number> {
  const aliases = new Map<string, number>();

  // Known manual mappings for common variations
  const manualMap: Record<string, string> = {
    // English variations
    'Luna': 'Luna Petralia',
    'Luna PETRALIA': 'Luna Petralia',
    'Luna Petralia': 'Luna Petralia',
    'hon ho nam': '韓灝南',
    'Lam nok tin': '林諾天',
    'Lam NokTin': '林諾天',
    'LamNokTin': '林諾天',
    'Enzo': 'Enzo',
    'Heiyu': '黃曜軯', // possible match
    // Andre Youchen Yang variations
    'Andre Youchen Yang': '楊猷宸',
    'Andre Youchen Yang 楊猷宸': '楊猷宸',
    'Andre Youchen Yang楊猷宸': '楊猷宸',
  };

  for (const name of Object.keys(rawLeaves)) {
    // 1. Direct exact match
    if (studentMap.has(name)) {
      aliases.set(name, studentMap.get(name)!);
      continue;
    }

    // 2. Manual mapping
    if (manualMap[name] && studentMap.has(manualMap[name])) {
      aliases.set(name, studentMap.get(manualMap[name])!);
      continue;
    }

    // 3. Case-insensitive match
    const lower = name.toLowerCase().replace(/\s+/g, '');
    if (studentNameLower.has(lower)) {
      aliases.set(name, studentNameLower.get(lower)!);
      continue;
    }

    // 4. Try to find by partial Chinese name match
    const chineseChars = name.replace(/[^\u4e00-\u9fff]/g, '');
    if (chineseChars.length >= 2) {
      for (const [sName, sId] of studentMap.entries()) {
        if (sName.includes(chineseChars) || chineseChars.includes(sName)) {
          aliases.set(name, sId);
          break;
        }
      }
    }
  }

  return aliases;
}

main().catch(console.error);
