import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PaymentForm } from "../../payment-form";
import { updatePayment } from "../../actions";
import { loadPaymentFormData } from "../../load-form-data";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!payment) notFound();

  const { clientChoices, openInvoices } = await loadPaymentFormData({
    includePaymentId: id,
  });
  const bound = updatePayment.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs text-muted-foreground">{t("Payments.title")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {payment.date.toISOString().slice(0, 10)} · {payment.amount.toString()}{" "}
        {payment.currency}
      </h1>
      <div className="mt-8">
        <PaymentForm
          initial={{
            clientId: payment.clientId,
            date: payment.date,
            method: payment.method,
            amount: payment.amount.toString(),
            currency: payment.currency,
            reference: payment.reference,
            notes: payment.notes,
            allocations: payment.allocations.map((a) => ({
              documentId: a.documentId,
              amount: a.amount.toString(),
            })),
          }}
          clients={clientChoices}
          openInvoices={openInvoices}
          action={bound}
        />
      </div>
    </div>
  );
}
