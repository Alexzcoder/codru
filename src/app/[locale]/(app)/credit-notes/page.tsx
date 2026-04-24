import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  UNSENT: "bg-neutral-200 text-neutral-700",
  SENT: "bg-blue-100 text-blue-800",
  APPLIED: "bg-green-100 text-green-800",
};

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const docs = await prisma.document.findMany({
    where: { type: "CREDIT_NOTE", deletedAt: null },
    include: { client: true, originalDocument: true, lineItems: true },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("CreditNotes.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Opravný daňový doklad — issued from an invoice's detail page.
      </p>

      {docs.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("CreditNotes.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-left">Original</th>
                <th className="px-4 py-2 text-left">Issue date</th>
                <th className="px-4 py-2 text-right">Total</th>
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
                  reverseCharge: d.reverseCharge,
                });
                return (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/credit-notes/${d.id}`} className="hover:underline">
                        {d.number ?? <span className="italic text-neutral-400">Draft</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {clientDisplayName(d.client)}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {d.originalDocument?.number ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {d.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {d.currency}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[d.status] ?? "bg-neutral-100"}`}
                      >
                        {t(`CreditNotes.status.${d.status === "PAID" ? "APPLIED" : d.status}`)}
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
