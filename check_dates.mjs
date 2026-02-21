import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const result = await connection.query(`
  SELECT 
    DATE_FORMAT(training_date, '%Y-%m') as month,
    COUNT(*) as count
  FROM training_schedules
  GROUP BY DATE_FORMAT(training_date, '%Y-%m')
  ORDER BY month
`);

console.log("訓練日期按月統計:");
console.log(JSON.stringify(result[0], null, 2));

await connection.end();
