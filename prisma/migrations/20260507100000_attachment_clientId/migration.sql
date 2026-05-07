-- Allow Attachments to anchor to a Client (currently job-only). At least
-- one of jobId/clientId must be set; enforced in code since a two-table
-- "exactly one" FK constraint isn't expressible in standard SQL.

ALTER TABLE "Attachment" ALTER COLUMN "jobId" DROP NOT NULL;
ALTER TABLE "Attachment" ADD COLUMN "clientId" TEXT;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_clientId_createdAt_idx"
  ON "Attachment"("clientId", "createdAt");
