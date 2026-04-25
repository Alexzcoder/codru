import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { SearchBar } from "@/components/search-bar";
import { Plus, Download } from "lucide-react";

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  UNSENT: "bg-secondary text-secondary-foreground",
  SENT: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  PAID_PENDING_COMPLETION: "bg-amber-100 text-amber-800",
};

export default async function AdvanceInvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const docs = await prisma.document.findMany({
    where: {
      type: "ADVANCE_INVOICE",
      deletedAt: null,
      ...(q && {
        OR: [
          { number: { contains: q, mode: "insensitive" as const } },
          { client: { companyName: { contains: q, mode: "insensitive" as const } } },
          { client: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      }),
    },
    include: { client: true, lineItems: true },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("AdvanceInvoices.title")}
        description={`${docs.length} ${docs.length === 1 ? "advance invoice" : "advance invoices"}`}
        actions={
          <>
            <a href={`/advance-invoices/export.xlsx${q ? `?q=${encodeURIComponent(q)}` : ""}`} download>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download size={14} /> Excel
              </Button>
            </a>
            <Link href="/advance-invoices/new">
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t("AdvanceInvoices.new")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <SearchBar pathname="/advance-invoices" initialQ={q} placeholder="Search by number or client…" />
      </div>

      {docs.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("AdvanceInvoices.empty")}</p>
          <Link href="/advance-invoices/new" className="mt-4 inline-block">
            <Button size="sm">{t("AdvanceInvoices.new")}</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("AdvanceInvoices.fields.number")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("Quotes.fields.issueDate")}</th>
                <th className="px-4 py-2 text-left">{t("AdvanceInvoices.fields.dueDate")}</th>
                <th className="px-4 py-2 text-right">{t("Quotes.totals.totalGross")}</th>
                <th className="px-4 py-2 text-left">Status</th>
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
                  <ClickableRow key={d.id} href={`/advance-invoices/${d.id}`}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/advance-invoices/${d.id}`} className="hover:underline">
                        {d.number ?? (
                          <span className="italic text-muted-foreground">
                            {t("Quotes.draftBadge")}
                          </span>
                        )}
                      </Link>
                      {d.title && (
                        <div className="text-xs font-normal text-muted-foreground line-clamp-1">
                          {d.title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{clientDisplayName(d.client)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.issueDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.dueDate?.toISOString().slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {totals.totalGross} {d.currency}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[d.status] ?? "bg-secondary"}`}
                      >
                        {t(`AdvanceInvoices.status.${d.status}`)}
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
