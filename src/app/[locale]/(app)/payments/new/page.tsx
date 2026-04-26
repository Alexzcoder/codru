import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentForm } from "../payment-form";
import { createPayment } from "../actions";
import { loadPaymentFormData } from "../load-form-data";
import { BackLink } from "@/components/back-link";

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ forInvoice?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();
  const { forInvoice } = await searchParams;

  const { clientChoices, openInvoices } = await loadPaymentFormData();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/payments" label={t("Payments.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Payments.new")}</h1>
      <div className="mt-8">
        <PaymentForm
          clients={clientChoices}
          openInvoices={openInvoices}
          preselectDocumentId={forInvoice}
          action={createPayment}
        />
      </div>
    </div>
  );
}
