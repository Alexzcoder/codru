-- Per-day numbering resets `numberSeq` to 1 each day. The legacy unique
-- constraint on (workspaceId, type, yearSeries, numberSeq) blocked the
-- second day's first document because (2026, 1) was already taken.
--
-- Switch the legal-uniqueness guard to the actual document number string,
-- which embeds the date and is the field auditors care about. `number`
-- is nullable (drafts), and Postgres treats NULLs as distinct so drafts
-- don't collide.

BEGIN;

DROP INDEX IF EXISTS "Document_workspaceId_type_yearSeries_numberSeq_key";

CREATE UNIQUE INDEX "Document_workspaceId_type_number_key"
  ON "Document" ("workspaceId", "type", "number");

COMMIT;
