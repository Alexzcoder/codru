import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  UNSENT: "bg-neutral-200 text-neutral-700",
  SENT: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export default async function FinalInvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const docs = await prisma.document.findMany({
    where: { type: "FINAL_INVOICE", deletedAt: null },
    include: { client: true, lineItems: true },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("FinalInvoices.title")}</h1>
        <Link href="/final-invoices/new">
          <Button size="sm">{t("FinalInvoices.new")}</Button>
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("FinalInvoices.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">{t("FinalInvoices.fields.number")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.issueDate")}</th>
                <th className="px-4 py-2 text-left">{t("FinalInvoices.fields.dueDate")}</th>
                <th className="px-4 py-2 text-right">{t("Quotes.totals.totalGross")}</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {docs.map((d) => {
                const totals = calculateDocument({
                  lines: d.lineItems.map((l) => ({
                    quantity: l.quantity.toString(),
                    unitPrice: l.unitPrice.toString(),
                    taxRatePercent: l.taxRatePercent.toString(),
                    taxMode: l.taxMode,
                    lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
                    lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
                  })),
                  documentDiscountPercent: d.documentDiscountPercent?.toString() ?? null,
                  documentDiscountAmount: d.documentDiscountAmount?.toString() ?? null,
                  reverseCharge: d.reverseCharge,
                });
                return (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/final-invoices/${d.id}`} className="hover:underline">
                        {d.number ?? (
                          <span className="italic text-neutral-400">
                            {t("Quotes.draftBadge")}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{clientDisplayName(d.client)}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {d.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {d.dueDate?.toISOString().slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {d.currency}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[d.status] ?? "bg-neutral-100"}`}
                      >
                        {t(`FinalInvoices.status.${d.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
