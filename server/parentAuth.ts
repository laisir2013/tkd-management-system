/**
 * Parent App JWT Authentication Module
 * 
 * Provides JWT token generation, verification, and Express middleware
 * for the parent-facing REST API (/api/v1/parent/*).
 * 
 * Token payload: { phone, role: 'parent', iat, exp }
 * Token expiry: 30 days
 * Storage: Client stores in Authorization: Bearer <token>
 */
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "./_core/env";
import { getStudentsByPhone, getEliteStudentsByPhone } from "./db";

// ── Constants ────────────────────────────────────────────────────────────
const JWT_SECRET = ENV.cookieSecret || "parent-app-default-secret-change-me";
const TOKEN_EXPIRY = "30d"; // 30 days

// ── Types ────────────────────────────────────────────────────────────────
export interface ParentTokenPayload {
  phone: string;
  role: "parent";
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  parentPhone?: string;
}

// ── Phone verification cache ─────────────────────────────────────────────
// Simple in-memory cache: phone → { valid: boolean, checkedAt: timestamp }
// Avoids hitting DB on every request. TTL = 5 minutes.
const phoneCache = new Map<string, { valid: boolean; checkedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function isPhoneValid(phone: string): Promise<boolean> {
  const cached = phoneCache.get(phone);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.valid;
  }

  // Check if phone exists in students or elite students
  const [regular, elite] = await Promise.all([
    getStudentsByPhone(phone),
    getEliteStudentsByPhone(phone),
  ]);
  const valid = (regular && regular.length > 0) || (elite && elite.length > 0);
  phoneCache.set(phone, { valid, checkedAt: Date.now() });
  return valid;
}

// ── Token helpers ────────────────────────────────────────────────────────
export function generateToken(phone: string): string {
  const payload: ParentTokenPayload = { phone, role: "parent" };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): ParentTokenPayload {
  return jwt.verify(token, JWT_SECRET) as ParentTokenPayload;
}

// ── Express middleware ───────────────────────────────────────────────────
/**
 * Auth middleware for parent REST API.
 * Extracts Bearer token, verifies JWT, validates phone against DB (cached),
 * and attaches `req.parentPhone` for downstream handlers.
 * 
 * Error codes returned to client:
 *   TOKEN_MISSING   – No Authorization header
 *   TOKEN_EXPIRED   – jwt expired
 *   INVALID_TOKEN   – jwt malformed / verification failed
 *   ACCOUNT_INVALID – phone no longer exists in DB
 */
export async function parentAuthMiddleware(
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

    if (payload.role !== "parent") {
      res.status(403).json({ error: "無效的令牌角色", code: "INVALID_TOKEN" });
      return;
    }

    // Verify phone still exists (cached)
    const valid = await isPhoneValid(payload.phone);
    if (!valid) {
      res.status(401).json({ error: "帳號已無效", code: "ACCOUNT_INVALID" });
      return;
    }

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
