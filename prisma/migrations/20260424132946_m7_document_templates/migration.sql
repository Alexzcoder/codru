-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTE', 'ADVANCE_INVOICE', 'FINAL_INVOICE', 'CREDIT_NOTE');

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "companyProfileId" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    "fontChoice" TEXT NOT NULL DEFAULT 'Roboto',
    "headerPosition" TEXT NOT NULL DEFAULT 'TOP',
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showSignature" BOOLEAN NOT NULL DEFAULT true,
    "showQrPlatba" BOOLEAN NOT NULL DEFAULT true,
    "showReverseChargeNote" BOOLEAN NOT NULL DEFAULT true,
    "customHeaderText" TEXT,
    "customFooterText" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplate_type_isDefault_idx" ON "DocumentTemplate"("type", "isDefault");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
