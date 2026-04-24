import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdvanceInvoiceForm } from "../advance-invoice-form";
import { createAdvanceInvoice } from "../actions";
import { loadAdvanceFormData } from "../load-form-data";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";

export default async function NewAdvanceInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromQuote?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();
  const { fromQuote } = await searchParams;

  const data = await loadAdvanceFormData();
  if (data.clientOptions.length === 0) redirect("/clients/new");

  // Optional preset from a source quote.
  const source = fromQuote
    ? await prisma.document.findUnique({
        where: { id: fromQuote },
        include: { lineItems: true },
      })
    : null;

  const initial = source
    ? {
        clientId: source.clientId,
        jobId: source.jobId,
        sourceQuoteId: source.id,
        currency: source.currency,
        locale: source.locale,
        advanceAmountMode: "PERCENT" as const,
        advanceAmountPercent: "30",
      }
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <BackLink href="/advance-invoices" label={t("AdvanceInvoices.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("AdvanceInvoices.new")}</h1>
      <div className="mt-8">
        <AdvanceInvoiceForm
          initial={initial}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          quotes={data.quoteSummaries}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={createAdvanceInvoice}
          isDraft={true}
          defaultLineName={t("AdvanceInvoices.defaultLineName")}
        />
      </div>
    </div>
  );
}
