import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";
import { PageHeader } from "@/components/page-header";
import { scanImplicitTriggers } from "@/lib/notifications";
import {
  Briefcase,
  Users,
  TrendingUp,
  CalendarClock,
  MessageCircle,
} from "lucide-react";

const JOB_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const CLIENT_STATUSES = ["POTENTIAL", "ACTIVE", "PAST", "FAILED"] as const;

const JOB_BADGE: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-secondary text-secondary-foreground",
};

const CLIENT_BADGE: Record<string, string> = {
  POTENTIAL: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAST: "bg-secondary text-secondary-foreground",
  FAILED: "bg-red-100 text-red-800",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  // Fire implicit notification scan (throttled internally to once per 5 min).
  // Non-blocking so the dashboard renders fast.
  scanImplicitTriggers().catch(() => {});

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const [
    jobCounts,
    clientCounts,
    newPotentialCount,
    recentContactLogs,
    upcomingJobs,
    invoicesLast12m,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: true }),
    prisma.client.groupBy({
      by: ["status"],
      _count: true,
      where: { deletedAt: null, anonymizedAt: null },
    }),
    prisma.client.count({
      where: {
        status: "POTENTIAL",
        createdAt: { gte: sevenDaysAgo },
        deletedAt: null,
        anonymizedAt: null,
      },
    }),
    prisma.contactLog.findMany({
      include: { client: true, loggedBy: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.job.findMany({
      where: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledStart: { gte: now, lt: sevenDaysAhead },
      },
      include: { client: true },
      orderBy: { scheduledStart: "asc" },
      take: 10,
    }),
    prisma.document.findMany({
      where: {
        type: { in: ["FINAL_INVOICE", "ADVANCE_INVOICE"] },
        status: { in: ["PAID", "PAID_PENDING_COMPLETION", "PARTIALLY_PAID"] },
        issueDate: { gte: twelveMonthsAgo },
        deletedAt: null,
      },
      include: { client: true, lineItems: true },
    }),
  ]);

  const revenueByClient = new Map<string, { id: string; name: string; total: number }>();
  for (const inv of invoicesLast12m) {
    const totals = calculateDocument({
      lines: inv.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: inv.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: inv.documentDiscountAmount?.toString() ?? null,
      reverseCharge: inv.reverseCharge,
    });
    const key = inv.client.id;
    const entry = revenueByClient.get(key) ?? {
      id: key,
      name: clientDisplayName(inv.client),
      total: 0,
    };
    entry.total += Number.parseFloat(totals.totalGross);
    revenueByClient.set(key, entry);
  }
  const topClients = Array.from(revenueByClient.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const jobCountMap = Object.fromEntries(jobCounts.map((j) => [j.status, j._count]));
  const clientCountMap = Object.fromEntries(
    clientCounts.map((c) => [c.status, c._count]),
  );
  const totalJobs = Object.values(jobCountMap).reduce(
    (s, n) => s + (n as number),
    0,
  );
  const totalClients = Object.values(clientCountMap).reduce(
    (s, n) => s + (n as number),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Dashboard.title")}
        description="A quick read on your pipeline, work coming up, and where revenue is coming from."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatTile
          icon={<Briefcase size={18} />}
          label={t("Dashboard.jobs.title")}
          value={String(totalJobs)}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatTile
          icon={<Users size={18} />}
          label={t("Dashboard.clients.title")}
          value={String(totalClients)}
          accent="bg-blue-50 text-blue-700"
        />
        <StatTile
          icon={<CalendarClock size={18} />}
          label={t("Dashboard.upcomingJobs")}
          value={String(upcomingJobs.length)}
          accent="bg-amber-50 text-amber-700"
        />
        <StatTile
          icon={<TrendingUp size={18} />}
          label="New potential (7d)"
          value={String(newPotentialCount)}
          accent="bg-violet-50 text-violet-700"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title={t("Dashboard.jobs.title")}>
          <div className="flex flex-wrap gap-2">
            {JOB_STATUSES.map((s) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-sm ${JOB_BADGE[s]}`}
              >
                {t(`Dashboard.jobs.${s}`)}:{" "}
                <strong className="tabular-nums">{jobCountMap[s] ?? 0}</strong>
              </span>
            ))}
          </div>
        </Card>

        <Card title={t("Dashboard.clients.title")}>
          <div className="flex flex-wrap gap-2">
            {CLIENT_STATUSES.map((s) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-sm ${CLIENT_BADGE[s]}`}
              >
                {t(`Dashboard.clients.${s}`)}:{" "}
                <strong className="tabular-nums">{clientCountMap[s] ?? 0}</strong>
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title={t("Dashboard.topClients")}>
          {topClients.length === 0 ? (
            <Empty>—</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {topClients.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <Link
                      href={`/clients/${c.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </div>
                  <span className="tabular-nums text-sm">{c.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("Dashboard.upcomingJobs")}>
          {upcomingJobs.length === 0 ? (
            <Empty>—</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingJobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${j.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {j.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {clientDisplayName(j.client)}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {j.scheduledStart
                      ? j.scheduledStart.toISOString().slice(0, 16).replace("T", " ")
                      : ""}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title={t("Dashboard.recentContacts")}
          icon={<MessageCircle size={16} className="text-muted-foreground" />}
        >
          {recentContactLogs.length === 0 ? (
            <Empty>—</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {recentContactLogs.map((l) => (
                <li key={l.id} className="py-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t(`Clients.contactType.${l.type}`)} · {l.loggedBy.name} ·{" "}
                      <Link
                        href={`/clients/${l.client.id}`}
                        className="hover:underline"
                      >
                        {clientDisplayName(l.client)}
                      </Link>
                    </span>
                    <time>{l.date.toISOString().slice(0, 10)}</time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{l.notes}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>;
}
