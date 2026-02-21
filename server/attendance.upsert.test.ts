import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";
import { students, attendanceRecords, courses } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("attendance.upsertAttendance", () => {
  let testStudentId: number;
  let testCourseId: number;
  let testDate: Date;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 創建測試課程
    await db.insert(courses).values({
      name: "測試課程-Upsert",
      dayOfWeek: "monday",
      startTime: "18:00",
      endTime: "19:00",
    });

    // 查詢剛創建的課程
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.name, "測試課程-Upsert"))
      .limit(1);

    testCourseId = course.id;

    // 創建測試學生
    await db.insert(students).values({
      name: "測試學生-Upsert",
      gender: "male",
      birthDate: new Date("2010-01-01"),
      phone: "99999999",
      venue: "測試道場",
      scheduleDay: "Monday",
      scheduleTime: "18:00-19:00",
      feePerQuarter: "1000.00",
    });

    // 查詢剛創建的學生
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.phone, "99999999"))
      .limit(1);

    testStudentId = student.id;
    testDate = new Date("2026-02-17");
  });

  it("should create new attendance record when none exists", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test-admin", name: "Admin", role: "admin" },
    } as TrpcContext);

    const result = await caller.attendance.upsertAttendance({
      studentId: testStudentId,
      attendanceDate: testDate,
      status: "present",
      courseId: testCourseId,
    });

    expect(result.success).toBe(true);

    // 驗證記錄已創建
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.studentId, testStudentId),
          eq(attendanceRecords.attendanceDate, testDate)
        )
      );

    expect(records.length).toBe(1);
    expect(records[0].status).toBe("present");
  });

  it("should update existing attendance record", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test-admin", name: "Admin", role: "admin" },
    } as TrpcContext);

    // 第一次呼叫 - 創建記錄
    await caller.attendance.upsertAttendance({
      studentId: testStudentId,
      attendanceDate: testDate,
      status: "present",
      courseId: testCourseId,
    });

    // 第二次呼叫 - 更新記錄
    const result = await caller.attendance.upsertAttendance({
      studentId: testStudentId,
      attendanceDate: testDate,
      status: "absent",
      notes: "請假",
      courseId: testCourseId,
    });

    expect(result.success).toBe(true);

    // 驗證記錄已更新
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.studentId, testStudentId),
          eq(attendanceRecords.attendanceDate, testDate)
        )
      );

    expect(records.length).toBe(1); // 應該只有一筆記錄
    expect(records[0].status).toBe("absent");
    expect(records[0].notes).toBe("請假");
  });

  it("should reject non-admin/non-coach users", async () => {
    const caller = appRouter.createCaller({
      user: { openId: "test-user", name: "User", role: "user" },
    } as TrpcContext);

    await expect(
      caller.attendance.upsertAttendance({
        studentId: testStudentId,
        attendanceDate: testDate,
        status: "present",
        courseId: testCourseId,
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
