import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { pauseRule, resumeRule, endRule, deleteRule, runNow } from "../actions";
import { upcomingRuns } from "@/lib/recurrence";
import { BackLink } from "@/components/back-link";

export default async function RecurrenceRuleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const rule = await prisma.recurrenceRule.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 20 },
      expenses: { orderBy: { date: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!rule) notFound();

  const ended = rule.endDate && rule.endDate.getTime() < Date.now();
  const status = ended ? "ended" : rule.pausedAt ? "paused" : "active";
  const upcoming = upcomingRuns(rule, 90);

  const pauseBound = async () => { "use server"; await pauseRule(id); };
  const resumeBound = async () => { "use server"; await resumeRule(id); };
  const endBound = async () => { "use server"; await endRule(id); };
  const deleteBound = async () => { "use server"; await deleteRule(id); };
  const runBound = async () => { "use server"; await runNow(id); };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/recurring" label={t("Recurring.title")} />
      <p className="text-xs text-muted-foreground">
        {t(`Recurring.kinds.${rule.targetKind}`)}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
        <span
          className={
            status === "active"
              ? "rounded-full bg-green-100 px-3 py-1 text-xs text-green-800"
              : status === "paused"
                ? "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
                : "rounded-full bg-neutral-200 px-3 py-1 text-xs text-foreground"
          }
        >
          {t(`Recurring.status.${status}`)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={runBound}>
          <Button type="submit" size="sm">
            {t("Recurring.actions.runNow")}
          </Button>
        </form>
        {!rule.pausedAt && !ended && (
          <form action={pauseBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Recurring.actions.pause")}
            </Button>
          </form>
        )}
        {rule.pausedAt && !ended && (
          <form action={resumeBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Recurring.actions.resume")}
            </Button>
          </form>
        )}
        {!ended && (
          <form action={endBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Recurring.actions.end")}
            </Button>
          </form>
        )}
        <form action={deleteBound}>
          <Button type="submit" variant="outline" size="sm">
            {t("Recurring.actions.delete")}
          </Button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4 text-sm">
        <Info label={t("Recurring.fields.frequency")}>
          {t(`Recurring.frequency.${rule.frequency}`)}
          {rule.frequency === "CUSTOM" ? ` (${rule.customDays}d)` : ""}
        </Info>
        <Info label={t("Recurring.fields.startDate")}>
          {rule.startDate.toISOString().slice(0, 10)}
        </Info>
        <Info label={t("Recurring.fields.endDate")}>
          {rule.endDate ? rule.endDate.toISOString().slice(0, 10) : "—"}
        </Info>
        <Info label={t("Recurring.fields.nextRunAt")}>
          {rule.nextRunAt.toISOString().slice(0, 10)}
        </Info>
        <Info label={t("Recurring.fields.daysInAdvance")}>{rule.daysInAdvance}</Info>
        <Info label={t("Recurring.fields.autoGenerate")}>
          {rule.autoGenerate ? "yes" : "no"}
        </Info>
        <Info label={t("Recurring.fields.lastRunAt")}>
          {rule.lastRunAt ? rule.lastRunAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
        </Info>
        {rule.lastError && (
          <Info label={t("Recurring.fields.lastError")}>
            <span className="text-red-600 text-xs">{rule.lastError}</span>
          </Info>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Upcoming (next 90 days)</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {upcoming.map((d) => (
              <li
                key={d.toISOString()}
                className="rounded-full bg-secondary px-3 py-1 text-xs tabular-nums"
              >
                {d.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          {t("Recurring.generatedInstances")}
        </h2>
        <div className="mt-3 space-y-4 text-sm">
          {rule.targetKind === "JOB" && (
            <InstanceList
              heading={t("Recurring.kinds.JOB")}
              items={rule.jobs.map((j) => ({
                id: j.id,
                href: `/jobs/${j.id}`,
                label: j.title,
                date: j.createdAt.toISOString().slice(0, 10),
              }))}
            />
          )}
          {rule.targetKind === "EXPENSE" && (
            <InstanceList
              heading={t("Recurring.kinds.EXPENSE")}
              items={rule.expenses.map((e) => ({
                id: e.id,
                href: `/expenses/${e.id}`,
                label: e.description,
                date: e.date.toISOString().slice(0, 10),
              }))}
            />
          )}
          {rule.targetKind === "INVOICE" && (
            <InstanceList
              heading={t("Recurring.kinds.INVOICE")}
              items={rule.documents.map((d) => ({
                id: d.id,
                href: `/final-invoices/${d.id}`,
                label: d.number ?? t("Common.draft"),
                date: d.issueDate.toISOString().slice(0, 10),
              }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{children}</p>
    </div>
  );
}

function InstanceList({
  heading,
  items,
}: {
  heading: string;
  items: { id: string; href: string; label: string; date: string }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No instances yet.</p>;
  }
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{heading}</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between px-3 py-2">
            <Link href={i.href} className="hover:underline truncate pr-2">
              {i.label}
            </Link>
            <span className="text-xs text-muted-foreground">{i.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
