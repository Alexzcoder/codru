-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('GOOGLE_ADS', 'GOOGLE_ORGANIC', 'SKLIK', 'SEZNAM_ORGANIC', 'FACEBOOK_PAID', 'INSTAGRAM_PAID', 'META_ORGANIC', 'TIKTOK_PAID', 'TIKTOK_ORGANIC', 'WHATSAPP', 'EPOPTAVKA', 'REFERRAL', 'DIRECT', 'FLYER', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "LeadOutcome" AS ENUM ('WON', 'LOST');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "campaign" TEXT,
    "requestedService" TEXT,
    "message" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "landingPage" TEXT,
    "referrer" TEXT,
    "firstTouch" JSONB,
    "lastTouch" JSONB,
    "tier" "LeadGrade",
    "jobSize" "LeadGrade",
    "qualified" BOOLEAN,
    "offerSentAt" TIMESTAMP(3),
    "offerValue" DECIMAL(12,2),
    "outcome" "LeadOutcome",
    "revenue" DECIMAL(12,2),
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_workspaceId_submittedAt_idx" ON "Lead"("workspaceId", "submittedAt");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_campaign_idx" ON "Lead"("workspaceId", "campaign");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE INDEX "Lead_gclid_idx" ON "Lead"("gclid");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
