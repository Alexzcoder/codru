import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { seedDefaults } from "@/lib/seed-defaults";
import { QuoteForm } from "../quote-form";
import { createQuote } from "../actions";
import { loadQuoteFormData } from "../load-form-data";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { loadJobSitePhotos } from "@/lib/job-photos";

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromJob?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  await seedDefaults(workspace.id);
  const t = await getTranslations();
  const { fromJob } = await searchParams;

  const data = await loadQuoteFormData(workspace.id);

  // Need at least one client and one company profile to create a quote.
  if (data.clientOptions.length === 0) redirect("/clients/new");

  const seededJob = fromJob
    ? data.jobOptions.find((j) => j.id === fromJob)
    : undefined;
  const seededPhotos = seededJob ? await loadJobSitePhotos(seededJob.id) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <BackLink href="/quotes" label={t("Quotes.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Quotes.newQuote")}</h1>
      <div className="mt-8">
        <QuoteForm
          initial={
            seededJob
              ? {
                  clientId: seededJob.clientId,
                  jobId: seededJob.id,
                  title: seededJob.title,
                }
              : undefined
          }
          initialPhotos={seededPhotos}
          clients={data.clientOptions}
          jobs={data.jobOptions}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={createQuote}
          isDraft={true}
        />
      </div>
    </div>
  );
}
