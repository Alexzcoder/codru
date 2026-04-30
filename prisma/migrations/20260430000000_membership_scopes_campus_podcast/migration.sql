-- Tight demo cut for IE Public Speaking:
--   * per-member scopes (custom roles like "Event Officer")
--   * Campus enum on Event + new PodcastEpisode entity
--   * disable standard CRM tabs on the IE workspace, keep events/scheduler/podcast on
-- Standard workspaces are unaffected — opt-in only.

BEGIN;

-- 1. Membership scopes (empty array = sees every tab; non-empty = restricted)
ALTER TABLE "Membership"
  ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Campus enum + Event.campus
CREATE TYPE "Campus" AS ENUM ('MADRID', 'SEGOVIA', 'BOTH');

ALTER TABLE "Event"
  ADD COLUMN "campus" "Campus" NOT NULL DEFAULT 'BOTH';
CREATE INDEX "Event_workspaceId_campus_idx" ON "Event"("workspaceId", "campus");

-- 3. PodcastEpisode
CREATE TABLE "PodcastEpisode" (
  "id"            TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "guestName"     TEXT,
  "recordingDate" TIMESTAMP(3),
  "publishDate"   TIMESTAMP(3),
  "audioUrl"      TEXT,
  "showNotes"     TEXT,
  "campus"        "Campus" NOT NULL DEFAULT 'BOTH',
  "archivedAt"    TIMESTAMP(3),
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PodcastEpisode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PodcastEpisode_workspaceId_recordingDate_idx"
  ON "PodcastEpisode"("workspaceId", "recordingDate");
ALTER TABLE "PodcastEpisode"
  ADD CONSTRAINT "PodcastEpisode_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PodcastEpisode_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Re-shape IE Public Speaking flags: standard sections OFF, club sections ON.
-- Match by name OR slug to be tolerant of "ie-public-speaking-club" etc.
UPDATE "Workspace"
   SET "featureFlags" = "featureFlags"
     || '{"clients":false,"jobs":false,"calendar":false,"documents":false,"money":false,"recurring":false,"events":true,"scheduler":true,"podcast":true}'::jsonb
 WHERE slug LIKE 'ie-public-speaking%' OR name ILIKE '%public speaking%';

COMMIT;
