import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalInvoiceForm } from "../final-invoice-form";
import { createFinalInvoice } from "../actions";
import { loadFinalInvoiceFormData } from "../load-form-data";
import { redirect } from "next/navigation";

export default async function NewFinalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromQuote?: string; fromJob?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();
  const { fromQuote, fromJob } = await searchParams;

  const data = await loadFinalInvoiceFormData();
  if (data.clientOptions.length === 0) redirect("/clients/new");

  let initial: Parameters<typeof FinalInvoiceForm>[0]["initial"] | undefined;
  if (fromQuote) {
    const quote = await prisma.document.findUnique({ where: { id: fromQuote } });
    if (quote) {
      initial = {
        clientId: quote.clientId,
        jobId: quote.jobId ?? undefined,
        sourceQuoteId: quote.id,
        currency: quote.currency,
        locale: quote.locale,
      };
    }
  } else if (fromJob) {
    const job = await prisma.job.findUnique({ where: { id: fromJob } });
    if (job) {
      initial = {
        clientId: job.clientId,
        jobId: job.id,
      };
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("FinalInvoices.new")}</h1>
      <div className="mt-8">
        <FinalInvoiceForm
          initial={initial}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          quotes={data.quoteChoices}
          availableAdvances={data.availableAdvances}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          deductionLabelTemplate={t("FinalInvoices.fields.deductionLine", { number: "{number}", rate: "{rate}" })}
          action={createFinalInvoice}
          isDraft={true}
        />
      </div>
    </div>
  );
}
