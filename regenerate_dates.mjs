import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { generateTrainingSchedules } from './server/db.ts';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('開始重新生成 2026年2月訓練日期...');

const count = await generateTrainingSchedules(
  new Date('2026-02-01'),
  new Date('2026-02-28')
);

console.log(`✅ 成功生成 ${count} 筆訓練日期記錄`);

await connection.end();
