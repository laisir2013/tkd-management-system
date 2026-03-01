# 家長手機 App — 後端 REST API 參考文件

> 本文件基於現有程式碼 100% 精確整理，供你自己實作 `/api/v1/parent/*` REST 層與 React Native App。

---

## 一、需要安裝的套件

```bash
npm install jsonwebtoken multer
npm install -D @types/jsonwebtoken @types/multer
```

現有已裝的相關套件：`express`, `bcrypt`, `@aws-sdk/client-s3`

---

## 二、檔案結構建議

```
server/
├── _core/index.ts          # 主入口 (已有，需加 1 行掛載)
├── parentApi.ts             # 新增：REST 路由
├── parentAuth.ts            # 新增：JWT 生成/驗證
├── password.ts              # 已有：bcrypt hash/verify
├── db.ts                    # 已有：所有 DB 函數
├── storage.ts               # 已有：R2/本地存儲
├── _core/localOcr.ts        # 已有：本地 OCR
└── _core/llm.ts             # 已有：LLM OCR
```

---

## 三、主入口掛載 (server/_core/index.ts)

在 `// tRPC API` 那行之前加：

```typescript
import parentRouter from '../parentApi';
app.use('/api/v1/parent', parentRouter);
```

位置參考（現有檔案第 147 行附近）：

```typescript
// ↓ 在這之前加
// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({ ... })
);
```

**CORS 注意**：現有系統沒有裝 cors 套件。手機 App 不走瀏覽器，不需要 CORS headers。如果未來需要，再裝 `cors` 套件。

---

## 四、JWT 模組 (新檔案 server/parentAuth.ts)

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'taekwondo-local-dev-secret-key-2026';
const JWT_EXPIRES_IN = '30d'; // 手機 App 不應頻繁要求重新登入

export function generateParentToken(phone: string): string {
  return jwt.sign({ phone, role: 'parent' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyParentToken(token: string): { phone: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { phone: string; role: string };
}
```

> JWT_SECRET 直接沿用你 .env 裡已有的那個。

---

## 五、完整 REST 路由 (新檔案 server/parentApi.ts)

### 5.1 需要 import 的現有函數

```typescript
// DB 函數（全部從 server/db.ts export）
import {
  getStudentsByPhone,             // (phone: string) => Promise<Student[]>
  getEliteStudentsByPhone,        // (phone: string) => Promise<EliteStudent[]>
  getParentAttendanceRecords,     // (phone: string, year: number, month: number) => Promise<{student, schedules}[]>
  getParentEliteInfo,             // (phone: string) => Promise<{student, totalAttended, ...}[] | null>
  getMonthlyPaymentStatuses,      // (year?: number) => Promise<MonthlyPaymentStatus[]>
  getPaymentRecordsByStudentIds,  // (studentIds: number[]) => Promise<PaymentRecord[]>
  getStudentById,                 // (id: number) => Promise<Student | undefined>
  insertPaymentRecord,            // (record: InsertPaymentRecord) => Promise<number>
  syncPaymentToAccounting,        // (params: {...}) => Promise<void>
  getOpenEvents,                  // () => Promise<Event[]>
  getAllEvents,                   // (filters?) => Promise<Event[]>
  getEventRegistrations,          // (eventId?: number, phone?: string) => Promise<EventRegistration[]>
  getEventRegistrationCount,      // (eventId: number) => Promise<number>
  registerForEvent,               // (data: {...}) => Promise<{insertId: number}>
  cancelEventRegistration,        // (id: number) => Promise<void>
  getExamResultsByPhone,          // (phone: string) => Promise<{exam, candidate, scores}[]>
  getDb,                          // () => Promise<DrizzleDB | null>
} from '../db';

// 密碼（從 server/password.ts）
import { verifyPassword, hashPassword } from './password';

// 存儲（從 server/storage.ts）
import { storagePut } from './storage';

// OCR（從 server/_core/localOcr.ts）
import { ocrReceipt } from './_core/localOcr';

// LLM OCR（從 server/_core/llm.ts）— 可選，本地 OCR 失敗時的後備
import { invokeLLM } from './_core/llm';

// JWT
import { generateParentToken, verifyParentToken } from './parentAuth';

// Schema（改密碼用）
import * as schema from '../drizzle/schema';
const { students, eliteStudents } = schema;
import { eq } from 'drizzle-orm';
```

### 5.2 Auth 中間件

```typescript
import { Request, Response, NextFunction } from 'express';

interface ParentRequest extends Request {
  phone?: string;
}

function authMiddleware(req: ParentRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'MISSING_TOKEN', message: '未登入' });
  try {
    const decoded = verifyParentToken(token);
    req.phone = decoded.phone;
    next();
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: '登入已過期，請重新登入' });
    }
    res.status(401).json({ error: 'INVALID_TOKEN', message: '無效的登入憑證' });
  }
}
```

### 5.3 所有 Endpoint 規格

---

#### POST `/api/v1/parent/login`  (公開，不需 token)

**用途**：家長登入

**Request Body (JSON)**：
```json
{ "phone": "90971420", "password": "90971420" }
```

**邏輯**（跟 routers.ts 第 186-241 行一致）：
1. `getStudentsByPhone(phone)` 查恆常班
2. `getEliteStudentsByPhone(phone)` 查精英班
3. 兩邊都找不到 → 401
4. 取第一個有資料的當 `authTarget`
5. `authTarget.password` 為空 → 用電話號碼當預設密碼比對
6. 否則 `verifyPassword(password, authTarget.password)`
7. 成功 → 回傳 `{ success: true, token: generateParentToken(phone), students, hasElite, needPasswordChange? }`

**Response**：
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "students": [{ "id": 1, "name": "黃天愉", "venue": "...", ... }],
  "hasElite": true,
  "needPasswordChange": false
}
```

