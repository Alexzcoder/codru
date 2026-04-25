-- CreateTable
CREATE TABLE "EmailIdentity" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "documentId" TEXT,
    "sentById" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "ccAddress" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromDisplayName" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'cs',
    "draftedByClaude" BOOLEAN NOT NULL DEFAULT false,
    "resendMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailIdentity_companyProfileId_archivedAt_idx" ON "EmailIdentity"("companyProfileId", "archivedAt");

-- CreateIndex
CREATE INDEX "EmailLog_documentId_createdAt_idx" ON "EmailLog"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_sentById_createdAt_idx" ON "EmailLog"("sentById", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailIdentity" ADD CONSTRAINT "EmailIdentity_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "EmailIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
