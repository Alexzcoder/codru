import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdvanceInvoiceForm } from "../../advance-invoice-form";
import { updateAdvanceInvoice } from "../../actions";
import { loadAdvanceFormData } from "../../load-form-data";
import type { EditorLine } from "../../../quotes/line-items-editor";

export default async function EditAdvanceInvoicePage({
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
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!doc || doc.type !== "ADVANCE_INVOICE" || doc.deletedAt) notFound();

  const data = await loadAdvanceFormData();
  const bound = updateAdvanceInvoice.bind(null, id);

  const lines: EditorLine[] = doc.lineItems.map((l) => ({
    name: l.name,
    description: l.description ?? "",
    quantity: l.quantity.toString(),
    unit: l.unit,
    unitPrice: l.unitPrice.toString(),
    taxRatePercent: l.taxRatePercent.toString(),
    taxMode: l.taxMode,
    lineDiscountPercent: l.lineDiscountPercent?.toString() ?? "",
    lineDiscountAmount: l.lineDiscountAmount?.toString() ?? "",
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-xs text-neutral-500">{t("AdvanceInvoices.title")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {doc.number ?? t("Quotes.draftBadge")}
      </h1>
      <div className="mt-8">
        <AdvanceInvoiceForm
          initial={{
            clientId: doc.clientId,
            jobId: doc.jobId,
            sourceQuoteId: doc.sourceQuoteId,
            companyProfileId: doc.companyProfileId,
            documentTemplateId: doc.documentTemplateId,
            currency: doc.currency,
            locale: doc.locale,
            issueDate: doc.issueDate,
            taxPointDate: doc.taxPointDate,
            dueDate: doc.dueDate ?? undefined,
            reverseCharge: doc.reverseCharge,
            advanceAmountMode: doc.advanceAmountMode,
            advanceAmountPercent: doc.advanceAmountPercent?.toString() ?? null,
            advanceAmountFixed: doc.advanceAmountFixed?.toString() ?? null,
            notesInternal: doc.notesInternal,
            notesToClient: doc.notesToClient,
            lines,
          }}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          quotes={data.quoteSummaries}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={bound}
          isDraft={doc.status === "UNSENT"}
          defaultLineName={t("AdvanceInvoices.defaultLineName")}
        />
      </div>
    </div>
  );
}