---

#### GET `/api/v1/parent/students` (需 token)

**用途**：取得恆常班學生資料

**直接調用**：
```typescript
const students = await getStudentsByPhone(req.phone!);
res.json(students);
```

**Response 欄位**（Student 型別）：
```typescript
{
  id: number;
  name: string;
  phone: string;
  venue: string;          // "XX道場"
  scheduleDay: string;    // "星期六"
  scheduleTime: string;   // "10:00-11:30"
  beltLevel: string;      // "白帶"
  feePerQuarter: string;  // "1800"
  coach: string;          // "賴政堡教練"
  status: string;         // "active"
  password?: string;      // ⚠️ 回傳時要排除這個欄位！
}
```

**⚠️ 安全提醒**：回傳前務必刪除 `password` 欄位：
```typescript
res.json(students.map(({ password, ...s }) => s));
```

---

#### GET `/api/v1/parent/elite-info` (需 token)

**用途**：取得精英班學生完整資料（含堂數追蹤、繳費記錄、出席詳情）

**直接調用**：
```typescript
const info = await getParentEliteInfo(req.phone!);
res.json(info || []);
```

**Response 結構**（每個學生一個物件）：
```typescript
[{
  student: { id, name, scheduleDay, scheduleTime, beltLevel, status },
  totalAttended: number,     // 累計出席堂數
  cycleNumber: number,       // 當期第幾堂 (1-12)
  completedCycles: number,   // 已完成幾期
  needPaymentReminder: boolean, // cycleNumber >= 10
  paidClasses: number,       // 已付總堂數
  remainingClasses: number,  // 剩餘堂數 (paidClasses - totalAttended)
  needPayment: boolean,      // remainingClasses <= 0
  payments: [{ id, classCount, amount, paymentDate, status }],
  attendanceDetails: [{ classNumber, date, cycleNumber, cycleIndex }],
}]
```

---

#### GET `/api/v1/parent/attendance?year=2026&month=3` (需 token)

**用途**：取得恆常班出席記錄（按月）

