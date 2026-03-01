/**
 * Unified App JWT Authentication Module
 * 
 * Supports ALL roles: parent, coach, admin
 * Token payload: { phone, role, userId?, iat, exp }
 * Token expiry: 30 days
 */
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "./_core/env";

// ── Constants ────────────────────────────────────────────────────────────
const JWT_SECRET = ENV.cookieSecret || "app-default-secret-change-me";
const TOKEN_EXPIRY = "30d";

// ── Types ────────────────────────────────────────────────────────────────
export type AppRole = "parent" | "coach" | "admin";

export interface AppTokenPayload {
  phone: string;
  role: AppRole;
  userId?: number;  // users.id for coach/admin
  coachName?: string; // for coach
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  parentPhone?: string; // backward compat
  userPhone?: string;
  userRole?: AppRole;
  userId?: number;
  coachName?: string;
}

// ── Token helpers ────────────────────────────────────────────────────────
export function generateToken(phone: string, role: AppRole, extra?: { userId?: number; coachName?: string }): string {
  const payload: AppTokenPayload = { phone, role, ...extra };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AppTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AppTokenPayload;
}

// ── Express middleware (all roles) ───────────────────────────────────────
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "未提供認證令牌", code: "TOKEN_MISSING" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.userPhone = payload.phone;
    req.userRole = payload.role;
    req.userId = payload.userId;
    req.coachName = payload.coachName;
    // backward compat
    req.parentPhone = payload.phone;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ error: "令牌已過期，請重新登入", code: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "無效的認證令牌", code: "INVALID_TOKEN" });
    }
  }
}

// ── Role guard helpers ───────────────────────────────────────────────────
export function requireRole(...roles: AppRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "權限不足", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}

// Keep old name for backward compat
export const parentAuthMiddleware = authMiddleware;
