-- M18 — workspace customization. Adds Workspace.featureFlags so individual
-- workspaces can opt into optional features (events, scheduler), and creates
-- the Event / EventTodo / EventAttachment tables that the IE Public Speaking
-- demo workspace will use.

BEGIN;

-- 1. Per-workspace feature toggles
ALTER TABLE "Workspace"
  ADD COLUMN "featureFlags" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Auto-enable for the IE Public Speaking workspace if it already exists.
-- No-op for fresh installs — the OWNER can toggle it from settings later.
UPDATE "Workspace"
   SET "featureFlags" = '{"events":true,"scheduler":true}'::jsonb
 WHERE slug = 'ie-public-speaking';

-- 3. EventTodoStatus enum
CREATE TYPE "EventTodoStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- 4. Event
CREATE TABLE "Event" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3),
  "location"    TEXT,
  "notes"       TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Event_workspaceId_startDate_idx" ON "Event"("workspaceId", "startDate");
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. EventTodo
CREATE TABLE "EventTodo" (
  "id"          TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "status"      "EventTodoStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "position"    INTEGER NOT NULL DEFAULT 0,
  "assigneeId"  TEXT,
  "dueDate"     TIMESTAMP(3),
  "doneAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventTodo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventTodo_eventId_position_idx" ON "EventTodo"("eventId", "position");
CREATE INDEX "EventTodo_assigneeId_idx" ON "EventTodo"("assigneeId");
ALTER TABLE "EventTodo"
  ADD CONSTRAINT "EventTodo_eventId_fkey"    FOREIGN KEY ("eventId")    REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventTodo_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id")  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. EventAttachment
CREATE TABLE "EventAttachment" (
  "id"           TEXT NOT NULL,
  "eventId"      TEXT NOT NULL,
  "filename"     TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "sizeBytes"    INTEGER NOT NULL,
  "kind"         "AttachmentKind" NOT NULL,
  "path"         TEXT NOT NULL,
  "caption"      TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventAttachment_eventId_createdAt_idx" ON "EventAttachment"("eventId", "createdAt");
ALTER TABLE "EventAttachment"
  ADD CONSTRAINT "EventAttachment_eventId_fkey"      FOREIGN KEY ("eventId")      REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