**直接調用**：
```typescript
const data = await getParentAttendanceRecords(req.phone!, Number(req.query.year), Number(req.query.month));
res.json(data);
```

**Response 結構**：
```typescript
[{
  student: { id, name, venue, scheduleDay, scheduleTime },
  schedules: [{
    scheduleId: number,
    date: Date,              // 訓練日期
    status: 'active' | 'cancelled',
    attendanceStatus: 'present' | 'absent' | 'late' | 'excused' | null,
  }]
}]
```

---

#### GET `/api/v1/parent/monthly-statuses?year=2026` (需 token)

**用途**：取得全年 12 個月繳費狀態（月份格子 paid/unpaid/future）

**邏輯**（跟 routers.ts 第 1493-1501 行一致）：
```typescript
const all = await getMonthlyPaymentStatuses(Number(req.query.year));
const filtered = all.filter(s => s.phone === req.phone);
res.json(filtered);
```

**Response 結構**：
```typescript
[{
  studentId: number,
  phone: string,
  months: {
    1: { status: 'paid' | 'unpaid' | 'future' },
    2: { status: 'paid' },
    ...
    12: { status: 'future' },
  }
}]
```

---

#### GET `/api/v1/parent/payments` (需 token)

**用途**：取得繳費記錄歷史

**邏輯**：
```typescript
const students = await getStudentsByPhone(req.phone!);
const ids = students.map(s => s.id);
if (ids.length === 0) return res.json([]);
const payments = await getPaymentRecordsByStudentIds(ids);
res.json(payments);
```

**Response 欄位**（PaymentRecord 型別）：
```typescript
{
  id: number;
  studentId: number;
  paymentPeriod: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'CUSTOM' | 'MONTHLY';
  customMonths: string | null;    // JSON array string
  amount: string;                 // "1800.00"
  receiptUrl: string | null;
  receiptKey: string | null;
  paymentDate: Date;
  status: 'pending' | 'confirmed';
  confirmedBy: 'parent_upload' | 'admin_approved' | 'coach_approved' | null;
  receiptTransferDate: Date | null;
  year: number;
  paymentMonth: number | null;
}
```

---

#### POST `/api/v1/parent/payments/create` (需 token，multipart/form-data)

**用途**：上傳收據繳費

**⚠️ 這是最複雜的 endpoint，收據上傳 + OCR + S3 存儲 + 會計同步**

**Request**（multipart/form-data）：
- `receipt` — 圖片檔案 (image/jpeg, image/png)
- `studentId` — 學生 ID (string，轉 number)
- `paymentPeriod` — "Q1" | "Q2" | "Q3" | "Q4" | "CUSTOM"
- `customMonths` — 可選，JSON string，例如 `'["2026-1","2026-2"]'`

**後端用 multer**：
```typescript
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

parentRouter.post('/payments/create', upload.single('receipt'), async (req, res) => {
  // req.file.buffer — 圖片 Buffer
  // req.file.mimetype — 'image/jpeg'
  // req.body.studentId, req.body.paymentPeriod, req.body.customMonths
});
```

**核心邏輯**（跟 routers.ts 第 1126-1340 行一致）：

1. **驗證學生歸屬**：
```typescript
const students = await getStudentsByPhone(req.phone!);
if (!students.find(s => s.id === Number(req.body.studentId))) {
  return res.status(403).json({ error: '無權操作此學生' });
}
```

2. **上傳收據到 S3**：
```typescript
const receiptBuffer = req.file!.buffer;
const mimeType = req.file!.mimetype;
const fileExt = mimeType.split('/')[1] || 'jpg';
const receiptKey = `receipts/${studentId}-${Date.now()}.${fileExt}`;
const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, mimeType);
```

