import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  UNSENT: "bg-secondary text-secondary-foreground",
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
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Quotes.title")}
        description={`${total} ${total === 1 ? "quote" : "quotes"}`}
        actions={
          <Link href="/quotes/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> {t("Quotes.newQuote")}
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {(["ALL", ...allowed] as const).map((s) => {
          const active = (s === "ALL" && !statusFilter) || s === statusFilter;
          return (
            <Link
              key={s}
              href={s === "ALL" ? "/quotes" : `/quotes?status=${s}`}
              className={
                active
                  ? "rounded-full bg-primary px-3 py-1 text-white"
                  : "rounded-full bg-secondary px-3 py-1 text-foreground hover:bg-neutral-200"
              }
            >
              {s === "ALL" ? "All" : t(`Quotes.status.${s}`)}
            </Link>
          );
        })}
      </div>

      {quotes.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("Quotes.empty")}</p>
          <Link href="/quotes/new" className="mt-4 inline-block">
            <Button size="sm">{t("Quotes.newQuote")}</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t("Quotes.fields.number")}</th>
                <th className="px-4 py-3 text-left">{t("Quotes.fields.client")}</th>
                <th className="px-4 py-3 text-left">{t("Quotes.fields.issueDate")}</th>
                <th className="px-4 py-3 text-left">{t("Quotes.fields.validUntil")}</th>
                <th className="px-4 py-3 text-right">{t("Quotes.totals.totalGross")}</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <ClickableRow key={q.id} href={`/quotes/${q.id}`}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/quotes/${q.id}`} className="hover:underline">
                        {q.number ?? (
                          <span className="italic text-muted-foreground">
                            {t("Quotes.draftBadge")}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {clientDisplayName(q.client)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {q.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {q.validUntilDate?.toISOString().slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals.totalGross} {q.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[q.status] ?? "bg-secondary"}`}
                      >
                        {t(`Quotes.status.${q.status}`)}
                      </span>
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
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
