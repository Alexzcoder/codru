import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import type {
  ClientOption,
  JobOption,
  CompanyOption,
  TemplateChoice,
} from "../quotes/quote-form";
import type {
  TemplateOption,
  TaxRateOption,
} from "../quotes/line-items-editor";
import type { QuoteSummary } from "./advance-invoice-form";

export async function loadAdvanceFormData(workspaceId: string) {
  const [clients, jobs, quotes, companyProfiles, templates, itemTemplates, taxRates] =
    await Promise.all([
      prisma.client.findMany({
        where: { workspaceId, deletedAt: null, anonymizedAt: null },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.job.findMany({
        where: { workspaceId },
        select: { id: true, title: true, clientId: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.document.findMany({
        where: {
          workspaceId,
          type: "QUOTE",
          deletedAt: null,
          status: { in: ["SENT", "ACCEPTED"] },
        },
        include: { lineItems: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.companyProfile.findMany({
        where: { workspaceId, archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
      prisma.documentTemplate.findMany({
        where: {
          archivedAt: null,
          type: "ADVANCE_INVOICE",
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

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    name: clientDisplayName(c),
    hasIco: !!c.ico,
    preferredCurrency: c.preferredCurrency,
    defaultLanguage: c.defaultLanguage,
  }));

  const quoteSummaries: QuoteSummary[] = quotes.map((q) => {
    const totals = calculateDocument({
      lines: q.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: q.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: q.documentDiscountAmount?.toString() ?? null,
      reverseCharge: q.reverseCharge,
    });
    return {
      id: q.id,
      number: q.number,
      clientId: q.clientId,
      currency: q.currency,
      totalGross: totals.totalGross,
    };
  });

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

  return {
    clientOptions,
    jobOptions: jobs as JobOption[],
    quoteSummaries,
    companyOptions,
    templateChoices,
    templateOptions,
    taxRateOptions,
  };
}