3. **OCR 識別**（先本地 Tesseract，失敗再用 LLM）：
```typescript
const base64 = receiptBuffer.toString('base64');
let extractedAmount = '0';
let extractedBank: string | null = null;
let extractedStatus: string | null = null;
let extractedDateTime: string | null = null;
let receiptTransferDate: Date | null = null;

try {
  const localResult = await ocrReceipt(base64, mimeType);
  if (localResult.amount) extractedAmount = localResult.amount;
  if (localResult.bank) extractedBank = localResult.bank;
  if (localResult.status) extractedStatus = localResult.status;
  if (localResult.date) {
    const dateStr = localResult.time ? `${localResult.date}T${localResult.time}` : localResult.date;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) receiptTransferDate = parsed;
    extractedDateTime = localResult.time ? `${localResult.date} ${localResult.time}` : localResult.date;
  }
} catch (e) {
  console.warn('[OCR] 本地識別失敗');
}

// 如果本地 OCR 未識別到金額，可選用 LLM
if (!extractedAmount || extractedAmount === '0') {
  // invokeLLM(...) — 參考 routers.ts 第 1188-1240 行
}
```

4. **收款人驗證**（routers.ts 第 1280-1310 行有完整邏輯，決定 status 是 'confirmed' 還是 'pending'）

5. **插入繳費記錄**：
```typescript
const newPaymentId = await insertPaymentRecord({
  studentId,
  paymentPeriod,
  customMonths: customMonths || null,
  amount: extractedAmount,
  receiptUrl,
  receiptKey,
  receiptTransferDate,
  paymentDate: new Date(),
  status,           // 'confirmed' 或 'pending'
  confirmedBy: 'parent_upload',
});
```

6. **如果 confirmed，同步會計**：
```typescript
if (status === 'confirmed') {
  const student = await getStudentById(studentId);
  if (student) {
    await syncPaymentToAccounting({
      paymentRecordId: newPaymentId,
      transactionDate: receiptTransferDate || new Date(),
      amount: extractedAmount,
      bank: extractedBank,
      studentName: student.name,
      coachName: student.coach,
      dojoName: student.venue,
      category: 'tuition',
      receiptUrl,
      receiptKey,
    });
  }
}
```

7. **回傳結果**：
```json
{
  "success": true,
  "status": "confirmed",
  "extractedAmount": "1800",
  "extractedBank": "匯豐銀行",
  "extractedStatus": "成功",
  "extractedDateTime": "2026-03-01 14:30"
}
```

---

#### GET `/api/v1/parent/events` (需 token)

**用途**：取得開放報名的活動

```typescript
const events = await getOpenEvents();
res.json(events);
```

**Response 欄位**：
```typescript
{
  id: number;
  title: string;
  type: 'exam' | 'competition' | 'training';
  description: string | null;
  eventDate: Date;
  eventTime: string | null;
  location: string | null;
  fee: string;              // "200" 或 "0"
  maxParticipants: number | null;
  registrationDeadline: Date | null;
  status: 'open';
}
```

---

#### GET `/api/v1/parent/events/my-registrations` (需 token)

**用途**：取得我的報名記錄

```typescript
const regs = await getEventRegistrations(undefined, req.phone!);
res.json(regs);
```

**Response 欄位**：
```typescript
{
  id: number;
  eventId: number;
  studentId: number | null;
  eliteStudentId: number | null;
  studentName: string;
  phone: string;
  status: 'registered' | 'confirmed' | 'cancelled';
  notes: string | null;
  registeredAt: Date;
}
```

---

#### POST `/api/v1/parent/events/register` (需 token)

**用途**：報名活動

**Request Body**：
```json
{
  "eventId": 1,
  "studentId": 5,
  "eliteStudentId": null,
  "studentName": "黃天愉",
  "notes": ""
}
```

