-- HandoverStatus / HandoverAcceptance enums
CREATE TYPE "HandoverStatus" AS ENUM ('DRAFT', 'COMPLETED');
CREATE TYPE "HandoverAcceptance" AS ENUM (
    'PENDING',
    'ACCEPTED_NO_ISSUES',
    'ACCEPTED_WITH_RESERVATIONS',
    'NOT_ACCEPTED',
    'CLIENT_ABSENT'
);

-- HandoverProtocol
CREATE TABLE "HandoverProtocol" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "jobId" TEXT,
    "sourceQuoteId" TEXT,
    "number" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "siteAddress" TEXT,
    "zakazkaNumber" TEXT,
    "contractorName" TEXT,
    "leaderName" TEXT,
    "realizationDate" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "vicepraceDone" BOOLEAN NOT NULL DEFAULT false,
    "vicepraceDescription" TEXT,
    "vicepracePrice" TEXT,
    "vicepraceConsent" TEXT,
    "usedMaterials" TEXT,
    "wasteGenerated" TEXT,
    "wasteRemoved" TEXT,
    "photosBeforeTaken" BOOLEAN NOT NULL DEFAULT false,
    "photosDuringTaken" BOOLEAN NOT NULL DEFAULT false,
    "photosAfterTaken" BOOLEAN NOT NULL DEFAULT false,
    "acceptance" "HandoverAcceptance" NOT NULL DEFAULT 'PENDING',
    "clientReservations" TEXT,
    "contractorNote" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverProtocol_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HandoverProtocol_workspaceId_idx" ON "HandoverProtocol"("workspaceId");
CREATE INDEX "HandoverProtocol_clientId_idx" ON "HandoverProtocol"("clientId");
CREATE INDEX "HandoverProtocol_jobId_idx" ON "HandoverProtocol"("jobId");
CREATE INDEX "HandoverProtocol_sourceQuoteId_idx" ON "HandoverProtocol"("sourceQuoteId");
CREATE INDEX "HandoverProtocol_status_idx" ON "HandoverProtocol"("status");

ALTER TABLE "HandoverProtocol" ADD CONSTRAINT "HandoverProtocol_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandoverProtocol" ADD CONSTRAINT "HandoverProtocol_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HandoverProtocol" ADD CONSTRAINT "HandoverProtocol_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HandoverProtocol" ADD CONSTRAINT "HandoverProtocol_sourceQuoteId_fkey"
    FOREIGN KEY ("sourceQuoteId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HandoverProtocol" ADD CONSTRAINT "HandoverProtocol_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HandoverProtocolItem
CREATE TABLE "HandoverProtocolItem" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" TEXT,
    "unit" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notCompleted" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverProtocolItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HandoverProtocolItem_protocolId_position_key"
    ON "HandoverProtocolItem"("protocolId", "position");
CREATE INDEX "HandoverProtocolItem_protocolId_idx" ON "HandoverProtocolItem"("protocolId");

ALTER TABLE "HandoverProtocolItem" ADD CONSTRAINT "HandoverProtocolItem_protocolId_fkey"
    FOREIGN KEY ("protocolId") REFERENCES "HandoverProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
