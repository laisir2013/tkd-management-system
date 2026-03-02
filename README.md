# Taekwondo Fee & Accounting Management System

## Project Overview
- **Name**: 跆拳道館學費收據管理系統
- **Goal**: Full-featured management system for Taekwondo dojos, covering student management, fee collection, attendance, coaching, events, exams, and a complete double-entry accounting module.
- **Stack**: React + TypeScript + Hono + tRPC + MySQL + Tailwind CSS

## Completed Features

### Core Modules
- Student management (CRUD, belt history, dojo/coach assignment)
- Payment records (quarterly/monthly, receipt upload with OCR)
- Attendance tracking (regular + elite classes)
- Coach management and statistics
- Dojo management
- Elite class management (schedules, payments, attendance)
- Event management (competitions, exams, training events)
- Exam management (scoring, grading, belt promotion)
- WhatsApp template messaging
- Monthly finance reports
- Receipt duplicate detection and review system
- **Push notification queue with admin review** (NEW)

### Accounting Module (NEW)
- **Chart of Accounts (COA)**: 33 pre-seeded accounts covering assets, liabilities, equity, revenue, and expenses with bilingual names (EN/ZH).
- **Mapping Rules**: 18 pre-seeded rules automatically mapping accounting records to journal entries based on record type, category, and payment method.
- **Journal Entries (Double-Entry)**: Full journal entry system with entry number generation, posting/unposting, period locking.
- **Auto-Sync Hook**: `onAccountingRecordCreated` automatically generates journal entries whenever an accounting record is inserted (manual, receipt OCR, bank import, payment sync).
- **Financial Reports**:
  - Trial Balance (試算表) — with balance verification
  - Profit & Loss (損益表) — revenue vs expenses
  - Balance Sheet (資產負債表) — assets = liabilities + equity
  - General Ledger (總帳明細) — per-account transaction history with running balance
- **Bank Statement Reconciliation**: Upload bank statements, auto-match with system records, import unmatched transactions.

## Admin Panel Navigation

### Main Tabs
| Tab | Description |
|-----|-------------|
| 恆常班管理 | Regular class: students, payments, attendance, finance, dojos, import |
| 精英班管理 | Elite class management (separate page) |
| 教練統計 | Coach statistics with elite data |
| 財務報表 | Monthly finance reports |
| **會計總帳** | Full accounting module (see sub-tabs below) |
| 活動管理 | Event management |
| 考試評分 | Exam scoring and grading |
| 用戶管理 | User account management |
| WhatsApp範本 | WhatsApp message templates |
| 收據審查 | Receipt duplicate detection review |
| **推播審核** | Push notification queue review (with pending count badge) |

### Accounting Sub-Tabs (會計總帳)
| Sub-Tab | Description |
|---------|-------------|
| 流水帳 | Accounting records (income/expense ledger) |
| 日記帳 | Journal entries (double-entry bookkeeping) |
| 財務報表 | Financial reports (trial balance, P&L, balance sheet, general ledger) |
| 銀行對帳 | Bank statement reconciliation |

## API Routes (Accounting)

| Procedure | Type | Description |
|-----------|------|-------------|
| `accounting.getChartOfAccounts` | Query | Get all chart of accounts |
| `accounting.getJournalEntries` | Query | List journal entries with pagination |
| `accounting.getJournalEntryDetail` | Query | Get single entry with lines |
| `accounting.createJournalEntry` | Mutation | Create manual journal entry |
| `accounting.postEntry` | Mutation | Post a draft entry |
| `accounting.unpostEntry` | Mutation | Unpost a posted entry |
| `accounting.deleteEntry` | Mutation | Delete a draft entry |
| `accounting.syncPendingToJournal` | Mutation | Batch sync unlinked accounting records |
| `accounting.lockPeriod` | Mutation | Lock a fiscal year/month |
| `accounting.trialBalance` | Query | Trial balance report |
| `accounting.profitAndLoss` | Query | P&L report |
| `accounting.balanceSheet` | Query | Balance sheet report |
| `accounting.generalLedger` | Query | General ledger for a specific account |