**邏輯**（跟 routers.ts 第 3956-3993 行一致）：
```typescript
// 1. 檢查是否已報名
const existing = await getEventRegistrations(input.eventId, req.phone!);
const alreadyRegistered = existing.find(r => r.studentName === input.studentName && r.status !== 'cancelled');
if (alreadyRegistered) return res.status(400).json({ error: '該學生已報名此活動' });

// 2. 檢查人數
const count = await getEventRegistrationCount(input.eventId);
const allEvents = await getAllEvents();
const event = allEvents.find(e => e.id === input.eventId);
if (event?.maxParticipants && count >= event.maxParticipants) {
  return res.status(400).json({ error: '報名人數已滿' });
}

// 3. 插入
const result = await registerForEvent({
  eventId: input.eventId,
  studentId: input.studentId || null,
  eliteStudentId: input.eliteStudentId || null,
  studentName: input.studentName,
  phone: req.phone!,
  status: 'registered',
  notes: input.notes || null,
});
res.json({ success: true, id: result.insertId });
```

---

#### POST `/api/v1/parent/events/cancel` (需 token)

**用途**：取消報名

**Request Body**：
```json
{ "id": 15 }
```

**邏輯**：
```typescript
// ⚠️ 建議驗證：這個 registration 是否屬於 req.phone
await cancelEventRegistration(input.id);
res.json({ success: true });
```

---

#### GET `/api/v1/parent/exam-results` (需 token)

**用途**：取得考試成績

```typescript
const results = await getExamResultsByPhone(req.phone!);
res.json(results);
```

**Response 結構**：
```typescript
[{
  exam: {
    id: number;
    name: string;
    examDate: Date;
    location: string | null;
  },
  candidate: {
    id: number;
    name: string;
    currentBelt: string;
    targetBelt: string;
    status: 'registered' | 'checked_in' | 'examining' | 'passed' | 'failed' | 'absent';
    hasLakLakAward: boolean;
  },
  scores: [{
    itemName: string;       // "俯臥撐"
    itemType: string;       // "score" | "pass_fail"
    itemCategory: string;   // "fitness" | "poomsae" | "technique" | "board" | "sparring" ...
    score: string;          // "A" | "B" | "C" | "合格" | "不合格" | "有" | "沒有"
    comment: string | null;
  }]
}]
```

---

#### POST `/api/v1/parent/change-password` (需 token)

**用途**：修改密碼

**Request Body**：
```json
{ "oldPassword": "90971420", "newPassword": "myNewP@ss123" }
```

**邏輯**（跟 routers.ts 第 435-459 行一致）：
```typescript
const db = await getDb();
const studentResult = await db.select().from(students)
  .where(eq(students.phone, req.phone!))
  .limit(1);

if (studentResult.length === 0) return res.status(404).json({ error: '找不到帳號' });
const student = studentResult[0];

// 驗舊密碼
let isValid = false;
if (!student.password) {
  isValid = input.oldPassword === req.phone;
} else {
  isValid = await verifyPassword(input.oldPassword, student.password);
}
if (!isValid) return res.status(401).json({ error: '舊密碼錯誤' });

// 新密碼至少 6 碼
if (input.newPassword.length < 6) return res.status(400).json({ error: '新密碼至少需要6個字元' });

// 更新
const hashed = await hashPassword(input.newPassword);
await db.update(schema.students)
  .set({ password: hashed })
  .where(eq(schema.students.phone, req.phone!));

res.json({ success: true, message: '密碼已成功修改' });
```

---

## 六、App 端 (React Native / Expo) 重點

### 6.1 建議套件

```bash
npx create-expo-app parent-app --template blank-typescript
npx expo install expo-secure-store    # 存 JWT token
npx expo install expo-image-picker    # 拍照/選圖
npx expo install expo-router          # 檔案路由
```

### 6.2 API client (lib/api.ts)

