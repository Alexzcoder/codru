-- Per-import audit row used to power the Undo button on /clients/import.
-- clientIds and jobIds are JSON arrays of cuid strings; we don't FK them
-- because the rows already cascade through Client/Job + we want the batch
-- to remain readable even after manual deletes.

CREATE TABLE "ImportBatch" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "filename"    TEXT,
  "clientIds"   JSONB NOT NULL DEFAULT '[]'::jsonb,
  "jobIds"      JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "undoneAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_workspaceId_createdAt_idx"
  ON "ImportBatch"("workspaceId", "createdAt");

ALTER TABLE "ImportBatch"
  ADD CONSTRAINT "ImportBatch_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
