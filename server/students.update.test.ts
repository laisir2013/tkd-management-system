import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { students } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("students.update", () => {
  let testStudentId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 創建測試學生
    const result = await db.insert(students).values({
      name: "測試學生-Update",
      phone: "12345678",
      venue: "測試道場",
      scheduleDay: "星期一",
      scheduleTime: "4:00-5:00pm",
      feePerQuarter: "1800",
      status: "active",
    });

    // 查詢剛創建的學生 ID
    const insertedStudents = await db
      .select()
      .from(students)
      .where(eq(students.name, "測試學生-Update"))
      .limit(1);

    if (insertedStudents.length === 0) {
      throw new Error("Failed to create test student");
    }

    testStudentId = insertedStudents[0].id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // 清理測試學生
    await db.delete(students).where(eq(students.id, testStudentId));
  });

  it("should update student schedule day", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test", role: "admin", name: "Test Admin" },
    });

    // 更新學生的上課日
    const result = await caller.students.update({
      id: testStudentId,
      scheduleDay: "星期五",
    });

    expect(result.success).toBe(true);

    // 驗證更新是否成功
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const updatedStudent = await db
      .select()
      .from(students)
      .where(eq(students.id, testStudentId))
      .limit(1);

    expect(updatedStudent.length).toBe(1);
    expect(updatedStudent[0].scheduleDay).toBe("星期五");
    expect(updatedStudent[0].name).toBe("測試學生-Update"); // 其他欄位不變
  });

  it("should update multiple fields at once", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test", role: "admin", name: "Test Admin" },
    });

    // 同時更新多個欄位
    const result = await caller.students.update({
      id: testStudentId,
      scheduleDay: "星期三",
      scheduleTime: "6:00-7:00pm",
      venue: "新道場",
    });

    expect(result.success).toBe(true);

    // 驗證更新是否成功
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const updatedStudent = await db
      .select()
      .from(students)
      .where(eq(students.id, testStudentId))
      .limit(1);

    expect(updatedStudent.length).toBe(1);
    expect(updatedStudent[0].scheduleDay).toBe("星期三");
    expect(updatedStudent[0].scheduleTime).toBe("6:00-7:00pm");
    expect(updatedStudent[0].venue).toBe("新道場");
  });

  it("should reject update from non-admin user", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test", role: "user", name: "Test User" },
    });

    await expect(
      caller.students.update({
        id: testStudentId,
        scheduleDay: "星期六",
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
