import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { SearchBar } from "@/components/search-bar";
import { SortHeader } from "@/components/sort-header";

import { documentStatusClass } from "@/lib/status-style";

const PAGE_SIZE = 50;

export default async function CreditNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const SORT_FIELDS: Record<string, string> = {
    number: "number",
    issueDate: "issueDate",
    status: "status",
  };
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const sortKey = sp.sort && SORT_FIELDS[sp.sort] ? sp.sort : null;
  const orderBy = sortKey
    ? { [SORT_FIELDS[sortKey]]: dir }
    : { updatedAt: "desc" as const };

  const docs = await prisma.document.findMany({
    where: {
      type: "CREDIT_NOTE",
      deletedAt: null,
      ...(q && {
        OR: [
          { number: { contains: q, mode: "insensitive" as const } },
          { client: { companyName: { contains: q, mode: "insensitive" as const } } },
          { client: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      }),
    },
    include: { client: true, originalDocument: true, lineItems: true },
    orderBy,
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("CreditNotes.title")}
        description="Opravný daňový doklad — issued from an invoice detail page."
      />
      <p className="hidden">
        Opravný daňový doklad — issued from an invoice's detail page.
      </p>

      <div className="mb-4">
        <SearchBar pathname="/credit-notes" initialQ={q} placeholder={t("Common.searchByNumberOrClient")} />
      </div>

      {docs.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("CreditNotes.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">
                  <SortHeader label={t("Quotes.fields.number")} field="number" />
                </th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("Common.original")}</th>
                <th className="px-4 py-2 text-left">
                  <SortHeader label={t("Common.issueDate")} field="issueDate" />
                </th>
                <th className="px-4 py-2 text-right">{t("Common.total")}</th>
                <th className="px-4 py-2 text-left">
                  <SortHeader label={t("Common.status")} field="status" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <ClickableRow key={d.id} href={`/credit-notes/${d.id}`}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/credit-notes/${d.id}`} className="hover:underline">
                        {d.number ?? (
                          <span className="italic text-muted-foreground">{t("Common.draft")}</span>
                        )}
                      </Link>
                      {d.title && (
                        <div className="text-xs font-normal text-muted-foreground line-clamp-1">
                          {d.title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {clientDisplayName(d.client)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.originalDocument?.number ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {d.currency}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${documentStatusClass(d.status === "PAID" ? "APPLIED" : d.status)}`}
                      >
                        {t(`CreditNotes.status.${d.status === "PAID" ? "APPLIED" : d.status}`)}
                      </span>
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
