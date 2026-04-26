import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { SearchBar } from "@/components/search-bar";
import { Plus } from "lucide-react";

const PAGE_SIZE = 50;

export default async function PaymentsPage({
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

  const payments = await prisma.payment.findMany({
    where: q
      ? {
          OR: [
            { client: { companyName: { contains: q, mode: "insensitive" as const } } },
            { client: { fullName: { contains: q, mode: "insensitive" as const } } },
            { notes: { contains: q, mode: "insensitive" as const } },
            { reference: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined,
    include: {
      client: true,
      allocations: { include: { document: { select: { id: true, type: true, number: true } } } },
      loggedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Payments.title")}
        description={`${payments.length} ${payments.length === 1 ? "payment" : "payments"}`}
        actions={
          <Link href="/payments/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> {t("Payments.new")}
            </Button>
          </Link>
        }
      />

      <div className="mb-4">
        <SearchBar pathname="/payments" initialQ={q} placeholder="Search by client, reference, note…" />
      </div>

      {payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("Payments.empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t("Payments.fields.date")}</th>
                <th className="px-4 py-3 text-left">{t("Payments.fields.client")}</th>
                <th className="px-4 py-3 text-left">{t("Payments.fields.method")}</th>
                <th className="px-4 py-3 text-right">{t("Payments.fields.amount")}</th>
                <th className="px-4 py-3 text-center">Allocations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <ClickableRow key={p.id} href={`/payments/${p.id}`}>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link href={`/payments/${p.id}`} className="hover:underline">
                      {p.date.toISOString().slice(0, 10)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{clientDisplayName(p.client)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t(`Payments.methods.${p.method}`)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {p.amount.toString()} {p.currency}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.allocations.length === 0
                      ? "—"
                      : p.allocations
                          .map((a) => a.document.number ?? "draft")
                          .join(", ")}
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
