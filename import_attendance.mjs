import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('DATABASE_URL not found in env');
    process.exit(1);
  }
  
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(dbUrl + '&connectTimeout=30000');
  console.log('Connected!');
  
  // Read all mega batch files
  const batchDir = '/home/ubuntu';
  const batchFiles = fs.readdirSync(batchDir)
    .filter(f => f.startsWith('mega_batch_') && f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });
  
  console.log(`Found ${batchFiles.length} batch files`);
  
  let totalInserted = 0;
  for (const file of batchFiles) {
    const sql = fs.readFileSync(path.join(batchDir, file), 'utf-8');
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const stmt of statements) {
      try {
        const [result] = await connection.execute(stmt.trim() + ';');
        totalInserted += result.affectedRows;
      } catch (err) {
        console.error(`Error in ${file}: ${err.message}`);
        console.error(`Statement: ${stmt.trim().substring(0, 200)}...`);
      }
    }
    console.log(`Completed ${file} - Total inserted: ${totalInserted}`);
  }
  
  // Verify
  const [rows] = await connection.execute('SELECT COUNT(*) as total FROM elite_attendance');
  console.log(`\nVerification: ${rows[0].total} attendance records in database`);
  
  await connection.end();
  console.log('Done!');
}

main().catch(console.error);
