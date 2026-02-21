import Database from "better-sqlite3";

const db = new Database("./data.db");

const dojos = db.prepare("SELECT * FROM dojos ORDER BY name, schedule_day, schedule_time").all();

console.log(`總共 ${dojos.length} 個道場時段:\n`);

dojos.forEach((dojo, index) => {
  console.log(`${index + 1}. ${dojo.name} - ${dojo.schedule_day} ${dojo.schedule_time} - 教練: ${dojo.coach_name || '未分配'}`);
});

db.close();
