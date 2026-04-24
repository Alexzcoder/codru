import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { calculateDocument } from "@/lib/line-items";

const JOB_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const CLIENT_STATUSES = ["POTENTIAL", "ACTIVE", "PAST", "FAILED"] as const;

const JOB_BADGE: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-neutral-200 text-neutral-700",
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
    prisma.job.groupBy({
      by: ["status"],
      _count: true,
    }),
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

  // Top clients by revenue (last 12 months)
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Dashboard.title")}
      </h1>

      {/* Stat rows */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <StatCard title={t("Dashboard.jobs.title")}>
          <div className="flex flex-wrap gap-2">
            {JOB_STATUSES.map((s) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-sm ${JOB_BADGE[s]}`}
              >
                {t(`Dashboard.jobs.${s}`)}: <strong>{jobCountMap[s] ?? 0}</strong>
              </span>
            ))}
          </div>
        </StatCard>

        <StatCard title={t("Dashboard.clients.title")}>
          <div className="flex flex-wrap gap-2">
            {CLIENT_STATUSES.map((s) => (
              <span
                key={s}
                className="rounded-full bg-neutral-100 px-3 py-1 text-sm"
              >
                {t(`Dashboard.clients.${s}`)}:{" "}
                <strong>{clientCountMap[s] ?? 0}</strong>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            {t("Dashboard.clients.newPotential")}: <strong>{newPotentialCount}</strong>
          </p>
        </StatCard>
      </div>

      {/* Top clients + upcoming jobs */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <StatCard title={t("Dashboard.topClients")}>
          {topClients.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {topClients.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/clients/${c.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="tabular-nums text-sm">
                    {c.total.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </StatCard>

        <StatCard title={t("Dashboard.upcomingJobs")}>
          {upcomingJobs.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {upcomingJobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${j.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {j.title}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {clientDisplayName(j.client)}
                    </p>
                  </div>
                  <time className="text-xs text-neutral-500">
                    {j.scheduledStart
                      ? j.scheduledStart.toISOString().slice(0, 16).replace("T", " ")
                      : ""}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </StatCard>
      </div>

      {/* Recent contacts */}
      <div className="mt-6">
        <StatCard title={t("Dashboard.recentContacts")}>
          {recentContactLogs.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {recentContactLogs.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {t(`Clients.contactType.${l.type}`)} · {l.loggedBy.name}{" "}
                      ·{" "}
                      <Link
                        href={`/clients/${l.client.id}`}
                        className="hover:underline"
                      >
                        {clientDisplayName(l.client)}
                      </Link>
                    </span>
                    <time>{l.date.toISOString().slice(0, 10)}</time>
                  </div>
                  <p className="mt-1 text-sm line-clamp-2">{l.notes}</p>
                </li>
              ))}
            </ul>
          )}
        </StatCard>
      </div>
    </div>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium text-neutral-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
