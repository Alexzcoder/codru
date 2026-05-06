-- AI document import: session of N PDFs reviewed/approved as a batch.

CREATE TABLE "DocumentImportSession" (
  "id"           TEXT NOT NULL,
  "workspaceId"  TEXT NOT NULL,
  "createdById"  TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',
  "costCapUsd"   DECIMAL(8,4) NOT NULL DEFAULT 5.00,
  "totalCostUsd" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "model"        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "finalizedAt"  TIMESTAMP(3),
  CONSTRAINT "DocumentImportSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentImportSession_workspaceId_createdAt_idx"
  ON "DocumentImportSession"("workspaceId", "createdAt");

ALTER TABLE "DocumentImportSession"
  ADD CONSTRAINT "DocumentImportSession_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentImportSession_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentImportItem" (
  "id"                TEXT NOT NULL,
  "sessionId"         TEXT NOT NULL,
  "filename"          TEXT NOT NULL,
  "storedPath"        TEXT NOT NULL,
  "mimeType"          TEXT NOT NULL,
  "sizeBytes"         INT  NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'PENDING',
  "parseError"        TEXT,
  "parsed"            JSONB,
  "matchedClientId"   TEXT,
  "matchConfidence"   DECIMAL(4,3),
  "createdDocumentId" TEXT,
  "costUsd"           DECIMAL(8,4) NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentImportItem_sessionId_idx" ON "DocumentImportItem"("sessionId");

ALTER TABLE "DocumentImportItem"
  ADD CONSTRAINT "DocumentImportItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DocumentImportSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentImportItem_matchedClientId_fkey"
    FOREIGN KEY ("matchedClientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentImportItem_createdDocumentId_fkey"
    FOREIGN KEY ("createdDocumentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
