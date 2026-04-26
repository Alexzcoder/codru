import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalInvoiceForm } from "../final-invoice-form";
import { createFinalInvoice } from "../actions";
import { loadFinalInvoiceFormData } from "../load-form-data";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { loadJobSitePhotos } from "@/lib/job-photos";

export default async function NewFinalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromQuote?: string; fromJob?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  await seedDefaults(workspace.id);
  const t = await getTranslations();
  const { fromQuote, fromJob } = await searchParams;

  const data = await loadFinalInvoiceFormData(workspace.id);
  if (data.clientOptions.length === 0) redirect("/clients/new");

  let initial: Parameters<typeof FinalInvoiceForm>[0]["initial"] | undefined;
  let seededJobId: string | null = null;
  if (fromQuote) {
    const quote = await prisma.document.findFirst({ where: { id: fromQuote, workspaceId: workspace.id } });
    if (quote) {
      initial = {
        clientId: quote.clientId,
        jobId: quote.jobId ?? undefined,
        sourceQuoteId: quote.id,
        currency: quote.currency,
        locale: quote.locale,
      };
      seededJobId = quote.jobId;
    }
  } else if (fromJob) {
    const job = await prisma.job.findFirst({ where: { id: fromJob, workspaceId: workspace.id } });
    if (job) {
      initial = {
        clientId: job.clientId,
        jobId: job.id,
      };
      seededJobId = job.id;
    }
  }
  const seededPhotos = seededJobId ? await loadJobSitePhotos(seededJobId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <BackLink href="/final-invoices" label={t("FinalInvoices.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("FinalInvoices.new")}</h1>
      <div className="mt-8">
        <FinalInvoiceForm
          initial={initial}
          initialPhotos={seededPhotos}
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
