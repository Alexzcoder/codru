import { prisma } from "./prisma";

// Seed default tax rates and item categories on first-use of the settings page.
// PRD §2.4: owner onboarding confirms these pre-filled defaults.
// Idempotent: safe to call multiple times.
export async function seedDefaults() {
  const taxCount = await prisma.taxRate.count();
  if (taxCount === 0) {
    await prisma.taxRate.createMany({
      data: [
        { label: "21 %", percent: 21, isDefault: true },
        { label: "12 %", percent: 12 },
        { label: "0 %", percent: 0 },
      ],
    });
  }

  const catCount = await prisma.itemCategory.count();
  if (catCount === 0) {
    await prisma.itemCategory.createMany({
      data: [
        { name: "Labor" },
        { name: "Materials" },
        { name: "Travel" },
        { name: "Diagnosis" },
      ],
    });
  }

  const unitCount = await prisma.unit.count();
  if (unitCount === 0) {
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

  const expCatCount = await prisma.expenseCategory.count();
  if (expCatCount === 0) {
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

  const templateCount = await prisma.documentTemplate.count();
  if (templateCount === 0) {
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
}
