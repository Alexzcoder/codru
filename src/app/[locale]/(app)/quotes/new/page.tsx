import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { seedDefaults } from "@/lib/seed-defaults";
import { QuoteForm } from "../quote-form";
import { createQuote } from "../actions";
import { loadQuoteFormData } from "../load-form-data";
import { redirect } from "next/navigation";

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();

  const data = await loadQuoteFormData();

  // Need at least one client and one company profile to create a quote.
  if (data.clientOptions.length === 0) redirect("/clients/new");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Quotes.newQuote")}</h1>
      <div className="mt-8">
        <QuoteForm
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
