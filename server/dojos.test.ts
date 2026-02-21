import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("dojos router", () => {
  it("allows admin to query all dojos", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dojos.getAll();

    expect(Array.isArray(result)).toBe(true);
  });

  it("prevents non-admin from querying dojos", async () => {
    const ctx = createAdminContext();
    ctx.user!.role = "user";
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dojos.getAll()).rejects.toThrow("FORBIDDEN");
  });
});
