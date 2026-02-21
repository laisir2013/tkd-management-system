import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getStudentsByPhone, bulkInsertStudents } from "./db";

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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

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

describe("Students API", () => {
  it("should get students by phone number", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const students = await caller.students.getByPhone({ phone: "90971420" });

    expect(Array.isArray(students)).toBe(true);
  });

  it("should allow admin to get all students", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const students = await caller.students.getAll();

    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBeGreaterThan(0);
  });

  it("should reject non-admin from getting all students", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.students.getAll()).rejects.toThrow();
  });
});
