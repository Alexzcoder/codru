-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('NET', 'GROSS');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "unitId" TEXT NOT NULL,
    "defaultQuantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "defaultCost" DECIMAL(12,2),
    "defaultMarkupPercent" DECIMAL(5,2),
    "defaultUnitPrice" DECIMAL(12,2) NOT NULL,
    "defaultTaxRateId" TEXT NOT NULL,
    "defaultTaxMode" "TaxMode" NOT NULL DEFAULT 'NET',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE INDEX "ItemTemplate_categoryId_idx" ON "ItemTemplate"("categoryId");

-- CreateIndex
CREATE INDEX "ItemTemplate_archivedAt_idx" ON "ItemTemplate"("archivedAt");

-- AddForeignKey
ALTER TABLE "ItemTemplate" ADD CONSTRAINT "ItemTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTemplate" ADD CONSTRAINT "ItemTemplate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTemplate" ADD CONSTRAINT "ItemTemplate_defaultTaxRateId_fkey" FOREIGN KEY ("defaultTaxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
