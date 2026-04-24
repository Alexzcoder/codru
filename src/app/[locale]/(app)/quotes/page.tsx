import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import type { DocumentStatus } from "@prisma/client";

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  UNSENT: "bg-neutral-200 text-neutral-700",
  SENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-amber-100 text-amber-800",
};

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();
  const sp = await searchParams;

  const allowed = ["UNSENT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
  const statusFilter = allowed.includes(sp.status as (typeof allowed)[number])
    ? (sp.status as DocumentStatus)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    type: "QUOTE" as const,
    deletedAt: null,
    ...(statusFilter && { status: statusFilter }),
  };

  const [quotes, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { client: true, lineItems: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.document.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Quotes.title")}</h1>
        <Link href="/quotes/new">
          <Button size="sm">{t("Quotes.newQuote")}</Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {(["ALL", ...allowed] as const).map((s) => {
          const active = (s === "ALL" && !statusFilter) || s === statusFilter;
          return (
            <Link
              key={s}
              href={s === "ALL" ? "/quotes" : `/quotes?status=${s}`}
              className={
                active
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-white"
                  : "rounded-full bg-neutral-100 px-3 py-1 text-neutral-700 hover:bg-neutral-200"
              }
            >
              {s === "ALL" ? "All" : t(`Quotes.status.${s}`)}
            </Link>
          );
        })}
      </div>

      {quotes.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("Quotes.empty")}</p>
          <Link href="/quotes/new" className="mt-4 inline-block">
            <Button size="sm">{t("Quotes.newQuote")}</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.number")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.issueDate")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.validUntil")}</th>
                <th className="px-4 py-2 text-right">{t("Quotes.totals.totalGross")}</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {quotes.map((q) => {
                const totals = calculateDocument({
                  lines: q.lineItems.map((l) => ({
                    quantity: l.quantity.toString(),
                    unitPrice: l.unitPrice.toString(),
                    taxRatePercent: l.taxRatePercent.toString(),
                    taxMode: l.taxMode,
                    lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
                    lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
                  })),
                  documentDiscountPercent: q.documentDiscountPercent?.toString() ?? null,
                  documentDiscountAmount: q.documentDiscountAmount?.toString() ?? null,
                  reverseCharge: q.reverseCharge,
                });
                return (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/quotes/${q.id}`} className="hover:underline">
                        {q.number ?? (
                          <span className="italic text-neutral-400">
                            {t("Quotes.draftBadge")}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {clientDisplayName(q.client)}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {q.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {q.validUntilDate?.toISOString().slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {q.currency}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[q.status] ?? "bg-neutral-100"}`}
                      >
                        {t(`Quotes.status.${q.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-neutral-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={{ pathname: "/quotes", query: { ...sp, page: page - 1 } }}>
                <Button variant="outline" size="sm">
                  Prev
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={{ pathname: "/quotes", query: { ...sp, page: page + 1 } }}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
