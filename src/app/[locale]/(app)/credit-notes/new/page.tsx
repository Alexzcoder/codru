import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CreditNoteForm } from "../credit-note-form";
import { createCreditNote } from "../actions";
import { loadCreditNoteFormData } from "../load-form-data";
import { negateLines } from "../negate-lines";
import { clientDisplayName } from "@/lib/client-display";

export default async function NewCreditNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromInvoice?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();
  const { fromInvoice } = await searchParams;

  if (!fromInvoice) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("CreditNotes.new")}
        </h1>
        <p className="mt-4 text-sm text-neutral-600">
          A credit note is always issued from a sent invoice. Open a Final or
          Advance invoice and click <strong>{t("CreditNotes.new")}</strong>.
        </p>
      </div>
    );
  }

  const original = await prisma.document.findUnique({
    where: { id: fromInvoice },
    include: { client: true, lineItems: { orderBy: { position: "asc" } } },
  });
  if (!original || (original.type !== "FINAL_INVOICE" && original.type !== "ADVANCE_INVOICE")) {
    notFound();
  }

  const data = await loadCreditNoteFormData();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("CreditNotes.new")}</h1>
      <div className="mt-8">
        <CreditNoteForm
          original={{
            id: original.id,
            number: original.number,
            clientName: clientDisplayName(original.client),
            currency: original.currency,
            locale: original.locale,
            reverseCharge: original.reverseCharge,
            negatedLines: negateLines(original.lineItems),
          }}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={createCreditNote}
          isDraft={true}
        />
      </div>
    </div>
  );
}
