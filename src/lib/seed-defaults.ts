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
}
