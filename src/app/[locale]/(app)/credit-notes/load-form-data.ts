import { prisma } from "@/lib/prisma";
import type {
  CompanyOption,
  TemplateChoice,
} from "../quotes/quote-form";
import type {
  TemplateOption,
  TaxRateOption,
} from "../quotes/line-items-editor";

export async function loadCreditNoteFormData(workspaceId: string) {
  const [companyProfiles, templates, itemTemplates, taxRates] = await Promise.all([
    prisma.companyProfile.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.documentTemplate.findMany({
      where: {
        archivedAt: null,
        type: "CREDIT_NOTE",
        companyProfile: { workspaceId },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.itemTemplate.findMany({
      where: { archivedAt: null },
      include: { unit: true, defaultTaxRate: true },
      orderBy: { name: "asc" },
    }),
    prisma.taxRate.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { percent: "desc" }],
    }),
  ]);

  const companyOptions: CompanyOption[] = companyProfiles.map((c) => ({ id: c.id, name: c.name }));
  const templateChoices: TemplateChoice[] = templates.map((t) => ({ id: t.id, name: t.name }));

  const templateOptions: TemplateOption[] = itemTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    defaultQuantity: t.defaultQuantity.toString(),
    unitName: t.unit.name,
    defaultUnitPrice: t.defaultUnitPrice.toString(),
    defaultTaxRatePercent: t.defaultTaxRate.percent.toString(),
    defaultTaxMode: t.defaultTaxMode,
  }));

  const taxRateOptions: TaxRateOption[] = taxRates.map((r) => ({
    id: r.id,
    label: r.label,
    percent: r.percent.toString(),
  }));

  return { companyOptions, templateChoices, templateOptions, taxRateOptions };
}
