import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FinalInvoiceForm } from "../../final-invoice-form";
import { updateFinalInvoice } from "../../actions";
import { loadFinalInvoiceFormData } from "../../load-form-data";
import { BackLink } from "@/components/back-link";
import type { EditorLine } from "../../../quotes/line-items-editor";

export default async function EditFinalInvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { position: "asc" } },
      advanceDeductions: true,
    },
  });
  if (!doc || doc.type !== "FINAL_INVOICE" || doc.deletedAt) notFound();

  const data = await loadFinalInvoiceFormData({ excludeAdvanceIdsUsedOn: id });
  const bound = updateFinalInvoice.bind(null, id);

  // Strip stored deduction lines so the form rebuilds them from the checkbox selection.
  const lines: EditorLine[] = doc.lineItems
    .map((l) => ({
      name: l.name,
      description: l.description ?? "",
      quantity: l.quantity.toString(),
      unit: l.unit,
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? "",
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? "",
    }))
    // heuristic: deduction lines have negative unitPrice and name starting with "Advance " or "Záloha "
    .filter(
      (l) =>
        !(
          Number.parseFloat(l.unitPrice) < 0 &&
          /^(Advance |Záloha )/i.test(l.name)
        ),
    );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <BackLink href={`/final-invoices/${id}`} label={doc.number ?? t("Quotes.draftBadge")} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {doc.number ?? t("Quotes.draftBadge")}
      </h1>
      <div className="mt-8">
        <FinalInvoiceForm
          initial={{
            clientId: doc.clientId,
            jobId: doc.jobId ?? undefined,
            sourceQuoteId: doc.sourceQuoteId,
            companyProfileId: doc.companyProfileId,
            documentTemplateId: doc.documentTemplateId,
            currency: doc.currency,
            locale: doc.locale,
            issueDate: doc.issueDate,
            taxPointDate: doc.taxPointDate,
            dueDate: doc.dueDate ?? undefined,
            reverseCharge: doc.reverseCharge,
            documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
            documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
            title: doc.title,
            notesInternal: doc.notesInternal,
            notesToClient: doc.notesToClient,
            lines,
            deductedAdvanceIds: doc.advanceDeductions.map((d) => d.advanceId),
          }}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          quotes={data.quoteChoices}
          availableAdvances={data.availableAdvances}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          deductionLabelTemplate={t("FinalInvoices.fields.deductionLine", { number: "{number}", rate: "{rate}" })}
          action={bound}
          isDraft={doc.status === "UNSENT"}
        />
      </div>
    </div>
  );
}
