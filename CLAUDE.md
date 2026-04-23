# CLAUDE.md

Context for future Claude sessions working on this repo.

## What this is

CRM + invoicing app for a Czech trades/construction business. Owner uses it daily; may be sold as SaaS later. Authoritative product spec is **`/mnt/c/Users/alex1/Downloads/PRD.md`** (v1.3). **Always re-read the PRD before architectural decisions.** The milestones (§26) are the build plan; do not skip ahead.

## Stack (locked in M1 — do not change without explicit discussion)

- **Next.js 16** (App Router, TypeScript) — scaffolded via `create-next-app`. Note: Next 16 renamed `src/middleware.ts` → `src/proxy.ts`. Use `proxy.ts`.
- **PostgreSQL + Prisma 6.x** — do NOT upgrade to Prisma 7 yet; it moved `datasource.url` out of schema.prisma and requires driver adapters. Revisit when Prisma 7 is mainstream (Q3 2026+).
- **Auth.js v5 (beta)** with credentials provider + `@auth/prisma-adapter`. JWT session strategy, 30-day maxAge per PRD §23.
- **Tailwind CSS v4** + **shadcn/ui** (neutral base, CSS variables). Primitives: `button`, `input`, `label`, `card`.
- **next-intl v4** for i18n. Locales: `cs` (default), `en`. Messages in `messages/{locale}.json`.
- **bcryptjs** for password hashing (cost 12).
- **zod** for input validation on server actions.
- Planned but not yet installed: `resend` (email), `react-pdf` (invoice PDFs — user wants custom component-driven layouts; do NOT switch to Puppeteer), `qrplatba` (QR platba).

## Conventions

- **Server Actions over API routes** for form handling. The only API route is `/api/auth/[...nextauth]` (required by Auth.js).
- **Always call `setRequestLocale(locale)`** at the top of server components under `[locale]/` — required by next-intl for static rendering to work.
- **Routes that hit Prisma must be dynamic.** Root layout is `force-dynamic`; keep it that way or mark child routes individually.
- **Route groups in use:**
  - `[locale]/(auth)/` — unauthenticated (login, register). Redirects to `/dashboard` if already signed in.
  - `[locale]/(app)/` — authenticated. Layout redirects to `/login` if no session.
- **Czech fiscal correctness is a legal requirement, not a polish item.** Gapless numbering (§21.3), reverse charge (§21.5), credit notes (§13), 10-year retention (§21.1). Get review before changing these.
- **Numbers assigned at Unsent → Sent transition, not at draft creation.** This is explicit in PRD §3 and §21.3.

## Dev setup

1. Copy `.env.example` → `.env.local`, fill in `AUTH_SECRET` (`openssl rand -base64 32`).
2. Start Postgres: `docker run --name crm-pg -e POSTGRES_PASSWORD=crm -e POSTGRES_USER=crm -e POSTGRES_DB=crm -p 5432:5432 -d postgres:16`
3. `npx prisma migrate dev --name init` (creates tables).
4. `npm run dev` → http://localhost:3000
5. First visitor registers → becomes owner → guided onboarding.

## Build / check

- Typecheck: `npx tsc --noEmit`
- Build: `npx next build`
- Lint: `npm run lint`

## Current milestone

**M1 — scaffold + auth + i18n + onboarding. Shipped on 2026-04-24.**

Next up: **M2 — company profiles (multi) + settings structure + user management (invites, deactivation, password resets).**

## Open questions from PRD §28 (answer before the relevant milestone)

- Exchange rate fetch: daily cron vs on-demand — needed by M6.
- Reference PDFs of professional Czech invoices — needed by M7.
- Exact color scheme, logo, footer legal wording — needed by M7.
- Pohoda XML target version (ask accountant) — needed by M16.
