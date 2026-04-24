import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { runDueRecurrences } from "@/lib/recurrence";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  // Fire due rules lazily (throttled inside the function).
  await runDueRecurrences();

  const rules = await prisma.recurrenceRule.findMany({
    orderBy: { nextRunAt: "asc" },
    include: { _count: { select: { jobs: true, expenses: true, documents: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Recurring.title")}</h1>
        <Link href="/recurring/new">
          <Button size="sm">{t("Recurring.new")}</Button>
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("Recurring.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.name")}</th>
                <th className="px-4 py-2 text-left">Kind</th>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.frequency")}</th>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.nextRunAt")}</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Instances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rules.map((r) => {
                const ended = r.endDate && r.endDate.getTime() < Date.now();
                const status = ended
                  ? "ended"
                  : r.pausedAt
                    ? "paused"
                    : "active";
                const instances =
                  r._count.jobs + r._count.expenses + r._count.documents;
                return (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/recurring/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {t(`Recurring.kinds.${r.targetKind}`)}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {t(`Recurring.frequency.${r.frequency}`)}
                      {r.frequency === "CUSTOM" ? ` (${r.customDays}d)` : ""}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {r.nextRunAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          status === "active"
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                            : status === "paused"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                              : "rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700"
                        }
                      >
                        {t(`Recurring.status.${status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{instances}</td>
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
