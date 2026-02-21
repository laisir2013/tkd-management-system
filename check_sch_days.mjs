import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(`SELECT DISTINCT schedule_day FROM training_schedules ORDER BY schedule_day`);
console.log('schedule_day 值:', JSON.stringify(rows, null, 2));
await conn.end();
