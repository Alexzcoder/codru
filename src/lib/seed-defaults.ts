import { prisma } from "./prisma";

// Seed default tax rates / item categories / units / expense categories /
// document templates. Idempotent.
//
// Tax rates and units are GLOBAL (no workspaceId) — only seeded once per DB.
// ItemCategory, ExpenseCategory, DocumentTemplate are per-workspace and need
// to be seeded for each workspace the user touches. We memoize per-workspace
// success per server instance so subsequent page visits are free.
const seededWorkspaces = new Set<string>();
let seededGlobals = false;

export async function seedDefaults(workspaceId?: string): Promise<void> {
  // Globals can run regardless of workspace context.
  if (!seededGlobals) {
    await Promise.all([seedTaxRates(), seedUnits()]);
    seededGlobals = true;
  }
  if (!workspaceId) return;
  if (seededWorkspaces.has(workspaceId)) return;

  await Promise.all([
    seedCategories(workspaceId),
    seedExpenseCategories(workspaceId),
  ]);
  // Templates depend on knowing whether any company profile exists, so run last.
  await seedDocumentTemplates(workspaceId);

  seededWorkspaces.add(workspaceId);
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

async function seedCategories(workspaceId: string) {
  const count = await prisma.itemCategory.count({ where: { workspaceId } });
  if (count > 0) return;
  await prisma.itemCategory.createMany({
    data: [
      { workspaceId, name: "Labor" },
      { workspaceId, name: "Materials" },
      { workspaceId, name: "Travel" },
      { workspaceId, name: "Diagnosis" },
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

async function seedExpenseCategories(workspaceId: string) {
  const count = await prisma.expenseCategory.count({ where: { workspaceId } });
  if (count > 0) return;
  await prisma.expenseCategory.createMany({
    data: [
      { workspaceId, name: "Materials" },
      { workspaceId, name: "Fuel" },
      { workspaceId, name: "Tools" },
      { workspaceId, name: "Subcontractor" },
      { workspaceId, name: "Office" },
      { workspaceId, name: "Other" },
    ],
  });
}

async function seedDocumentTemplates(workspaceId: string) {
  // DocumentTemplate is per-CompanyProfile; only seed if no template exists yet
  // for any of the current workspace's company profiles.
  const profiles = await prisma.companyProfile.findMany({
    where: { workspaceId, archivedAt: null },
    select: { id: true, isDefault: true },
  });
  if (profiles.length === 0) return;

  const existing = await prisma.documentTemplate.count({
    where: { companyProfileId: { in: profiles.map((p) => p.id) } },
  });
  if (existing > 0) return;

  const firstCompany =
    profiles.find((p) => p.isDefault) ?? profiles[0];

  await prisma.documentTemplate.createMany({
    data: [
      { name: "Default quote",           type: "QUOTE",           companyProfileId: firstCompany.id, isDefault: true },
      { name: "Default advance invoice", type: "ADVANCE_INVOICE", companyProfileId: firstCompany.id, isDefault: true },
      { name: "Default final invoice",   type: "FINAL_INVOICE",   companyProfileId: firstCompany.id, isDefault: true },
      { name: "Default credit note",     type: "CREDIT_NOTE",     companyProfileId: firstCompany.id, isDefault: true },
    ],
  });
}
