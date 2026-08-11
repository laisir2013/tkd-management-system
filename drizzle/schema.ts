import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean, date, tinyint, datetime } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }), // 電話號碼，用於登入識別
  password: varchar("password", { length: 255 }), // 密碼(加密後),預設為電話號碼
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "coach", "staff", "examiner"]).default("user").notNull(),
  roles: json("roles").$type<string[]>(), // 多角色 JSON 陣列，如 ["coach", "examiner"]
  coachName: varchar("coach_name", { length: 100 }), // 教練姓名，用於匹配 dojos 表中的 coachName
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 帶級表 - 跆拳道段位級別
 */
export const beltLevels = mysqlTable("belt_levels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(), // 例如：白帶、黃帶、綠帶等
  color: varchar("color", { length: 20 }).notNull(), // 顏色代碼
  order: int("order").notNull(), // 排序順序，數字越大級別越高
  minimumTrainingDays: int("minimum_training_days").notNull().default(90), // 最少訓練天數
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BeltLevel = typeof beltLevels.$inferSelect;
export type InsertBeltLevel = typeof beltLevels.$inferInsert;

/**
 * 道場表
 */
export const dojos = mysqlTable("dojos", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  scheduleDay: varchar("schedule_day", { length: 100 }),
  scheduleTime: varchar("schedule_time", { length: 100 }),
  coachName: varchar("coach_name", { length: 100 }),
  color: varchar("color", { length: 50 }).default("#3b82f6"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Dojo = typeof dojos.$inferSelect;
export type InsertDojo = typeof dojos.$inferInsert;

/**
 * 教練表
 */
export const coaches = mysqlTable("coaches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  beltLevelId: int("belt_level_id").references(() => beltLevels.id),
  baseSalary: int("base_salary").notNull().default(0), // 基本薪資（以分為單位）
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  joinDate: timestamp("join_date").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Coach = typeof coaches.$inferSelect;
export type InsertCoach = typeof coaches.$inferInsert;

/**
 * Students table - stores student information
 * 擴展版本:保留原有欄位,新增完整學生管理所需欄位
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  // 原有欄位
  name: varchar("name", { length: 100 }).notNull(),
  birthDate: date("birthDate"), // 保留舊欄位名稱以相容現有資料
  phone: varchar("phone", { length: 50 }).notNull(),
  password: varchar("password", { length: 255 }), // 密碼(加密後),預設為電話號碼
  venue: varchar("venue", { length: 100 }).notNull(), // 保留舊欄位,將來對應到 dojoId
  scheduleDay: varchar("scheduleDay", { length: 50 }),
  scheduleTime: varchar("scheduleTime", { length: 50 }),
  feePerQuarter: decimal("feePerQuarter", { precision: 10, scale: 2 }).notNull(),
  beltLevel: varchar("beltLevel", { length: 50 }), // 保留舊欄位,將來對應到 currentBeltLevelId
  // 新增欄位
  studentNumber: varchar("student_number", { length: 50 }).unique(), // 學號(可選,逐步填入)
  gender: mysqlEnum("gender", ["male", "female", "other"]), // 性別(可選)
  email: varchar("email", { length: 320 }),
  address: text("address"),
  emergencyContact: varchar("emergency_contact", { length: 100 }),
  emergencyPhone: varchar("emergency_phone", { length: 20 }),
  dojoId: int("dojo_id").references(() => dojos.id), // 所屬道場(可選,將來取代 venue)
  coach: varchar("coach", { length: 100 }).default('賴政堡教練'), // 負責教練名稱
  coachId: int("coach_id").references(() => coaches.id), // 所屬教練(舊欄位)
  currentBeltLevelId: int("current_belt_level_id").references(() => beltLevels.id), // 當前帶級(可選,將來取代 beltLevel)
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  joinDate: timestamp("join_date"), // 加入日期
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

/**
 * 學生帶級歷史表
 */
export const studentBeltHistory = mysqlTable("student_belt_history", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull().references(() => students.id),
  fromBeltLevelId: int("from_belt_level_id").references(() => beltLevels.id),
  toBeltLevelId: int("to_belt_level_id").notNull().references(() => beltLevels.id),
  promotionDate: timestamp("promotion_date").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentBeltHistory = typeof studentBeltHistory.$inferSelect;
export type InsertStudentBeltHistory = typeof studentBeltHistory.$inferInsert;

/**
 * Payment records table - stores payment information
 * 保持不變,確保現有學費功能正常運作
 */
export const paymentRecords = mysqlTable("paymentRecords", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  year: int("year").notNull().default(2026), // 繳費年份，支援多年紀錄
  paymentPeriod: mysqlEnum("paymentPeriod", ["Q1", "Q2", "Q3", "Q4", "CUSTOM", "MONTHLY"]).notNull(),
  customMonths: json("customMonths").$type<string[]>(),
  paymentMonth: int("paymentMonth"), // 單月繳費時的月份 (1-12)，季繳時為 null
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  classCount: int("classCount"), // 精英班堂數(每次繳費購買的堂數,恆常班為 null)
  receiptUrl: text("receiptUrl"),
  receiptKey: text("receiptKey"),
  receiptTransferDate: timestamp("receiptTransferDate"),
  bank: varchar("bank", { length: 100 }), // 付款銀行（OCR識別或手動填入）
  receivingBank: varchar("receivingBank", { length: 100 }), // 收款銀行（入數到哪間銀行，用於對帳）
  paymentDate: timestamp("paymentDate").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed"]).default("confirmed").notNull(),
  confirmedBy: mysqlEnum("confirmedBy", ["parent_upload", "admin_approved", "coach_approved"]).default("admin_approved"),
  // 收據審查欄位
  reviewStatus: mysqlEnum("review_status", ["normal", "pending_review", "approved", "rejected"]).default("normal").notNull(),
  reviewReason: varchar("review_reason", { length: 500 }),
  reviewMatchType: varchar("review_match_type", { length: 50 }),
  reviewMatchPaymentId: int("review_match_payment_id"),
  reviewedBy: varchar("reviewed_by", { length: 50 }),
  reviewedAt: timestamp("reviewed_at"),
  notes: varchar("notes", { length: 500 }), // 備註（如請假扣減明細）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;

/**
 * 學生請假月份表 — 記錄恆常班學生某年某月請假（該月免繳，不影響季度已繳判斷）
 */
export const studentLeaveMonths = mysqlTable("student_leave_months", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull(),
  year: int("year").notNull().default(2026),
  month: int("month").notNull(), // 1-12
  leaveClasses: int("leave_classes").notNull().default(0), // 0=整月請假, 1-4=請假堂數
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentLeaveMonth = typeof studentLeaveMonths.$inferSelect;
export type InsertStudentLeaveMonth = typeof studentLeaveMonths.$inferInsert;

/**
 * 新生報名表 — 公開報名表提交的資料（待管理員審核後轉為正式學生）
 */
export const registrations = mysqlTable("registrations", {
  id: int("id").autoincrement().primaryKey(),
  // 學生資料
  studentName: varchar("student_name", { length: 100 }).notNull(),
  studentGender: mysqlEnum("student_gender", ["male", "female"]),
  studentBirthDate: date("student_birth_date"),
  // 家長/監護人
  parentName: varchar("parent_name", { length: 100 }).notNull(),
  parentPhone: varchar("parent_phone", { length: 50 }).notNull(),
  parentPhone2: varchar("parent_phone2", { length: 50 }), // 第二聯絡電話
  parentEmail: varchar("parent_email", { length: 320 }),
  relationship: varchar("relationship", { length: 50 }), // 與學生的關係：父/母/監護人
  // 道場選擇
  preferredDojo: varchar("preferred_dojo", { length: 200 }), // 首選道場名稱
  preferredSchedule: varchar("preferred_schedule", { length: 200 }), // 首選時段
  // 其他
  previousExperience: text("previous_experience"), // 是否有跆拳道經驗
  medicalConditions: text("medical_conditions"), // 特殊身體狀況/過敏
  howDidYouHear: varchar("how_did_you_hear", { length: 200 }), // 從何處得知
  remarks: text("remarks"), // 其他備註
  // 狀態管理
  status: mysqlEnum("status", ["pending", "contacted", "enrolled", "rejected"]).default("pending").notNull(),
  adminNotes: text("admin_notes"), // 管理員備註
  convertedStudentId: int("converted_student_id"), // 轉為正式學生後的 ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;

/**
 * 課程表
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  dojoId: int("dojo_id").references(() => dojos.id), // 所屬道場
  coachId: int("coach_id").references(() => coaches.id),
  dayOfWeek: mysqlEnum("day_of_week", ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM 格式
  endTime: varchar("end_time", { length: 5 }).notNull(),
  maxStudents: int("max_students").default(20),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * 出席記錄表
 */
export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id"),  // legacy, nullable — no longer used as FK
  scheduleId: int("schedule_id"),  // training_schedules.id — the actual schedule this record belongs to
  studentId: int("student_id").notNull().references(() => students.id),
  attendanceDate: timestamp("attendance_date").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "excused"]).default("present").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;

/**
 * 繳費提醒記錄表 - 記錄每次發送繳費提醒的時間
 */
export const paymentReminders = mysqlTable("payment_reminders", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull().references(() => students.id),
  remindedAt: timestamp("reminded_at").defaultNow().notNull(),
  remindedBy: int("reminded_by").notNull().references(() => users.id), // 誰發送的提醒
  month: int("month").notNull(), // 提醒的月份 (1-12)
  year: int("year").notNull(), // 提醒的年份
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;

/**
 * 訓練日期表 - 記錄每個班別的訓練日期
 * 預設每週都有訓練，但可以手動取消或新增
 */
export const trainingSchedules = mysqlTable("training_schedules", {
  id: int("id").autoincrement().primaryKey(),
  trainingDate: timestamp("training_date").notNull(), // 訓練日期
  venue: varchar("venue", { length: 100 }).notNull(), // 道場
  scheduleDay: varchar("schedule_day", { length: 50 }).notNull(), // 星期
  scheduleTime: varchar("schedule_time", { length: 50 }).notNull(), // 時段
  status: mysqlEnum("status", ["active", "cancelled"]).default("active").notNull(), // 狀態：活躍/已取消
  notes: text("notes"), // 備註（例如取消原因）
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TrainingSchedule = typeof trainingSchedules.$inferSelect;
export type InsertTrainingSchedule = typeof trainingSchedules.$inferInsert;

/**
 * WhatsApp 訊息範本表
 */
export const whatsappTemplates = mysqlTable("whatsapp_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 範本名稱
  content: text("content").notNull(), // 範本內容，支援變數: {{studentName}}, {{feeAmount}}, {{phone}}, {{systemUrl}}
  isDefault: boolean("is_default").default(false).notNull(), // 是否為預設範本
  isActive: boolean("is_active").default(true).notNull(), // 是否啟用
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

/**
 * 精英班學生表 - 獨立於恆常班
 */
export const eliteStudents = mysqlTable("elite_students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  password: varchar("password", { length: 255 }), // 密碼(加密後),預設為電話號碼
  beltLevel: varchar("belt_level", { length: 50 }),
  coach: varchar("coach", { length: 100 }), // 負責教練
  scheduleDay: varchar("schedule_day", { length: 50 }), // 訓練日(例如: 星期六)
  scheduleTime: varchar("schedule_time", { length: 50 }), // 訓練時間(例如: 2:00-4:00pm)
  feePerClass: decimal("fee_per_class", { precision: 10, scale: 2 }).notNull().default("0"), // 每堂費用
  remainingClasses: int("remaining_classes").notNull().default(0), // 剩餘堂數
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  joinDate: timestamp("join_date"), // 加入精英班的日期
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type EliteStudent = typeof eliteStudents.$inferSelect;
export type InsertEliteStudent = typeof eliteStudents.$inferInsert;

/**
 * 精英班訓練日期表
 */
export const eliteTrainingSchedules = mysqlTable("elite_schedules", {
  id: int("id").autoincrement().primaryKey(),
  trainingDate: timestamp("training_date").notNull(),
  scheduleDay: varchar("schedule_day", { length: 50 }).notNull(),
  scheduleTime: varchar("schedule_time", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["active", "cancelled"]).default("active").notNull(),
  statusA: mysqlEnum("status_a", ["active", "cancelled"]).default("active").notNull(),
  statusB: mysqlEnum("status_b", ["active", "cancelled"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type EliteTrainingSchedule = typeof eliteTrainingSchedules.$inferSelect;
export type InsertEliteTrainingSchedule = typeof eliteTrainingSchedules.$inferInsert;

/**
 * 精英班出席記錄表
 */
export const eliteAttendanceRecords = mysqlTable("elite_attendance", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("schedule_id").notNull(),
  studentId: int("student_id").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "excused"]).default("present").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EliteAttendanceRecord = typeof eliteAttendanceRecords.$inferSelect;
export type InsertEliteAttendanceRecord = typeof eliteAttendanceRecords.$inferInsert;

/**
 * 精英班繳費記錄表 - 以堂計費
 */
export const elitePaymentRecords = mysqlTable("elite_payments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull().references(() => eliteStudents.id),
  classCount: int("class_count").notNull(), // 購買堂數
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 繳費金額
  receiptUrl: text("receipt_url"),
  receiptKey: text("receipt_key"),
  paymentDate: timestamp("payment_date").notNull(),
  confirmedBy: mysqlEnum("confirmed_by", ["parent_upload", "admin_approved"]).default("admin_approved"),
  status: mysqlEnum("status", ["pending", "confirmed"]).default("confirmed").notNull(),
  notes: text("notes"),
  // 收據審查欄位
  reviewStatus: mysqlEnum("review_status", ["normal", "pending_review", "approved", "rejected"]).default("normal").notNull(),
  reviewReason: varchar("review_reason", { length: 500 }),
  reviewMatchType: varchar("review_match_type", { length: 50 }),
  reviewMatchPaymentId: int("review_match_payment_id"),
  reviewedBy: varchar("reviewed_by", { length: 50 }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ElitePaymentRecord = typeof elitePaymentRecords.$inferSelect;
export type InsertElitePaymentRecord = typeof elitePaymentRecords.$inferInsert;

/**
 * 會計記錄表 - 收入/支出總帳，供核數師和報稅使用
 */
export const accountingRecords = mysqlTable("accounting_records", {
  id: int("id").autoincrement().primaryKey(),
  // 基本資訊
  transactionDate: timestamp("transaction_date").notNull(), // 交易日期（入帳日期）
  bank: varchar("bank", { length: 100 }), // 銀行名稱（付款方銀行）
  receivingBank: varchar("receiving_bank", { length: 100 }), // 收款銀行（入數到哪間銀行，用於對帳）
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 金額（正數）
  
  // 收支類型
  type: mysqlEnum("type", ["income", "expense"]).notNull(), // 收入 / 支出
  
  // 類別
  // 收入類別: tuition=學費, exam_fee=考試費, competition_fee=比賽費, equipment_fee=用具費, other_income=其他收入
  // 支出類別: competition_entry=大會比賽報名費, photography=攝影, promotion=宣傳, 
  //          dinner=聚餐費, supplier=供應商費用, venue_rental=場租, office_rental=office租金, 
  //          mpf=MPF, coach_fee=教練費, other_expense=其他支出
  category: varchar("category", { length: 50 }).notNull(),
  
  // 詳情
  description: text("description"), // 備註/說明
  
  // 收據
  receiptUrl: text("receipt_url"), // 收據圖片URL
  receiptKey: text("receipt_key"), // 收據圖片 storage key
  
  // 關聯（可選）
  paymentRecordId: int("payment_record_id"), // 關聯的繳費記錄ID（自動同步時填入）
  elitePaymentRecordId: int("elite_payment_record_id"), // 關聯的精英班繳費記錄ID
  examPaymentId: int("exam_payment_id"), // 關聯的考試繳費記錄ID
  studentName: varchar("student_name", { length: 100 }), // 學生姓名（收入時填入）
  coachName: varchar("coach_name", { length: 100 }), // 教練姓名
  dojoName: varchar("dojo_name", { length: 100 }), // 道場名稱（來源道場）
  
  // 來源
  source: mysqlEnum("source", ["auto_sync", "manual"]).default("manual").notNull(), // 來源：自動同步 / 手動輸入
  
  // 銀行對帳
  bankReference: varchar("bank_reference", { length: 200 }), // 銀行交易參考編號
  reconciliationStatus: mysqlEnum("reconciliation_status", ["unmatched", "matched", "manual"]).default("unmatched"), // 對帳狀態
  reconciliationDate: timestamp("reconciliation_date"), // 對帳完成日期
  
  // OCR 識別結果
  ocrRawResult: text("ocr_raw_result"), // OCR 原始識別結果 JSON（供後續核對）
  
  // 會計模組連結
  journalEntryId: int("journal_entry_id"), // 關聯的 Journal Entry ID
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AccountingRecord = typeof accountingRecords.$inferSelect;
export type InsertAccountingRecord = typeof accountingRecords.$inferInsert;

/**
 * 活動資料表 - 考試/比賽/交流訓練
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["exam", "competition", "training"]).notNull(), // 考試/比賽/交流訓練
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventTime: varchar("event_time", { length: 50 }),
  location: varchar("location", { length: 200 }),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("0"),
  maxParticipants: int("max_participants"),
  registrationDeadline: timestamp("registration_deadline"),
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * 活動報名表
 */
export const eventRegistrations = mysqlTable("event_registrations", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull().references(() => events.id),
  studentId: int("student_id"),
  eliteStudentId: int("elite_student_id"),
  studentName: varchar("student_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["registered", "confirmed", "cancelled"]).default("registered").notNull(),
  notes: text("notes"),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type InsertEventRegistration = typeof eventRegistrations.$inferInsert;

// ==================== 考試評分系統 ====================

// 考試場次表
export const examSessions = mysqlTable("exam_sessions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  examDate: date("exam_date", { mode: 'string' }).notNull(),
  examTime: varchar("exam_time", { length: 100 }),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "scheduled", "in_progress", "completed"]).default("draft").notNull(),
  registrationOpen: boolean("registration_open").default(false).notNull(),
  registrationDeadline: timestamp("registration_deadline"),
  eventId: int("event_id"),  // 關聯到 events 表
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ExamSession = typeof examSessions.$inferSelect;
export type InsertExamSession = typeof examSessions.$inferInsert;

// 考生表 (關聯學生到考試)
export const examCandidates = mysqlTable("exam_candidates", {
  id: int("id").autoincrement().primaryKey(),
  examId: int("exam_id").notNull(),
  studentId: int("student_id"),  // 關聯到 students 表
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  dojoName: varchar("dojo_name", { length: 100 }),
  gender: mysqlEnum("gender", ["male", "female"]).default("male").notNull(),
  age: int("age"),
  ageGroup: varchar("age_group", { length: 50 }),
  currentBelt: varchar("current_belt", { length: 50 }).notNull(),
  targetBelt: varchar("target_belt", { length: 50 }).notNull(),
  groupCode: varchar("group_code", { length: 10 }),
  orderNumber: int("order_number"),
  status: mysqlEnum("status", ["registered", "checked_in", "examining", "passed", "failed", "absent"]).default("registered").notNull(),
  hasLakLakAward: boolean("has_lak_lak_award").default(false).notNull(),
  certificateIssued: mysqlEnum("certificate_issued", ["not_issued", "issued", "out_of_stock"]).default("not_issued").notNull(),
  reportCardIssued: mysqlEnum("report_card_issued", ["not_issued", "issued", "out_of_stock"]).default("not_issued").notNull(),
  lakLakAwardIssued: mysqlEnum("lak_lak_award_issued", ["not_issued", "issued", "out_of_stock"]).default("not_issued").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ExamCandidate = typeof examCandidates.$inferSelect;
export type InsertExamCandidate = typeof examCandidates.$inferInsert;

// 評分項目表
export const examScoringItems = mysqlTable("exam_scoring_items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["grade", "pass_fail", "yes_no"]).default("grade").notNull(),
  category: varchar("category", { length: 50 }),
  maxScore: decimal("max_score", { precision: 5, scale: 2 }).default("10.00").notNull(),
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.00").notNull(),
  beltLevel: varchar("belt_level", { length: 50 }),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExamScoringItem = typeof examScoringItems.$inferSelect;
export type InsertExamScoringItem = typeof examScoringItems.$inferInsert;

// 評分記錄表
export const examScores = mysqlTable("exam_scores", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidate_id").notNull(),
  scoringItemId: int("scoring_item_id").notNull(),
  score: varchar("score", { length: 50 }),
  comment: text("comment"),
  scoredBy: varchar("scored_by", { length: 100 }),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ExamScore = typeof examScores.$inferSelect;
export type InsertExamScore = typeof examScores.$inferInsert;

// 考試時間表
export const examSchedules = mysqlTable("exam_schedules", {
  id: int("id").autoincrement().primaryKey(),
  examId: int("exam_id").notNull(),
  beltLevel: varchar("belt_level", { length: 50 }).notNull(),
  groupCode: varchar("group_code", { length: 10 }),
  startTime: varchar("start_time", { length: 30 }).notNull(),
  endTime: varchar("end_time", { length: 30 }),
  timeSlot: varchar("time_slot", { length: 50 }),
  venue: varchar("venue", { length: 255 }),
  notes: text("notes"),
  actualStartTime: datetime("actual_start_time"),
  actualEndTime: datetime("actual_end_time"),
  actualDurationMinutes: int("actual_duration_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ExamSchedule = typeof examSchedules.$inferSelect;
export type InsertExamSchedule = typeof examSchedules.$inferInsert;

// 考試繳費記錄表
export const examPayments = mysqlTable("exam_payments", {
  id: int("id").autoincrement().primaryKey(),
  examId: int("exam_id").notNull(), // 關聯到 exam_sessions
  candidateId: int("candidate_id"), // 關聯到 exam_candidates（可能為 null，若考生被刪除）
  studentId: int("student_id"), // 關聯到 students（方便穿透查詢）
  studentName: varchar("student_name", { length: 100 }).notNull(), // 學生姓名（冗餘，查詢方便）
  targetBelt: varchar("target_belt", { length: 50 }).notNull(), // 考什麼帶（決定費用）
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 繳費金額
  isRetake: boolean("is_retake").default(false).notNull(), // 是否重考（免費）
  // 收據資訊
  receiptUrl: text("receipt_url"), // 收據圖片 URL
  receiptKey: text("receipt_key"), // Storage key
  bank: varchar("bank", { length: 100 }), // 付款銀行
  receivingBank: varchar("receiving_bank", { length: 100 }), // 收款銀行
  paymentDate: timestamp("payment_date"), // 轉帳日期
  // 狀態
  status: mysqlEnum("status", ["pending", "confirmed", "waived"]).default("confirmed").notNull(),
  // waived = 重考免費豁免
  confirmedBy: varchar("confirmed_by", { length: 100 }), // 確認者
  notes: text("notes"), // 備註
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ExamPayment = typeof examPayments.$inferSelect;
export type InsertExamPayment = typeof examPayments.$inferInsert;

// 系統設定
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("config_key", { length: 100 }).notNull().unique(),
  configValue: text("config_value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

// ==================== 會計模組 ====================

/**
 * 會計科目表 Chart of Accounts
 */
export const chartOfAccounts = mysqlTable("chart_of_accounts", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  nameZh: varchar("name_zh", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  parentCode: varchar("parent_code", { length: 20 }),
  isSystem: boolean("is_system").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  description: varchar("description", { length: 255 }),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = typeof chartOfAccounts.$inferInsert;

/**
 * 日記帳主表 Journal Entries
 */
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryNumber: varchar("entry_number", { length: 30 }).notNull().unique(),
  entryDate: date("entry_date", { mode: 'string' }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  sourceType: mysqlEnum("source_type", ["auto_sync", "manual", "adjustment", "reversal", "deferred_split"]).notNull(),
  sourceId: int("source_id"),
  sourceTable: varchar("source_table", { length: 50 }),
  fiscalYear: int("fiscal_year").notNull(),
  fiscalMonth: int("fiscal_month").notNull(),
  isPosted: boolean("is_posted").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  postedAt: timestamp("posted_at"),
  postedBy: varchar("posted_by", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

/**
 * 日記帳明細 Journal Entry Lines
 */
export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journal_entry_id").notNull(),
  accountCode: varchar("account_code", { length: 20 }).notNull(),
  debit: decimal("debit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0.00").notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = typeof journalEntryLines.$inferInsert;

/**
 * 映射規則 Mapping Rules（流水帳 → 會計分錄）
 */
export const mappingRules = mysqlTable("mapping_rules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameZh: varchar("name_zh", { length: 100 }).notNull(),
  recordType: mysqlEnum("record_type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  debitAccountCode: varchar("debit_account_code", { length: 20 }).notNull(),
  creditAccountCode: varchar("credit_account_code", { length: 20 }).notNull(),
  isDeferred: boolean("is_deferred").default(false).notNull(),
  isSystem: boolean("is_system").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  priority: int("priority").default(0).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type MappingRule = typeof mappingRules.$inferSelect;
export type InsertMappingRule = typeof mappingRules.$inferInsert;

// ==================== 銀行月結單持久化 ====================

/**
 * 銀行月結單主表 - 保存每次上傳的 OCR 結果
 */
export const bankStatements = mysqlTable("bank_statements", {
  id: int("id").autoincrement().primaryKey(),
  bankName: varchar("bank_name", { length: 100 }), // 銀行名稱
  statementMonth: varchar("statement_month", { length: 7 }).notNull(), // 格式: 2026-03
  statementPeriod: varchar("statement_period", { length: 100 }), // OCR 識別的結算期
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }), // 期初結餘
  closingBalance: decimal("closing_balance", { precision: 12, scale: 2 }), // 期末結餘
  totalTransactions: int("total_transactions").default(0).notNull(), // 總交易筆數
  matchedCount: int("matched_count").default(0).notNull(), // 已匹配筆數
  unmatchedCount: int("unmatched_count").default(0).notNull(), // 未匹配筆數
  status: mysqlEnum("status", ["pending", "partial", "completed"]).default("pending").notNull(), // 對帳狀態
  uploadedBy: int("uploaded_by"), // 上傳者 user id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = typeof bankStatements.$inferInsert;

/**
 * 銀行月結單交易明細 - 每筆 OCR 識別的交易
 */
export const bankStatementTransactions = mysqlTable("bank_statement_transactions", {
  id: int("id").autoincrement().primaryKey(),
  statementId: int("statement_id").notNull(), // 關聯到 bank_statements
  date: varchar("txn_date", { length: 20 }), // 交易日期
  description: text("description"), // 交易說明
  debit: decimal("debit", { precision: 12, scale: 2 }), // 支出金額
  credit: decimal("credit", { precision: 12, scale: 2 }), // 收入金額
  balance: decimal("balance", { precision: 12, scale: 2 }), // 結餘
  reference: varchar("reference", { length: 200 }), // 參考編號
  // 對帳狀態
  reconcileStatus: mysqlEnum("reconcile_status", ["pending", "matched", "manual", "skipped"]).default("pending").notNull(),
  matchedRecordId: int("matched_record_id"), // 匹配到的 accounting_records.id
  matchScore: int("match_score"), // 匹配分數
  manualCategory: varchar("manual_category", { length: 50 }), // 手動填寫的類別
  manualStudentName: varchar("manual_student_name", { length: 100 }), // 手動填寫的學生名
  manualCoachName: varchar("manual_coach_name", { length: 100 }), // 手動填寫的教練名
  reconciledAt: timestamp("reconciled_at"), // 對帳完成時間
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BankStatementTransaction = typeof bankStatementTransactions.$inferSelect;
export type InsertBankStatementTransaction = typeof bankStatementTransactions.$inferInsert;

// ==================== 工作日誌 ====================
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: int("entity_id"),
  examId: int("exam_id"),
  description: text("description").notNull(),
  snapshot: json("snapshot"),
  relatedActions: json("related_actions"),
  performedBy: varchar("performed_by", { length: 100 }),
  isUndone: tinyint("is_undone").notNull().default(0),
  undoLogId: int("undo_log_id"),
  parentLogId: int("parent_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
