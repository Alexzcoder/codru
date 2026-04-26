import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PaymentForm } from "../../payment-form";
import { updatePayment } from "../../actions";
import { loadPaymentFormData } from "../../load-form-data";
import { BackLink } from "@/components/back-link";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const payment = await prisma.payment.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { allocations: true },
  });
  if (!payment) notFound();

  const { clientChoices, openInvoices } = await loadPaymentFormData(workspace.id, {
    includePaymentId: id,
  });
  const bound = updatePayment.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/payments" label={t("Payments.title")} />
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
