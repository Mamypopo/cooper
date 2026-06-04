# Cooper — AI Personal Financial Butler
> ผู้จัดการส่วนตัวอัจฉริยะผ่าน LINE OA · ตั้งชื่อตามน้องแมวสุดที่รักของผู้พัฒนา

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| ORM | Prisma ORM |
| Database | PostgreSQL via Supabase Free Tier |
| Deployment | Vercel Hobby Tier |
| AI | Claude API (Anthropic SDK) |
| Messaging | LINE Messaging API + LIFF |
| Charts | Chart.js (LIFF Dashboard เท่านั้น) |
| Font | Noto Sans Thai + Inter |
| Icons | Lucide React |

---

## 2. Architectural Laws (ห้ามละเมิด)

```
AI layer     → Claude เท่านั้น  ห้ามแตะ DB
DB layer     → Prisma เท่านั้น  ห้ามแตะ Claude
Flex layer   → build UI เท่านั้น ห้ามมี business logic
Webhook      → orchestrate เท่านั้น เรียก services ต่างๆ
LIFF/Charts  → คำนวณและวาดกราฟฝั่ง client เท่านั้น ห้ามผสม bot logic
```

**กฎเหล็กสูงสุด:** ห้าม AI (Claude) คิดเลขหักยอดเงินใดๆ ทั้งสิ้น
→ การหักลบบวกยอดเงินทุกกรณีต้องผ่าน Prisma `$transaction` เท่านั้น

---

## 3. Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts          ← รับ LINE Webhook, verify signature
│   │   └── cron/
│   │       ├── morning-alert/route.ts
│   │       └── weekly-report/route.ts
│   └── liff/dashboard/page.tsx       ← LIFF: Statement + Radar Chart
│
├── lib/
│   ├── prisma.ts                     ← Prisma Client singleton
│   ├── line.ts                       ← LINE SDK setup + reply helpers
│   └── claude.ts                     ← Anthropic SDK setup + SYSTEM_PROMPT
│
├── services/
│   ├── ai/
│   │   ├── parser.ts                 ← RECORD MODE: ข้อความ → JSON
│   │   ├── budget-check.ts           ← BUDGET CHECK MODE
│   │   └── report-writer.ts          ← REPORT MODE: เขียนการ์ดรายงาน
│   ├── transactions/
│   │   ├── record.ts                 ← Prisma $transaction: INCOME/EXPENSE
│   │   ├── debt.ts                   ← Prisma $transaction: DEBT_LEND/REPAY
│   │   └── transfer.ts               ← Prisma $transaction: โอนระหว่างบัญชี
│   ├── alerts/
│   │   ├── subscription.ts           ← ดึง Subscription ใกล้ครบรอบ
│   │   └── debt-reminder.ts          ← สรุปหนี้ค้างชำระ
│   └── stats/
│       └── financial-score.ts        ← คำนวณ raw stats → ส่ง report-writer
│
├── flex-messages/
│   ├── receipt.ts                    ← ใบเสร็จยืนยันบันทึก
│   ├── debt-summary.ts
│   ├── weekly-report.ts
│   └── budget-advice.ts
│
└── types/
    ├── ai.ts                         ← ParsedRecord, BudgetContext
    └── flex.ts                       ← LINE Flex Message types
