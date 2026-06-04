# Cooper — AI Personal Financial Butler
> ผู้จัดการส่วนตัวอัจฉริยะผ่าน LINE OA · ตั้งชื่อตามน้องแมวสุดที่รักของผู้พัฒนา

โปรเจคนี้พัฒนาด้วย Next.js 15, Prisma, และ Claude API เพื่อช่วยจัดการการเงินส่วนบุคคลผ่าน LINE

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **AI:** Claude API (Anthropic)
- **Messaging:** LINE Messaging API

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Setup environment variables in `.env` (see `.env.example` if available)

3. Run development server:
```bash
npm run dev
```

## Architectural Laws
- AI layer → Claude เท่านั้น
- DB layer → Prisma เท่านั้น
- ห้าม AI คิดเลขหักยอดเงินเอง (ต้องผ่าน Prisma $transaction)
