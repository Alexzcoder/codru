-- Switch NumberSeries from per-year to per-day scope.
-- Old rows had (workspaceId, type, year) primary key; we migrate them to
-- dateKey = year * 10000 (so 2025 → 20250000) which is a unique sentinel
-- and won't collide with any real day's allocation in the new scheme.

BEGIN;

ALTER TABLE "NumberSeries" ADD COLUMN "dateKey" INT NOT NULL DEFAULT 0;

-- Backfill existing rows so they keep their seq counter under the new key.
UPDATE "NumberSeries" SET "dateKey" = "year" * 10000;

-- Swap the primary key.
ALTER TABLE "NumberSeries" DROP CONSTRAINT "NumberSeries_pkey";
ALTER TABLE "NumberSeries"
  ADD CONSTRAINT "NumberSeries_pkey"
    PRIMARY KEY ("workspaceId", "type", "dateKey");

COMMIT;
