-- CreateEnum
CREATE TYPE "RecurrenceTarget" AS ENUM ('JOB', 'EXPENSE', 'INVOICE');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "recurrenceRuleId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "recurrenceRuleId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "recurrenceRuleId" TEXT;

-- CreateTable
CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetKind" "RecurrenceTarget" NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "customDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "daysInAdvance" INTEGER NOT NULL DEFAULT 0,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurrenceRule_nextRunAt_pausedAt_idx" ON "RecurrenceRule"("nextRunAt", "pausedAt");

-- CreateIndex
CREATE INDEX "RecurrenceRule_targetKind_idx" ON "RecurrenceRule"("targetKind");

-- CreateIndex
CREATE INDEX "Expense_recurrenceRuleId_idx" ON "Expense"("recurrenceRuleId");

-- CreateIndex
CREATE INDEX "Job_recurrenceRuleId_idx" ON "Job"("recurrenceRuleId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
