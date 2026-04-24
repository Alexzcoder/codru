import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/client-display";
import type {
  ClientOption,
  JobOption,
  CompanyOption,
  TemplateChoice,
} from "./quote-form";
import type { TemplateOption, TaxRateOption } from "./line-items-editor";

export async function loadQuoteFormData() {
  const [clients, jobs, companyProfiles, documentTemplates, itemTemplates, taxRates] =
    await Promise.all([
      prisma.client.findMany({
        where: { deletedAt: null, anonymizedAt: null },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.job.findMany({
        select: { id: true, title: true, clientId: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.companyProfile.findMany({
        where: { archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
      prisma.documentTemplate.findMany({
        where: { archivedAt: null, type: "QUOTE" },
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

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    name: clientDisplayName(c),
    hasIco: !!c.ico,
    preferredCurrency: c.preferredCurrency,
    defaultLanguage: c.defaultLanguage,
  }));

  const jobOptions: JobOption[] = jobs;

  const companyOptions: CompanyOption[] = companyProfiles.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const templateChoices: TemplateChoice[] = documentTemplates.map((t) => ({
    id: t.id,
    name: t.name,
  }));

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

  return {
    clientOptions,
    jobOptions,
    companyOptions,
    templateChoices,
    templateOptions,
    taxRateOptions,
  };
}
