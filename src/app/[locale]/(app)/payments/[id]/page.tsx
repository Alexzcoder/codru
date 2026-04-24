import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { deletePayment } from "../actions";

export default async function PaymentDetailPage({
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
    include: {
      client: true,
      loggedBy: { select: { name: true } },
      allocations: { include: { document: true } },
    },
  });
  if (!payment) notFound();

  const deleteBound = async () => {
    "use server";
    await deletePayment(id);
  };

  const totalAllocated = payment.allocations.reduce(
    (s, a) => s + Number.parseFloat(a.amount.toString()),
    0,
  );
  const remainder = Number.parseFloat(payment.amount.toString()) - totalAllocated;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-xs text-neutral-500">
        <Link href="/payments" className="hover:underline">
          {t("Payments.title")}
        </Link>
        {" · "}
        <Link href={`/clients/${payment.client.id}`} className="hover:underline">
          {clientDisplayName(payment.client)}
        </Link>
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {payment.amount.toString()} {payment.currency}
        </h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
          {t(`Payments.methods.${payment.method}`)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/payments/${id}/edit`}>
          <Button variant="outline" size="sm">
            {t("Settings.edit")}
          </Button>
        </Link>
        <a href={`/payments/${id}/receipt.pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            {t("Payments.actions.downloadReceipt")} ↗
          </Button>
        </a>
        <form action={deleteBound}>
          <Button type="submit" variant="outline" size="sm">
            {t("Payments.actions.delete")}
          </Button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Info label={t("Payments.fields.date")}>{payment.date.toISOString().slice(0, 10)}</Info>
        <Info label={t("Payments.fields.currency")}>{payment.currency}</Info>
        <Info label={t("Payments.fields.reference")}>{payment.reference ?? "—"}</Info>
        <Info label="Logged by">{payment.loggedBy.name}</Info>
      </div>

      {payment.notes && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            {t("Payments.fields.notes")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{payment.notes}</p>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left">Invoice</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Allocated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {payment.allocations.map((a) => {
              const href =
                a.document.type === "ADVANCE_INVOICE"
                  ? `/advance-invoices/${a.document.id}`
                  : `/final-invoices/${a.document.id}`;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={href} className="hover:underline">
                      {a.document.number ?? "(draft)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600 text-xs">
                    {a.document.type === "ADVANCE_INVOICE" ? "Advance" : "Final"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {a.amount.toString()} {payment.currency}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 text-sm">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-right text-neutral-500">
                Remainder
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {remainder.toFixed(2)} {payment.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 font-medium">{children}</p>
    </div>
  );
}
