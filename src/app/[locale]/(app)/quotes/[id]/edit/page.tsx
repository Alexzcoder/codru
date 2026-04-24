import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { QuoteForm } from "../../quote-form";
import { updateQuote } from "../../actions";
import { loadQuoteFormData } from "../../load-form-data";
import type { EditorLine } from "../../line-items-editor";

export default async function EditQuotePage({
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
  if (!doc || doc.type !== "QUOTE" || doc.deletedAt) notFound();

  const data = await loadQuoteFormData();
  const bound = updateQuote.bind(null, id);

  const editorLines: EditorLine[] = doc.lineItems.map((l) => ({
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
      <p className="text-xs text-neutral-500">{t("Quotes.title")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {doc.number ?? t("Quotes.draftBadge")}
      </h1>
      <div className="mt-8">
        <QuoteForm
          initial={{
            clientId: doc.clientId,
            jobId: doc.jobId,
            companyProfileId: doc.companyProfileId,
            documentTemplateId: doc.documentTemplateId,
            currency: doc.currency,
            locale: doc.locale,
            issueDate: doc.issueDate,
            validUntilDate: doc.validUntilDate ?? undefined,
            reverseCharge: doc.reverseCharge,
            documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
            documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
            notesInternal: doc.notesInternal,
            notesToClient: doc.notesToClient,
            lines: editorLines,
          }}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={bound}
          isDraft={doc.status === "UNSENT"}
        />
      </div>
    </div>
  );
}
