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
import type {
  AvailableAdvance,
  QuoteChoice,
} from "./final-invoice-form";

export async function loadFinalInvoiceFormData(opts?: {
  excludeAdvanceIdsUsedOn?: string; // final invoice id we're editing — include its own advances too
}) {
  const [
    clients,
    jobs,
    quotes,
    companyProfiles,
    templates,
    itemTemplates,
    taxRates,
    advances,
    deducted,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, anonymizedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.job.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.document.findMany({
      where: {
        type: "QUOTE",
        deletedAt: null,
        status: { in: ["SENT", "ACCEPTED"] },
      },
      select: { id: true, number: true, clientId: true, currency: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.companyProfile.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.documentTemplate.findMany({
      where: { archivedAt: null, type: "FINAL_INVOICE" },
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
    // Advances in Paid-pending-completion OR Paid — both are candidates.
    // (Spec says PPC; once paid, they're also fair game if not already deducted.)
    prisma.document.findMany({
      where: {
        type: "ADVANCE_INVOICE",
        deletedAt: null,
        status: { in: ["PAID_PENDING_COMPLETION", "PAID", "SENT", "OVERDUE"] },
      },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.advanceDeduction.findMany({
      where: opts?.excludeAdvanceIdsUsedOn
        ? { NOT: { finalInvoiceId: opts.excludeAdvanceIdsUsedOn } }
        : undefined,
      select: { advanceId: true },
    }),
  ]);

  const usedIds = new Set(deducted.map((d) => d.advanceId));

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    name: clientDisplayName(c),
    hasIco: !!c.ico,
    preferredCurrency: c.preferredCurrency,
    defaultLanguage: c.defaultLanguage,
  }));

  const quoteChoices: QuoteChoice[] = quotes;

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

  const availableAdvances: AvailableAdvance[] = advances
    .filter((a) => !usedIds.has(a.id))
    .map((a) => {
      const totals = calculateDocument({
        lines: a.lineItems.map((l) => ({
          quantity: l.quantity.toString(),
          unitPrice: l.unitPrice.toString(),
          taxRatePercent: l.taxRatePercent.toString(),
          taxMode: l.taxMode,
          lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
          lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
        })),
        documentDiscountPercent: a.documentDiscountPercent?.toString() ?? null,
        documentDiscountAmount: a.documentDiscountAmount?.toString() ?? null,
        reverseCharge: a.reverseCharge,
      });
      return {
        id: a.id,
        number: a.number,
        jobId: a.jobId,
        currency: a.currency,
        bands: totals.taxBands
          .filter((b) => b.net !== "0.00")
          .map((b) => ({ ratePercent: b.ratePercent, net: b.net })),
        totalGross: totals.totalGross,
      };
    });

  return {
    clientOptions,
    jobOptions: jobs as JobOption[],
    quoteChoices,
    availableAdvances,
    companyOptions,
    templateChoices,
    templateOptions,
    taxRateOptions,
  };
}
