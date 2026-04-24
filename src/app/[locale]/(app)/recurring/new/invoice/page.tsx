import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InvoiceRuleForm } from "./form";
import { createInvoiceRule } from "../../actions";
import { loadFinalInvoiceFormData } from "../../../final-invoices/load-form-data";

export default async function NewInvoiceRulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();

  const data = await loadFinalInvoiceFormData();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Recurring.new")} · {t("Recurring.kinds.INVOICE")}
      </h1>
      <div className="mt-8">
        <InvoiceRuleForm
          clients={data.clientOptions}
          jobs={data.jobOptions}
          companyProfiles={data.companyOptions}
          documentTemplates={data.templateChoices}
          itemTemplates={data.templateOptions}
          taxRates={data.taxRateOptions}
          action={createInvoiceRule}
        />
      </div>
    </div>
  );
}
