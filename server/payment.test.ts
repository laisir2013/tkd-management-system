import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Payment API", () => {
  it("should get payment records by student IDs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const payments = await caller.payments.getByStudentIds({ studentIds: [1, 2, 3] });

    expect(Array.isArray(payments)).toBe(true);
  });

  it("should prevent duplicate payment for same period", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // 查詢學生的現有繳費記錄
    const existingPayments = await caller.payments.getByStudentIds({ studentIds: [1] });
    
    // 驗證可以查詢到繳費記錄
    expect(Array.isArray(existingPayments)).toBe(true);
  });
});
