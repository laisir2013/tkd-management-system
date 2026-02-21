import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 刪除星期一班別中實際是星期二的記錄
const result1 = await connection.query(`
  DELETE FROM training_schedules 
  WHERE schedule_day = '星期一' 
    AND DAYOFWEEK(training_date) = 3
`);
console.log('刪除星期一班別中的星期二記錄:', result1[0].affectedRows, '筆');

// 刪除星期三班別中實際是星期四的記錄  
const result2 = await connection.query(`
  DELETE FROM training_schedules 
  WHERE schedule_day = '星期三' 
    AND DAYOFWEEK(training_date) = 5
`);
console.log('刪除星期三班別中的星期四記錄:', result2[0].affectedRows, '筆');

// 刪除星期五班別中實際是星期六的記錄
const result3 = await connection.query(`
  DELETE FROM training_schedules 
  WHERE schedule_day = '星期五' 
    AND DAYOFWEEK(training_date) = 7
`);
console.log('刪除星期五班別中的星期六記錄:', result3[0].affectedRows, '筆');

// 刪除星期六班別中實際是星期日的記錄
const result4 = await connection.query(`
  DELETE FROM training_schedules 
  WHERE schedule_day = '星期六' 
    AND DAYOFWEEK(training_date) = 1
`);
console.log('刪除星期六班別中的星期日記錄:', result4[0].affectedRows, '筆');

await connection.end();
console.log('✅ 清理完成');