```typescript
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://你的域名/api/v1/parent';

async function request(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('token');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (res.status === 401) {
    await SecureStore.deleteItemAsync('token');
    // 跳轉登入頁
    throw new Error(data.error === 'TOKEN_EXPIRED' ? '登入已過期' : '請重新登入');
  }
  if (!res.ok) throw new Error(data.error || data.message || '請求失敗');
  return data;
}

// 收據上傳用 multipart （不走 JSON）
async function uploadReceipt(imageUri: string, studentId: number, paymentPeriod: string, customMonths?: string) {
  const token = await SecureStore.getItemAsync('token');
  const formData = new FormData();
  formData.append('receipt', { uri: imageUri, type: 'image/jpeg', name: 'receipt.jpg' } as any);
  formData.append('studentId', String(studentId));
  formData.append('paymentPeriod', paymentPeriod);
  if (customMonths) formData.append('customMonths', customMonths);

  const res = await fetch(`${BASE_URL}/payments/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    // ⚠️ 不要設 Content-Type，讓 fetch 自動設 multipart boundary
    body: formData,
  });
  return res.json();
}

export const api = {
  login: (phone: string, password: string) =>
    request('/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  getStudents: () => request('/students'),
  getEliteInfo: () => request('/elite-info'),
  getAttendance: (year: number, month: number) => request(`/attendance?year=${year}&month=${month}`),
  getMonthlyStatuses: (year: number) => request(`/monthly-statuses?year=${year}`),
  getPayments: () => request('/payments'),
  uploadReceipt,
  getEvents: () => request('/events'),
  getMyRegistrations: () => request('/events/my-registrations'),
  register: (data: any) => request('/events/register', { method: 'POST', body: JSON.stringify(data) }),
  cancelRegistration: (id: number) => request('/events/cancel', { method: 'POST', body: JSON.stringify({ id }) }),
  getExamResults: () => request('/exam-results'),
  changePassword: (oldPassword: string, newPassword: string) =>
    request('/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
};
```

### 6.3 收據上傳用法 (App 端)

```typescript
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';

async function pickAndUpload(studentId: number, paymentPeriod: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,  // 壓縮，減少上傳大小
  });
  if (result.canceled) return;

  const imageUri = result.assets[0].uri;
  const response = await api.uploadReceipt(imageUri, studentId, paymentPeriod);
  // response = { success, status, extractedAmount, extractedBank, ... }
}
```

---

## 七、Endpoint 總覽表

| 方法 | 路徑 | Token | 調用的 DB 函數 |
|------|------|-------|----------------|
| POST | `/login` | 否 | `getStudentsByPhone`, `getEliteStudentsByPhone`, `verifyPassword` |
| GET | `/students` | 是 | `getStudentsByPhone` |
| GET | `/elite-info` | 是 | `getParentEliteInfo` |
| GET | `/attendance?year&month` | 是 | `getParentAttendanceRecords` |
| GET | `/monthly-statuses?year` | 是 | `getMonthlyPaymentStatuses` + filter |
| GET | `/payments` | 是 | `getStudentsByPhone` → `getPaymentRecordsByStudentIds` |
| POST | `/payments/create` | 是 | `storagePut`, `ocrReceipt`, `insertPaymentRecord`, `syncPaymentToAccounting` |
| GET | `/events` | 是 | `getOpenEvents` |
| GET | `/events/my-registrations` | 是 | `getEventRegistrations(undefined, phone)` |
| POST | `/events/register` | 是 | `getEventRegistrations`, `getEventRegistrationCount`, `registerForEvent` |
| POST | `/events/cancel` | 是 | `cancelEventRegistration` |
| GET | `/exam-results` | 是 | `getExamResultsByPhone` |
| POST | `/change-password` | 是 | `verifyPassword`, `hashPassword`, DB update |

---

## 八、安全注意事項

1. **Password 欄位**：`getStudentsByPhone` 回傳的 Student 物件包含 `password`，REST 回傳前要 strip 掉
2. **學生歸屬驗證**：`payments/create` 和 `events/register` 要確認 studentId 屬於 `req.phone`
3. **取消報名驗證**：`events/cancel` 建議查一下該 registration 的 phone 是否 === req.phone
4. **Token 內容精簡**：只放 `{ phone, role: 'parent' }`，不放學生資料
5. **收據大小限制**：multer 設 `10MB`，App 端建議壓縮到 `quality: 0.7`
