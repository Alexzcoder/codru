import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";
import { PageHeader } from "@/components/page-header";
import { Plus } from "lucide-react";

const PAGE_SIZE = 50;

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const payments = await prisma.payment.findMany({
    include: { client: true, allocations: true, loggedBy: { select: { name: true } } },
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
                <tr key={p.id} className="hover:bg-secondary/40">
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
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                    {p.allocations.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
