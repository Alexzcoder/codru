-- M17 — multi-tenancy: introduce Workspace + Membership, scope every business
-- table under a workspace, and backfill all existing rows into a default
-- "VENIREX" workspace. The existing global OWNER user becomes OWNER of that
-- workspace; everyone else becomes MEMBER.
--
-- Layout: type + tables → seed default workspace + memberships → add
-- nullable workspaceId columns + backfill → NOT NULL + FKs/indexes →
-- rework legacy unique/PK constraints (NumberSeries, Document, *Category).

BEGIN;

-- ──────────────────────────────────────────────────────────
-- 1. New types + tables
-- ──────────────────────────────────────────────────────────

CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "Workspace" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE TABLE "Membership" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "role"        "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Membership_userId_fkey"      FOREIGN KEY ("userId")      REFERENCES "User"("id")      ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────
-- 2. Seed default workspace + memberships
-- ──────────────────────────────────────────────────────────

INSERT INTO "Workspace" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('ws_default_venirex', 'VENIREX', 'venirex', NOW(), NOW());

INSERT INTO "Membership" ("id", "workspaceId", "userId", "role", "joinedAt")
SELECT
  'mem_' || u.id,
  'ws_default_venirex',
  u.id,
  CASE WHEN u.role = 'OWNER' THEN 'OWNER'::"WorkspaceRole" ELSE 'MEMBER'::"WorkspaceRole" END,
  NOW()
FROM "User" u;

-- ──────────────────────────────────────────────────────────
-- 3. Add workspaceId (NULL) to every scoped table
-- ──────────────────────────────────────────────────────────

ALTER TABLE "Invite"          ADD COLUMN "workspaceId" TEXT, ADD COLUMN "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "CompanyProfile"  ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ItemCategory"    ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ExpenseCategory" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CustomFieldDef"  ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Client"          ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Job"             ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Document"        ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Payment"         ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Expense"         ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CalendarEvent"   ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "RecurrenceRule"  ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Attachment"      ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContactLog"      ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AuditLog"        ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "EmailLog"        ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AiCall"          ADD COLUMN "workspaceId" TEXT;       -- stays nullable
ALTER TABLE "NumberSeries"    ADD COLUMN "workspaceId" TEXT;

-- ──────────────────────────────────────────────────────────
-- 4. Backfill every existing row into the default workspace
-- ──────────────────────────────────────────────────────────

UPDATE "Invite"          SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "CompanyProfile"  SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "ItemCategory"    SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "ExpenseCategory" SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "CustomFieldDef"  SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Client"          SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Job"             SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Document"        SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Payment"         SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Expense"         SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "CalendarEvent"   SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "RecurrenceRule"  SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "Attachment"      SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "ContactLog"      SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "AuditLog"        SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "EmailLog"        SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "AiCall"          SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;
UPDATE "NumberSeries"    SET "workspaceId" = 'ws_default_venirex' WHERE "workspaceId" IS NULL;

-- ──────────────────────────────────────────────────────────
-- 5. Lock workspaceId NOT NULL + add FKs + indexes (NumberSeries handled below)
-- ──────────────────────────────────────────────────────────

ALTER TABLE "Invite"          ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CompanyProfile"  ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ItemCategory"    ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ExpenseCategory" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CustomFieldDef"  ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Client"          ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Job"             ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Document"        ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Payment"         ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Expense"         ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CalendarEvent"   ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "RecurrenceRule"  ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Attachment"      ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContactLog"      ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "AuditLog"        ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EmailLog"        ALTER COLUMN "workspaceId" SET NOT NULL;
-- AiCall.workspaceId stays nullable per design (AI calls can predate any workspace).

