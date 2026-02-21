import mysql from 'mysql2/promise';
import fs from 'fs';

// 讀取環境變數
const DATABASE_URL = process.env.DATABASE_URL;

// 讀取 SQL 檔案
const sql = fs.readFileSync('/home/ubuntu/import_all_students.sql', 'utf-8');

// 分割成單獨的語句
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

console.log(`準備執行 ${statements.length} 條 SQL 語句...`);

// 建立資料庫連線
const connection = await mysql.createConnection(DATABASE_URL);

let success = 0;
let failed = 0;

for (let i = 0; i < statements.length; i++) {
  try {
    await connection.execute(statements[i]);
    success++;
    if ((i + 1) % 10 === 0) {
      console.log(`已執行 ${i + 1}/${statements.length} 條語句...`);
    }
  } catch (error) {
    console.error(`語句 ${i + 1} 執行失敗:`, error.message);
    failed++;
  }
}

await connection.end();

console.log(`\n匯入完成!`);
console.log(`  成功: ${success} 條`);
console.log(`  失敗: ${failed} 條`);
