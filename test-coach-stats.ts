import { getCoachStatistics, getAllDojos, getAllStudents } from './server/db';

async function test() {
  console.log('=== Testing Coach Statistics ===\n');
  
  const dojos = await getAllDojos();
  console.log(`Total dojos: ${dojos.length}`);
  console.log('Sample dojo:', dojos[0]);
  console.log('\n');
  
  const students = await getAllStudents();
  console.log(`Total students: ${students.length}`);
  console.log('Sample student:', students[0]);
  console.log('\n');
  
  const stats = await getCoachStatistics();
  console.log('Coach Statistics:');
  stats.forEach(stat => {
    console.log(`- ${stat.coachName}: ${stat.studentCount} students, $${stat.totalFee.toFixed(2)}`);
  });
  
  // 測試特定教練
  const laiStats = await getCoachStatistics('賴政堡');
  console.log('\n賴政堡教練統計:');
  console.log(laiStats);
  
  // 手動驗證匹配邏輯
  console.log('\n=== Manual Verification ===');
  const laiDojos = dojos.filter(d => d.coachName === '賴政堡');
  console.log(`賴政堡的道場數量: ${laiDojos.length}`);
  laiDojos.forEach(dojo => {
    const matchedStudents = students.filter(s =>
      s.venue === dojo.name &&
      s.scheduleDay === dojo.scheduleDay &&
      s.scheduleTime === dojo.scheduleTime
    );
    console.log(`道場: ${dojo.name}, ${dojo.scheduleDay}, ${dojo.scheduleTime}`);
    console.log(`  匹配學生數: ${matchedStudents.length}`);
    if (matchedStudents.length > 0) {
      const totalFee = matchedStudents.reduce((sum, s) => sum + parseFloat(s.feePerQuarter), 0);
      console.log(`  總學費: $${totalFee.toFixed(2)}`);
    }
  });
}

test().catch(console.error);
