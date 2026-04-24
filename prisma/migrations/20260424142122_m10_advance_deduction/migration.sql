-- CreateTable
CREATE TABLE "AdvanceDeduction" (
    "finalInvoiceId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceDeduction_pkey" PRIMARY KEY ("finalInvoiceId","advanceId")
);

-- CreateIndex
CREATE INDEX "AdvanceDeduction_advanceId_idx" ON "AdvanceDeduction"("advanceId");

-- AddForeignKey
ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_finalInvoiceId_fkey" FOREIGN KEY ("finalInvoiceId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
