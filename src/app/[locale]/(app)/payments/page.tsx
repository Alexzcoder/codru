import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/client-display";

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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Payments.title")}</h1>
        <Link href="/payments/new">
          <Button size="sm">{t("Payments.new")}</Button>
        </Link>
      </div>

      {payments.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("Payments.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">{t("Payments.fields.date")}</th>
                <th className="px-4 py-2 text-left">{t("Payments.fields.client")}</th>
                <th className="px-4 py-2 text-left">{t("Payments.fields.method")}</th>
                <th className="px-4 py-2 text-right">{t("Payments.fields.amount")}</th>
                <th className="px-4 py-2 text-center">Allocations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2 text-neutral-600">
                    <Link href={`/payments/${p.id}`} className="hover:underline">
                      {p.date.toISOString().slice(0, 10)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{clientDisplayName(p.client)}</td>
                  <td className="px-4 py-2 text-xs text-neutral-500">
                    {t(`Payments.methods.${p.method}`)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {p.amount.toString()} {p.currency}
                  </td>
                  <td className="px-4 py-2 text-center text-xs text-neutral-500">
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
