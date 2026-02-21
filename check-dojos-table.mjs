import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { dojos } from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("查詢 dojos 表資料:\n");

try {
  const allDojos = await db.select().from(dojos);
  console.log(`✅ 查詢成功! 共 ${allDojos.length} 筆道場資料\n`);
  
  if (allDojos.length > 0) {
    console.log("第一筆資料:");
    console.log(JSON.stringify(allDojos[0], null, 2));
  }
} catch (error) {
  console.log("❌ 查詢失敗:");
  console.log(error.message);
  console.log("\n嘗試查詢表結構:");
  
  try {
    const [rows] = await connection.query("DESCRIBE dojos");
    console.log("\ndojos 表結構:");
    console.table(rows);
  } catch (descError) {
    console.log("無法查詢表結構:", descError.message);
  }
}

await connection.end();