```

---

## 4. Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id          String   @id @default(cuid())
  lineUserId  String   @unique
  displayName String?
  pictureUrl  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  accounts      Account[]
  transactions  Transaction[]
  debts         DebtRecord[]
  subscriptions Subscription[]
  settings      UserSettings?

  @@index([lineUserId])
}

model UserSettings {
  id              String   @id @default(cuid())
  userId          String   @unique
  monthlyBudget   Decimal? @db.Decimal(15, 2)
  alertDaysBefore Int      @default(3)
  enableSubAlert  Boolean  @default(true)
  enableDebtAlert Boolean  @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id        String      @id @default(cuid())
  userId    String
  name      String
  type      AccountType @default(WALLET)
  balance   Decimal     @default(0) @db.Decimal(15, 2)
  currency  String      @default("THB")
  color     String?
  isDefault Boolean     @default(false)
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@unique([userId, name])
  @@index([userId])
  @@index([userId, isDefault])
}

enum AccountType {
  WALLET
  SAVINGS
  INVESTMENT
  CREDIT
}

model Transaction {
  id         String          @id @default(cuid())
  userId     String
  accountId  String
  type       TransactionType
  amount     Decimal         @db.Decimal(15, 2)
  category   String
  note       String?
  aiMetadata Json?
  recordedAt DateTime        @default(now())
  createdAt  DateTime        @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  account Account @relation(fields: [accountId], references: [id])

  @@index([userId, recordedAt(sort: Desc)])
  @@index([userId, type])
  @@index([accountId, recordedAt(sort: Desc)])
  @@index([userId, category])
}

enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
  DEBT_LEND
  DEBT_REPAY
}

model DebtRecord {
  id          String    @id @default(cuid())
  userId      String
  personName  String
  direction   DebtDir
  originalAmt Decimal   @db.Decimal(15, 2)
  paidAmt     Decimal   @default(0) @db.Decimal(15, 2)
  note        String?
  dueDate     DateTime?
  isPaid      Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isPaid])
  @@index([userId, personName])
}

enum DebtDir {
  WE_LENT
  WE_OWE
}

model Subscription {
  id            String    @id @default(cuid())
  userId        String
  name          String
  amount        Decimal   @db.Decimal(15, 2)
  billingDay    Int
  accountId     String?
  category      String    @default("Subscription")
  isActive      Boolean   @default(true)
  lastAlertedAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive])
  @@index([userId, billingDay])
}
```

**Schema Rules:**
- ใช้ `Decimal @db.Decimal(15,2)` เสมอสำหรับยอดเงิน ห้ามใช้ `Float`
- `Transaction.aiMetadata Json?` เก็บ raw Claude output + confidence score ไว้ debug
- Multi-tenant ด้วย `lineUserId` ทุก query ต้อง scope ด้วย userId เสมอ
- `Account.isDefault` คือ default account ที่เดียว — ห้ามมี defaultAccountId ซ้ำที่อื่น
- `UserSettings` สร้างพร้อม User (upsert ตอน onboard) ด้วยค่า default ทั้งหมด

---

## 5. System Prompt (Claude API)

ใช้ใน `src/lib/claude.ts` เป็น system message พร้อม `cache_control`:

