import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CreditNoteForm } from "../../credit-note-form";
import { updateCreditNote } from "../../actions";
import { loadCreditNoteFormData } from "../../load-form-data";
import { negateLines } from "../../negate-lines";
import { clientDisplayName } from "@/lib/client-display";
import type { EditorLine } from "../../../quotes/line-items-editor";

export default async function EditCreditNotePage({
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
      client: true,
      lineItems: { orderBy: { position: "asc" } },
      originalDocument: { include: { lineItems: true } },
    },
  });
  if (!doc || doc.type !== "CREDIT_NOTE" || doc.deletedAt || !doc.originalDocument) notFound();

  const data = await loadCreditNoteFormData();
  const bound = updateCreditNote.bind(null, id);

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
      <p className="text-xs text-neutral-500">{t("CreditNotes.title")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {doc.number ?? t("Quotes.draftBadge")}
      </h1>
      <div className="mt-8">
        <CreditNoteForm
          initial={{
            originalDocumentId: doc.originalDocumentId ?? undefined,
            creditReason: doc.creditReason,
            companyProfileId: doc.companyProfileId,
            documentTemplateId: doc.documentTemplateId,
            currency: doc.currency,
            locale: doc.locale,
            issueDate: doc.issueDate,
            taxPointDate: doc.taxPointDate,
            reverseCharge: doc.reverseCharge,
            notesInternal: doc.notesInternal,
            notesToClient: doc.notesToClient,
            lines,
          }}
          original={{
            id: doc.originalDocument.id,
            number: doc.originalDocument.number,
            clientName: clientDisplayName(doc.client),
            currency: doc.originalDocument.currency,
            locale: doc.originalDocument.locale,
            reverseCharge: doc.originalDocument.reverseCharge,
            negatedLines: negateLines(doc.originalDocument.lineItems),
          }}
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
