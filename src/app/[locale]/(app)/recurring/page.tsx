import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { runDueRecurrences } from "@/lib/recurrence";
import { PageHeader } from "@/components/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { Plus } from "lucide-react";

export default async function RecurringPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const sp = await searchParams;

  // Fire due rules lazily (throttled inside the function).
  await runDueRecurrences();

  // Kind filter: business (JOB + INVOICE — both bill the client) vs expense
  // (overhead / supplier bills). Default to business so the operator's main
  // billing rules don't get mixed with admin overhead.
  const kind = sp.kind === "expense" ? "expense" : sp.kind === "all" ? "all" : "business";
  const ruleKindFilter =
    kind === "business"
      ? { targetKind: { in: ["JOB", "INVOICE"] as ("JOB" | "INVOICE")[] } }
      : kind === "expense"
        ? { targetKind: "EXPENSE" as const }
        : {};

  const rules = await prisma.recurrenceRule.findMany({
    where: { workspaceId: workspace.id, ...ruleKindFilter },
    orderBy: { nextRunAt: "asc" },
    include: { _count: { select: { jobs: true, expenses: true, documents: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Recurring.title")}
        description={`${rules.length} ${rules.length === 1 ? "rule" : "rules"}`}
        actions={
          <Link href="/recurring/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> {t("Recurring.new")}
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {(
          [
            { key: "business", label: "Jobs & Invoices" },
            { key: "expense", label: t("Expenses.title") },
            { key: "all", label: t("Common.all") },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "business" ? "/recurring" : `/recurring?kind=${tab.key}`}
            className={
              kind === tab.key
                ? "rounded-full bg-primary px-3 py-1 text-white"
                : "rounded-full bg-secondary px-3 py-1 text-foreground hover:bg-neutral-200"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rules.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("Recurring.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.name")}</th>
                <th className="px-4 py-2 text-left">Kind</th>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.frequency")}</th>
                <th className="px-4 py-2 text-left">{t("Recurring.fields.nextRunAt")}</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Instances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <ClickableRow key={r.id} href={`/recurring/${r.id}`}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/recurring/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {t(`Recurring.kinds.${r.targetKind}`)}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {t(`Recurring.frequency.${r.frequency}`)}
                      {r.frequency === "CUSTOM" ? ` (${r.customDays}d)` : ""}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.nextRunAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          status === "active"
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                            : status === "paused"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                              : "rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-foreground"
                        }
                      >
                        {t(`Recurring.status.${status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{instances}</td>
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