## Push Queue System (推播審核佇列)

### Overview
All automated push notifications (triggered by attendance, payments, events, exams, etc.) are now queued into `push_queue` table with status `pending`. Admin must review and approve before notifications are actually sent to users.

### Push Queue API Routes (tRPC)
| Procedure | Type | Description |
|-----------|------|-------------|
| `pushQueue.list` | Query | List queue items by status (pending/approved/rejected) |
| `pushQueue.detail` | Query | Get single queue item details |
| `pushQueue.approve` | Mutation | Approve and send a queued push |
| `pushQueue.reject` | Mutation | Reject a queued push (with optional reason) |
| `pushQueue.batchApprove` | Mutation | Batch approve multiple items |
| `pushQueue.batchReject` | Mutation | Batch reject multiple items |
| `pushQueue.pendingCount` | Query | Get count of pending items |

### Push Queue REST API (`/api/v1/parent/admin/push-queue`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/push-queue` | List items (?status=pending&limit=50&offset=0) |
| GET | `/admin/push-queue/count` | Pending count |
| GET | `/admin/push-queue/:id` | Detail |
| POST | `/admin/push-queue/:id/approve` | Approve |
| POST | `/admin/push-queue/:id/reject` | Reject (body: {reason?}) |
| POST | `/admin/push-queue/batch-approve` | Batch approve (body: {ids}) |
| POST | `/admin/push-queue/batch-reject` | Batch reject (body: {ids, reason?}) |

### Queued Trigger Sources
| Source | Trigger Event |
|--------|---------------|
| `elite_class_progress` | Elite attendance marked |
| `payment_confirmed` | Payment confirmed by admin |
| `new_event` | New event/exam created |
| `elite_low_balance` | Elite class remaining ≤ 2 |
| `exam_result` | Exam result calculated |
| `payment_overdue` | Cron job: 30-day overdue |

### Exceptions (Direct Send, Not Queued)
- Admin receipt review notifications → sent directly to admin devices
- Manual admin push (`send-notification`) → sent directly
- Receipt review result → sent directly to parent

## Data Architecture

### Database: MySQL (`taekwondo`)
- **push_queue** — Push notification review queue (id, title, body, target_type, target_student_ids JSON, student_type, trigger_source, trigger_detail JSON, status, reviewed_by, reviewed_at, reject_reason, sent_count, created_at, updated_at)
- **chart_of_accounts** — Account codes, names (EN/ZH), types, hierarchy
- **mapping_rules** — Auto-mapping rules for record→journal conversion
- **journal_entries** — Journal entry headers (date, number, source, posted/locked status)
- **journal_entry_lines** — Debit/credit lines per journal entry
- **accounting_records** — Raw income/expense records with journal_entry_id FK

### Auto-Sync Flow
1. Payment confirmed → `syncPaymentToAccounting()` → `insertAccountingRecord()` → `onAccountingRecordCreated()` → journal entry created
2. Manual accounting record → `insertAccountingRecord()` → `onAccountingRecordCreated()` → journal entry created
3. Bank import → `insertAccountingRecord()` → `onAccountingRecordCreated()` → journal entry created

## Deployment
- **Platform**: Node.js server with Express/Hono + tRPC
- **Database**: MySQL with connection pooling
- **Build**: `npm run build` (Vite for client, esbuild for server)
- **Start**: `pm2 start ecosystem.config.cjs`
- **Port**: 3000

### Migration for push_queue table
```bash
# Run the push_queue migration on your MySQL database:
mysql -u <user> -p <database> < push_queue_migration.sql
```

## Development
```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
# Test
curl http://localhost:3000
pm2 logs --nostream
```

## Last Updated
2026-03-02 — Push notification queue system with admin review (推播審核佇列).