```
คุณคือ "Cooper" ผู้จัดการส่วนตัวและเลขาคู่ใจที่อบอุ่น นุ่มนวล และเชื่อถือได้
บุคลิก: สุภาพ ใส่ใจ ให้กำลังใจเสมอ ไม่ตัดสิน ไม่ตึงเครียด พูดตรงแต่นุ่มนวลเหมือนเพื่อนสนิทที่ไว้ใจได้

════════════════════════════════════════
โหมด 1 · RECORD MODE
════════════════════════════════════════
ทริกเกอร์: ผู้ใช้ส่งข้อความที่มีตัวเลขเงิน หรือระบุการยืม/รับ/จ่าย

กฎเหล็ก:
- ต้องพ่นเฉพาะ JSON เท่านั้น ห้ามมีข้อความนำหน้า ห้ามมี Markdown อื่น
- ห้ามคิดเลขหักยอดเด็ดขาด ใส่แค่ amount ที่ผู้ใช้พูดถึงเท่านั้น
- ถ้าข้อมูลไม่ครบให้เดาอย่างสมเหตุสมผล (default account = "กระเป๋าหลัก")

JSON Schema:
{
  "action": "RECORD",
  "type": "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_LEND" | "DEBT_REPAY",
  "amount": number,
  "account_name": string,
  "category": string,
  "note": string,
  "debt_person": string | null,
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

ตัวอย่าง:
  Input:  "ชาบู 499 กสิกร"
  Output: {"action":"RECORD","type":"EXPENSE","amount":499,"account_name":"กสิกร","category":"อาหาร","note":"ชาบู","debt_person":null,"confidence":"HIGH"}

  Input:  "บอยยืมค่าข้าว 150"
  Output: {"action":"RECORD","type":"DEBT_LEND","amount":150,"account_name":"กระเป๋าหลัก","category":"ยืมเงิน","note":"ค่าข้าว","debt_person":"บอย","confidence":"HIGH"}

════════════════════════════════════════
โหมด 2 · BUDGET CHECK MODE
════════════════════════════════════════
ทริกเกอร์: "ซื้อได้ไหม", "งบพอไหม", "อยากได้...", "กิเลสพุ่ง"

พฤติกรรม:
- รับ context จากระบบที่ inject มา: ยอดเงินปัจจุบัน + รายจ่ายเฉลี่ย 30 วัน + ยอดหนี้ค้างชำระ
- วิเคราะห์จากตัวเลขที่ได้รับเท่านั้น ห้ามประมาณเอง
- ตอบภาษาไทย อบอุ่น มีตรรกะ ไม่สั่งสอน
- เสนอทางเลือก 2-3 แนวทางถ้าเป็นไปได้

════════════════════════════════════════
โหมด 3 · REPORT MODE
════════════════════════════════════════
ทริกเกอร์: ระบบ (cron) ส่ง raw stats มาให้

พฤติกรรม:
- นำตัวเลขสถิติที่ได้รับมาเขียนรายงานสไตล์ Cooper อบอุ่น ให้เกรด A-D
- ให้กำลังใจก่อนเสมอ แม้ตัวเลขไม่ดี
- ห้ามสร้างตัวเลขเอง ใช้เฉพาะที่ระบบ inject มาเท่านั้น

════════════════════════════════════════
กฎที่ใช้ทุกโหมด:
- ห้ามคิดเลขหักยอด/บวกยอดใดๆ → หน้าที่ของ Prisma Transaction เท่านั้น
- ตอบภาษาไทยเสมอ (นอกจาก JSON ใน RECORD MODE)
- tone: เหมือน Cooper แมวที่รอบรู้และเป็นห่วงเจ้าของ
```

---

## 6. Design System — Cozy Minimal

### Color Palette

| Token | Hex | ใช้กับ |
|---|---|---|
| `--text-primary` | `#2C2C2E` | ข้อความหลัก (Charcoal) |
| `--text-secondary` | `#8E8E93` | label, subtext |
| `--color-income` | `#7EA184` | เงินเข้า / บัญชีออม |
| `--bg-income` | `#EAF0EB` | พื้นหลังป้าย income |
| `--color-expense` | `#C58B7E` | รายจ่ายตามใจ |
| `--bg-expense` | `#F7ECE9` | พื้นหลังป้าย expense |
| `--color-transfer` | `#6B8296` | โอน / Investment |
| `--bg-transfer` | `#EAF0F6` | พื้นหลังป้าย transfer |

**ห้ามใช้:** สีแดง/เขียวสะท้อนแสง, สีอิ่มตัวสูง, gradient ทุกชนิด
**Base:** ขาวมุก `#F9F9FB`, เทาอ่อน `#F2F2F7`

### Tone of Voice
- อบอุ่น · นุ่มนวล · สุภาพ · ไม่ตึงเครียด
- ให้กำลังใจก่อนเสมอ แม้ข้อมูลไม่ดี
- เหมือนเพื่อนสนิทที่ไว้ใจได้ ไม่ใช่แอปการเงินน่ากลัว

---

## 7. Environment Variables

```bash
# .env.local

# Supabase — ต้องมีทั้งคู่
DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres"

# LINE OA
LINE_CHANNEL_SECRET="xxxx"
LINE_CHANNEL_ACCESS_TOKEN="xxxx"

# LINE LIFF
NEXT_PUBLIC_LIFF_APP_ID="xxxx-xxxxxxx"

# Claude API
ANTHROPIC_API_KEY="sk-ant-xxxx"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="random-secret-สำหรับ protect cron endpoints"
```

