import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * BACKUP OF ORIGINAL SCHEMA - DO NOT MODIFY
 * Created: 2026-02-10
 */

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Students table - stores student information
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  birthDate: timestamp("birthDate"),
  phone: varchar("phone", { length: 50 }).notNull(),
  venue: varchar("venue", { length: 100 }).notNull(),
  scheduleDay: varchar("scheduleDay", { length: 50 }),
  scheduleTime: varchar("scheduleTime", { length: 50 }),
  feePerQuarter: decimal("feePerQuarter", { precision: 10, scale: 2 }).notNull(),
  beltLevel: varchar("beltLevel", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

/**
 * Payment records table - stores payment information
 */
export const paymentRecords = mysqlTable("paymentRecords", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  paymentPeriod: mysqlEnum("paymentPeriod", ["Q1", "Q2", "Q3", "Q4", "CUSTOM"]).notNull(),
  customMonths: json("customMonths").$type<string[]>(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  receiptUrl: text("receiptUrl"),
  receiptKey: text("receiptKey"),
  receiptTransferDate: timestamp("receiptTransferDate"),
  paymentDate: timestamp("paymentDate").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed"]).default("confirmed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;
