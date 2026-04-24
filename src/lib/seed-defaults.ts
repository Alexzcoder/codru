import { prisma } from "./prisma";

// Seed default tax rates / item categories / units / expense categories /
// document templates. Idempotent but still expensive (5 count queries).
// We memoize success per server instance so subsequent page visits are free.
let seeded = false;

export async function seedDefaults(): Promise<void> {
  if (seeded) return;

  await Promise.all([
    seedTaxRates(),
    seedCategories(),
    seedUnits(),
    seedExpenseCategories(),
  ]);
  // Templates depend on knowing whether any company profile exists, so run last.
  await seedDocumentTemplates();

  seeded = true;
}

async function seedTaxRates() {
  const count = await prisma.taxRate.count();
  if (count > 0) return;
  await prisma.taxRate.createMany({
    data: [
      { label: "21 %", percent: 21, isDefault: true },
      { label: "12 %", percent: 12 },
      { label: "0 %", percent: 0 },
    ],
  });
}

async function seedCategories() {
  const count = await prisma.itemCategory.count();
  if (count > 0) return;
  await prisma.itemCategory.createMany({
    data: [
      { name: "Labor" },
      { name: "Materials" },
      { name: "Travel" },
      { name: "Diagnosis" },
    ],
  });
}

async function seedUnits() {
  const count = await prisma.unit.count();
  if (count > 0) return;
  await prisma.unit.createMany({
    data: [
      { name: "hour" },
      { name: "m²" },
      { name: "m" },
      { name: "piece" },
      { name: "flat fee" },
    ],
  });
}

async function seedExpenseCategories() {
  const count = await prisma.expenseCategory.count();
  if (count > 0) return;
  await prisma.expenseCategory.createMany({
    data: [
      { name: "Materials" },
      { name: "Fuel" },
      { name: "Tools" },
      { name: "Subcontractor" },
      { name: "Office" },
      { name: "Other" },
    ],
  });
}

async function seedDocumentTemplates() {
  const count = await prisma.documentTemplate.count();
  if (count > 0) return;
  const firstCompany = await prisma.companyProfile.findFirst({
    where: { isDefault: true, archivedAt: null },
  });
  await prisma.documentTemplate.createMany({
    data: [
      { name: "Default quote",           type: "QUOTE",           companyProfileId: firstCompany?.id ?? null, isDefault: true },
      { name: "Default advance invoice", type: "ADVANCE_INVOICE", companyProfileId: firstCompany?.id ?? null, isDefault: true },
      { name: "Default final invoice",   type: "FINAL_INVOICE",   companyProfileId: firstCompany?.id ?? null, isDefault: true },
      { name: "Default credit note",     type: "CREDIT_NOTE",     companyProfileId: firstCompany?.id ?? null, isDefault: true },
    ],
  });
}
