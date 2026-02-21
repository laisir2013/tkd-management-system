import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminCtx = {
  user: { openId: "test-admin", name: "Admin", role: "admin" },
} as TrpcContext;

const coachCtx = {
  user: { openId: "test-coach", name: "Coach", role: "coach" },
} as TrpcContext;

const userCtx = {
  user: { openId: "test-user", name: "User", role: "user" },
} as TrpcContext;

describe("Cancel/Activate Training Schedule", () => {
  it("admin should be able to cancel a training schedule", async () => {
    const caller = appRouter.createCaller(adminCtx);

    // 先查詢現有的訓練日期
    const schedules = await caller.attendance.getTrainingSchedules({
      year: 2026,
      month: 3,
    });

    expect(schedules.length).toBeGreaterThan(0);

    // 取得第一個 active 的 schedule
    const activeSchedule = schedules.find((s) => s.status === "active");
    expect(activeSchedule).toBeDefined();

    // 取消該課堂
    const result = await caller.attendance.cancelTrainingSchedule({
      id: activeSchedule!.id,
    });
    expect(result.success).toBe(true);

    // 驗證狀態已改為 cancelled
    const updatedSchedules = await caller.attendance.getTrainingSchedules({
      year: 2026,
      month: 3,
    });
    const cancelledSchedule = updatedSchedules.find(
      (s) => s.id === activeSchedule!.id
    );
    expect(cancelledSchedule).toBeDefined();
    expect(cancelledSchedule!.status).toBe("cancelled");

    // 恢復該課堂
    const restoreResult = await caller.attendance.activateTrainingSchedule({
      id: activeSchedule!.id,
    });
    expect(restoreResult.success).toBe(true);

    // 驗證狀態已恢復為 active
    const restoredSchedules = await caller.attendance.getTrainingSchedules({
      year: 2026,
      month: 3,
    });
    const restoredSchedule = restoredSchedules.find(
      (s) => s.id === activeSchedule!.id
    );
    expect(restoredSchedule).toBeDefined();
    expect(restoredSchedule!.status).toBe("active");
  });

  it("non-admin should not be able to cancel a training schedule", async () => {
    const caller = appRouter.createCaller(userCtx);

    await expect(
      caller.attendance.cancelTrainingSchedule({ id: 1 })
    ).rejects.toThrow();
  });

  it("should return all statuses when no status filter is provided", async () => {
    const caller = appRouter.createCaller(adminCtx);

    // 先取消一個 schedule
    const schedules = await caller.attendance.getTrainingSchedules({
      year: 2026,
      month: 3,
    });
    const activeSchedule = schedules.find((s) => s.status === "active");
    expect(activeSchedule).toBeDefined();

    await caller.attendance.cancelTrainingSchedule({ id: activeSchedule!.id });

    // 不傳 status 篩選，應該返回所有狀態
    const allSchedules = await caller.attendance.getTrainingSchedules({
      year: 2026,
      month: 3,
    });

    const hasActive = allSchedules.some((s) => s.status === "active");
    const hasCancelled = allSchedules.some((s) => s.status === "cancelled");
    expect(hasActive).toBe(true);
    expect(hasCancelled).toBe(true);

    // 清理：恢復取消的 schedule
    await caller.attendance.activateTrainingSchedule({
      id: activeSchedule!.id,
    });
  });
});