ALTER TABLE "Invite"          ADD CONSTRAINT "Invite_workspaceId_fkey"          FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyProfile"  ADD CONSTRAINT "CompanyProfile_workspaceId_fkey"  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemCategory"    ADD CONSTRAINT "ItemCategory_workspaceId_fkey"    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDef"  ADD CONSTRAINT "CustomFieldDef_workspaceId_fkey"  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client"          ADD CONSTRAINT "Client_workspaceId_fkey"          FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job"             ADD CONSTRAINT "Job_workspaceId_fkey"             FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document"        ADD CONSTRAINT "Document_workspaceId_fkey"        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment"         ADD CONSTRAINT "Payment_workspaceId_fkey"         FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense"         ADD CONSTRAINT "Expense_workspaceId_fkey"         FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"   ADD CONSTRAINT "CalendarEvent_workspaceId_fkey"   FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule"  ADD CONSTRAINT "RecurrenceRule_workspaceId_fkey"  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment"      ADD CONSTRAINT "Attachment_workspaceId_fkey"      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactLog"      ADD CONSTRAINT "ContactLog_workspaceId_fkey"      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"        ADD CONSTRAINT "AuditLog_workspaceId_fkey"        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailLog"        ADD CONSTRAINT "EmailLog_workspaceId_fkey"        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCall"          ADD CONSTRAINT "AiCall_workspaceId_fkey"          FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invite_workspaceId_idx"         ON "Invite"("workspaceId");
CREATE INDEX "CompanyProfile_workspaceId_idx" ON "CompanyProfile"("workspaceId");
CREATE INDEX "ItemCategory_workspaceId_idx"   ON "ItemCategory"("workspaceId");
CREATE INDEX "ExpenseCategory_workspaceId_idx" ON "ExpenseCategory"("workspaceId");
CREATE INDEX "CustomFieldDef_workspaceId_idx" ON "CustomFieldDef"("workspaceId");
CREATE INDEX "Client_workspaceId_idx"         ON "Client"("workspaceId");
CREATE INDEX "Job_workspaceId_idx"            ON "Job"("workspaceId");
CREATE INDEX "Document_workspaceId_idx"       ON "Document"("workspaceId");
CREATE INDEX "Payment_workspaceId_date_idx"   ON "Payment"("workspaceId", "date");
CREATE INDEX "Expense_workspaceId_date_idx"   ON "Expense"("workspaceId", "date");
CREATE INDEX "CalendarEvent_workspaceId_idx"  ON "CalendarEvent"("workspaceId");
CREATE INDEX "RecurrenceRule_workspaceId_idx" ON "RecurrenceRule"("workspaceId");
CREATE INDEX "Attachment_workspaceId_idx"     ON "Attachment"("workspaceId");
CREATE INDEX "ContactLog_workspaceId_idx"     ON "ContactLog"("workspaceId");
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "EmailLog_workspaceId_createdAt_idx" ON "EmailLog"("workspaceId", "createdAt");
CREATE INDEX "AiCall_workspaceId_createdAt_idx" ON "AiCall"("workspaceId", "createdAt");

-- ──────────────────────────────────────────────────────────
-- 6. Rework legacy unique / primary key constraints to include workspaceId
-- ──────────────────────────────────────────────────────────

-- ItemCategory.name: unique within workspace, not globally
DROP INDEX IF EXISTS "ItemCategory_name_key";
CREATE UNIQUE INDEX "ItemCategory_workspaceId_name_key" ON "ItemCategory"("workspaceId", "name");

-- ExpenseCategory.name: unique within workspace
DROP INDEX IF EXISTS "ExpenseCategory_name_key";
CREATE UNIQUE INDEX "ExpenseCategory_workspaceId_name_key" ON "ExpenseCategory"("workspaceId", "name");

-- CustomFieldDef.label: unique within workspace
DROP INDEX IF EXISTS "CustomFieldDef_label_key";
CREATE UNIQUE INDEX "CustomFieldDef_workspaceId_label_key" ON "CustomFieldDef"("workspaceId", "label");

-- Document numbering: gapless per workspace + type + year
DROP INDEX IF EXISTS "Document_type_yearSeries_numberSeq_key";
CREATE UNIQUE INDEX "Document_workspaceId_type_yearSeries_numberSeq_key"
  ON "Document"("workspaceId", "type", "yearSeries", "numberSeq");

-- NumberSeries: change PK from (type, year) to (workspaceId, type, year)
ALTER TABLE "NumberSeries" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "NumberSeries" DROP CONSTRAINT IF EXISTS "NumberSeries_pkey";
ALTER TABLE "NumberSeries" ADD CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("workspaceId", "type", "year");
ALTER TABLE "NumberSeries"
  ADD CONSTRAINT "NumberSeries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
