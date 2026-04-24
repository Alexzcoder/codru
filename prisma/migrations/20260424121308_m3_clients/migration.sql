-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('POTENTIAL', 'ACTIVE', 'PAST', 'FAILED');

-- CreateEnum
CREATE TYPE "ContactLogType" AS ENUM ('PHONE', 'EMAIL', 'MEETING', 'SITE_VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
    "status" "ClientStatus" NOT NULL DEFAULT 'POTENTIAL',
    "companyName" TEXT,
    "ico" TEXT,
    "dic" TEXT,
    "icoOverride" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressZip" TEXT,
    "addressCountry" TEXT NOT NULL DEFAULT 'CZ',
    "notes" TEXT,
    "defaultLanguage" "UserLocale" NOT NULL DEFAULT 'cs',
    "preferredCurrency" TEXT NOT NULL DEFAULT 'CZK',
    "anonymizedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ContactLogType" NOT NULL,
    "notes" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_ico_idx" ON "Client"("ico");

-- CreateIndex
CREATE INDEX "ContactLog_clientId_date_idx" ON "ContactLog"("clientId", "date");

-- CreateIndex
CREATE INDEX "ContactLog_jobId_idx" ON "ContactLog"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_label_key" ON "CustomFieldDef"("label");

-- CreateIndex
CREATE INDEX "CustomFieldValue_fieldDefId_idx" ON "CustomFieldValue"("fieldDefId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_clientId_fieldDefId_key" ON "CustomFieldValue"("clientId", "fieldDefId");

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