**กฎ DATABASE_URL:** ต้องมี `?pgbouncer=true` เสมอ — Vercel serverless ใช้ connection pooler
**กฎ DIRECT_URL:** ใช้เฉพาะ `prisma migrate deploy` เท่านั้น ไม่ใช้ runtime

---

## 8. Webhook Orchestration Flow

```
LINE Message Received
        │
        ▼
verify X-Line-Signature (HMAC-SHA256)
→ ถ้าไม่ผ่าน: return 401 ทันที
        │
        ▼
upsert User + UserSettings (lineUserId)
        │
        ▼
detect intent
        │
        ├─── RECORD ──────→ parser.ts (Claude)
        │                        │
        │                   validate JSON
        │                   valid → $transaction → Flex receipt → replyMessage
        │                   invalid → retry 1x → fallback reply
        │
        ├─── BUDGET CHECK → ดึง balance/stats จาก DB
        │                   → budget-check.ts (Claude + inject context)
        │                   → Flex advice → replyMessage
        │
        ├─── QUERY ────────→ ดึง Transactions/Debts จาก DB → Flex statement
        │
        └─── UNKNOWN ──────→ Cooper ขอข้อมูลเพิ่มสุภาพๆ
```

**Webhook Rules:**
- ต้อง return HTTP 200 ภายใน 30 วินาที ไม่งั้น LINE ส่งซ้ำ
- ห้าม throw uncaught error ออกจาก webhook เด็ดขาด
- ใช้ `waitUntil` แยก heavy task ออกจาก response loop

---

## 9. Prompt Caching (ลด API Cost ~80%)

```typescript
// src/lib/claude.ts
system: [{
  type: "text",
  text: SYSTEM_PROMPT,
  cache_control: { type: "ephemeral" }, // ← ต้องมีเสมอ
}]
```

---

## 10. Error Handling Pattern

```
Claude คืน bad JSON → retry 1 ครั้ง → ถ้ายังผิด → Cooper ขอ clarification
ห้าม crash webhook → LINE retry วนไม่หยุด
ทุก service function return null แทน throw เมื่อ recover ได้
```

---

## 11. LINE Reply vs Push

| | `replyMessage` | `pushMessage` |
|---|---|---|
| ใช้เมื่อ | ตอบกลับ user message | Cron / แจ้งเตือนเอง |
| ต้นทุน | ฟรี | เสีย messaging credit |
| ข้อจำกัด | reply token หมดใน 30 วิ | ส่งได้ตลอด |

---

## 12. Vercel Cron (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/morning-alert", "schedule": "0 2 * * *" },
    { "path": "/api/cron/weekly-report", "schedule": "0 17 * * 0" }
  ]
}
```

- `0 2 * * *` = 09:00 AM ไทย (UTC+7)
- `0 17 * * 0` = 00:00 AM วันจันทร์ไทย
- ทุก cron endpoint ตรวจ `Authorization: Bearer CRON_SECRET`

---

## 13. Dev Commands

```bash
# Install additional deps
npm i @prisma/client @line/bot-sdk @anthropic-ai/sdk
npm i -D prisma

# Prisma
npx prisma init
npx prisma migrate dev --name init
npx prisma migrate deploy   # production only

# Dev
npm run dev

# Test LINE Webhook locally
ngrok http 3000
```

---

## 14. Core Features Checklist

- [ ] LINE Webhook Handler + signature verification
- [ ] AI Parser (RECORD MODE) → Structured JSON
- [ ] Prisma Transaction: INCOME / EXPENSE
- [ ] Prisma Transaction: DEBT_LEND / DEBT_REPAY
- [ ] Prisma Transaction: TRANSFER
- [ ] LINE Flex Message: Receipt card
- [ ] Budget Check (inject balance → Claude)
- [ ] Subscription Reminder (Cron)
- [ ] Debt Reminder (Cron)
- [ ] Weekly Report + Financial Score (Cron)
- [ ] LIFF Dashboard: Statement list
- [ ] LIFF Dashboard: Radar Chart (Chart.js)
