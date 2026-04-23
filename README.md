# CRM + Invoicing

CRM and invoicing system for a Czech trades/construction business. Spec: `PRD.md` (v1.3, authoritative).

## Stack

- Next.js 16 (App Router, TypeScript) + Tailwind v4 + shadcn/ui
- PostgreSQL + Prisma 6
- Auth.js v5 (email/password, JWT sessions)
- next-intl (Czech + English)

## Local dev

```bash
# 1. Start Postgres
docker run --name crm-pg -e POSTGRES_PASSWORD=crm -e POSTGRES_USER=crm -e POSTGRES_DB=crm -p 5432:5432 -d postgres:16

# 2. Configure env
cp .env.example .env.local
# edit .env.local — set AUTH_SECRET: openssl rand -base64 32

# 3. Install + migrate
npm install
npx prisma migrate dev --name init

# 4. Run
npm run dev
```

Open http://localhost:3000. First visitor registers → becomes owner → guided onboarding.

## Status

- [x] M1 — scaffold + auth + owner flow + i18n + onboarding
- [ ] M2 — company profiles, settings, user management (invites)
- [ ] M3 — clients
- [ ] M4 — jobs + attachments
- [ ] M5 — calendar
- [ ] M6 — item templates + line items
- [ ] M7 — document templates + PDF visuals
- [ ] M8 — quotes
- [ ] M9 — advance invoices
- [ ] M10 — final invoices
- [ ] M11 — credit notes
- [ ] M12 — payments
- [ ] M13 — expenses
- [ ] M14 — recurring items
- [ ] M15 — notifications
- [ ] M16 — data export (CSV, ISDOC, Pohoda XML)
