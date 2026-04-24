-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UNSENT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'PAID_PENDING_COMPLETION', 'APPLIED');

-- CreateEnum
CREATE TYPE "AdvanceAmountMode" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UNSENT',
    "number" TEXT,
    "yearSeries" INTEGER,
    "numberSeq" INTEGER,
    "clientId" TEXT NOT NULL,
    "jobId" TEXT,
    "companyProfileId" TEXT NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "exchangeRateToCzk" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "locale" "UserLocale" NOT NULL DEFAULT 'cs',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "taxPointDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "validUntilDate" TIMESTAMP(3),
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "documentDiscountPercent" DECIMAL(5,2),
    "documentDiscountAmount" DECIMAL(12,2),
    "notesInternal" TEXT,
    "notesToClient" TEXT,
    "totalsOverride" BOOLEAN NOT NULL DEFAULT false,
    "totalNetOverride" DECIMAL(12,2),
    "totalTaxOverride" DECIMAL(12,2),
    "totalGrossOverride" DECIMAL(12,2),
    "advanceAmountMode" "AdvanceAmountMode",
    "advanceAmountPercent" DECIMAL(5,2),
    "advanceAmountFixed" DECIMAL(12,2),
    "sourceQuoteId" TEXT,
    "originalDocumentId" TEXT,
    "creditReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLineItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxRatePercent" DECIMAL(5,2) NOT NULL,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'NET',
    "lineDiscountPercent" DECIMAL(5,2),
    "lineDiscountAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSeries" (
    "type" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("type","year")
);

-- CreateTable
CREATE TABLE "PdfSnapshot" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_jobId_idx" ON "Document"("jobId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_issueDate_idx" ON "Document"("issueDate");

-- CreateIndex
CREATE INDEX "Document_sourceQuoteId_idx" ON "Document"("sourceQuoteId");

-- CreateIndex
CREATE INDEX "Document_originalDocumentId_idx" ON "Document"("originalDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_type_yearSeries_numberSeq_key" ON "Document"("type", "yearSeries", "numberSeq");

-- CreateIndex
CREATE INDEX "DocumentLineItem_documentId_idx" ON "DocumentLineItem"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLineItem_documentId_position_key" ON "DocumentLineItem"("documentId", "position");

-- CreateIndex
CREATE INDEX "PdfSnapshot_documentId_idx" ON "PdfSnapshot"("documentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfSnapshot" ADD CONSTRAINT "PdfSnapshot_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
