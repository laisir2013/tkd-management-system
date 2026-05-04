import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { broadcastMutation } from "../ws";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/**
 * WebSocket 自動廣播 middleware
 * 攔截所有 mutation，成功後自動廣播 invalidation 事件給所有 WebSocket 客戶端。
 * path 格式: "payments.confirm" → router="payments", procedure="confirm"
 */
const wsBroadcast = t.middleware(async opts => {
  const result = await opts.next();

  // 只在 mutation 成功時廣播（query 不廣播）
  if (opts.type === "mutation" && result.ok) {
    const path = opts.path; // e.g. "payments.confirm", "students.create"
    const dotIdx = path.indexOf(".");
    const routerName = dotIdx > 0 ? path.substring(0, dotIdx) : path;
    const procedureName = dotIdx > 0 ? path.substring(dotIdx + 1) : "";
    // 異步廣播，不阻塞 mutation 回應
    try {
      broadcastMutation(routerName, procedureName);
    } catch {
      // broadcast failure should never break a mutation
    }
  }

  return result;
});

// 所有 procedure 都自動加上 wsBroadcast middleware
export const publicProcedure = t.procedure.use(wsBroadcast);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(wsBroadcast).use(requireUser);

export const adminProcedure = t.procedure.use(wsBroadcast).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
