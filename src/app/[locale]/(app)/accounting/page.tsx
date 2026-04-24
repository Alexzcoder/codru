import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { calculateDocument } from "@/lib/line-items";
import { computeOutstanding } from "@/lib/payment-status";
import { computeJobProfitability } from "@/lib/job-profitability";
import { clientDisplayName } from "@/lib/client-display";

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function quarterStart(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
function yearStart(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

async function sumInvoiceGrossInRange(start: Date, end: Date): Promise<number> {
  const invoices = await prisma.document.findMany({
    where: {
      type: { in: ["FINAL_INVOICE"] },
      status: { not: "UNSENT" },
      deletedAt: null,
      issueDate: { gte: start, lt: end },
    },
    include: { lineItems: true },
  });
  let total = 0;
  for (const inv of invoices) {
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
    total += Number.parseFloat(totals.totalGross);
  }
  return total;
}

export default async function AccountingDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const ms = monthStart(now);
  const qs = quarterStart(now);
  const ys = yearStart(now);
  const msPrev = monthStart(new Date(ms.getTime() - 1));
  const qsPrev = quarterStart(new Date(qs.getTime() - 1));
  const ysPrev = yearStart(new Date(ys.getTime() - 1));

  const [
    revMonth,
    revMonthPrev,
    revQuarter,
    revQuarterPrev,
    revYear,
    revYearPrev,
    unpaidInvoices,
    staleQuotes,
    ppcAdvances,
    dueSoon,
    jobsForProfit,
    creditNotesCount,
  ] = await Promise.all([
    sumInvoiceGrossInRange(ms, now),
    sumInvoiceGrossInRange(msPrev, ms),
    sumInvoiceGrossInRange(qs, now),
    sumInvoiceGrossInRange(qsPrev, qs),
    sumInvoiceGrossInRange(ys, now),
    sumInvoiceGrossInRange(ysPrev, ys),
    prisma.document.findMany({
      where: {
        type: { in: ["ADVANCE_INVOICE", "FINAL_INVOICE"] },
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        deletedAt: null,
      },
      include: { client: true, lineItems: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.document.findMany({
      where: {
        type: "QUOTE",
        deletedAt: null,
        OR: [
          {
            status: "UNSENT",
            createdAt: { lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
          },
          {
            status: "SENT",
            sentAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
      include: { client: true },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),
    prisma.document.findMany({
      where: {
        type: "ADVANCE_INVOICE",
        status: "PAID_PENDING_COMPLETION",
        deletedAt: null,
      },
      include: { client: true, job: true },
      take: 10,
    }),
    prisma.document.findMany({
      where: {
        type: { in: ["ADVANCE_INVOICE", "FINAL_INVOICE"] },
        status: { in: ["SENT", "PARTIALLY_PAID"] },
        dueDate: { gte: now, lt: in7d },
        deletedAt: null,
      },
      include: { client: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.job.findMany({
      where: { status: { in: ["COMPLETED", "IN_PROGRESS"] } },
      orderBy: { updatedAt: "desc" },
      take: 80, // cap for dashboard perf
    }),
    prisma.document.count({
      where: {
        type: "CREDIT_NOTE",
        status: { not: "UNSENT" },
        issueDate: { gte: ms, lt: now },
        deletedAt: null,
      },
    }),
  ]);

  // Compute outstanding + total unpaid
  const unpaidDetails = await Promise.all(
    unpaidInvoices.map(async (d) => {
      const s = await computeOutstanding(d.id);
      return { doc: d, outstanding: Number.parseFloat(s.outstanding) };
    }),
  );
  const unpaidTotal = unpaidDetails.reduce((s, x) => s + x.outstanding, 0);

  // Job profitability
  const profList = await Promise.all(
    jobsForProfit.map(async (j) => {
      const p = await computeJobProfitability(j.id);
      return { id: j.id, title: j.title, profit: p.profit };
    }),
  );
  const topProfit = [...profList].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const bottomProfit = [...profList].sort((a, b) => a.profit - b.profit).slice(0, 5);

  const fmtDelta = (cur: number, prev: number) => {
    const d = cur - prev;
    const pct = prev === 0 ? null : (d / prev) * 100;
    const sign = d >= 0 ? "+" : "−";
    return {
      text: `${sign}${Math.abs(d).toFixed(2)}${pct !== null ? ` (${sign}${Math.abs(pct).toFixed(0)}%)` : ""}`,
      positive: d >= 0,
    };
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Accounting.title")}</h1>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <RevCard
          title={t("Accounting.revenue.thisMonth")}
          amount={revMonth}
          delta={fmtDelta(revMonth, revMonthPrev)}
        />
        <RevCard
          title={t("Accounting.revenue.thisQuarter")}
          amount={revQuarter}
          delta={fmtDelta(revQuarter, revQuarterPrev)}
        />
        <RevCard
          title={t("Accounting.revenue.thisYear")}
          amount={revYear}
          delta={fmtDelta(revYear, revYearPrev)}
        />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card title={t("Accounting.unpaidInvoices")}>
          <p className="text-xl font-semibold tabular-nums">
            {unpaidTotal.toFixed(2)} CZK
          </p>
          <p className="text-xs text-neutral-500">
            {unpaidDetails.length} {unpaidDetails.length === 1 ? "invoice" : "invoices"}
          </p>
          {unpaidDetails.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {unpaidDetails.slice(0, 5).map(({ doc, outstanding }) => {
                const href =
                  doc.type === "ADVANCE_INVOICE"
                    ? `/advance-invoices/${doc.id}`
                    : `/final-invoices/${doc.id}`;
                return (
                  <li key={doc.id} className="flex justify-between">
                    <Link href={href} className="hover:underline truncate pr-2">
                      {doc.number ?? "(draft)"} · {clientDisplayName(doc.client)}
                    </Link>
                    <span className="tabular-nums">{outstanding.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={t("Accounting.upcomingDue")}>
          {dueSoon.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dueSoon.map((d) => {
                const href =
                  d.type === "ADVANCE_INVOICE"
                    ? `/advance-invoices/${d.id}`
                    : `/final-invoices/${d.id}`;
                return (
                  <li key={d.id} className="flex justify-between">
                    <Link href={href} className="hover:underline truncate pr-2">
                      {d.number ?? "(draft)"}
                    </Link>
                    <span className="text-neutral-500 text-xs">
                      {d.dueDate?.toISOString().slice(0, 10)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={t("Accounting.creditNotesThisPeriod")}>
          <p className="text-xl font-semibold tabular-nums">{creditNotesCount}</p>
          <Link href="/credit-notes" className="mt-2 inline-block text-xs underline">
            See all
          </Link>
        </Card>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title={t("Accounting.staleQuotes")}>
          {staleQuotes.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {staleQuotes.map((q) => (
                <li key={q.id} className="flex justify-between">
                  <Link href={`/quotes/${q.id}`} className="hover:underline truncate pr-2">
                    {q.number ?? "(draft)"} · {clientDisplayName(q.client)}
                  </Link>
                  <span className="text-xs text-neutral-500">
                    {q.status === "UNSENT" ? "draft" : q.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("Accounting.ppcAdvances")}>
          {ppcAdvances.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {ppcAdvances.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <Link
                    href={`/advance-invoices/${a.id}`}
                    className="hover:underline truncate pr-2"
                  >
                    {a.number ?? "(draft)"} · {clientDisplayName(a.client)}
                  </Link>
                  <span className="text-xs text-neutral-500">
                    {a.job?.title ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title={`${t("Accounting.perJobProfit")} — ${t("Accounting.topProfit")}`}>
          {topProfit.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {topProfit.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/jobs/${j.id}`} className="hover:underline truncate pr-2">
                    {j.title}
                  </Link>
                  <span className="tabular-nums text-green-700 font-medium">
                    {j.profit.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`${t("Accounting.perJobProfit")} — ${t("Accounting.bottomProfit")}`}>
          {bottomProfit.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {bottomProfit.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/jobs/${j.id}`} className="hover:underline truncate pr-2">
                    {j.title}
                  </Link>
                  <span
                    className={`tabular-nums font-medium ${j.profit >= 0 ? "text-green-700" : "text-red-600"}`}
                  >
                    {j.profit.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Card({
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

function RevCard({
  title,
  amount,
  delta,
}: {
  title: string;
  amount: number;
  delta: { text: string; positive: boolean };
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-5">
      <h2 className="text-xs uppercase tracking-wider text-neutral-500">{title}</h2>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {amount.toFixed(2)} CZK
      </p>
      <p
        className={`mt-1 text-xs tabular-nums ${delta.positive ? "text-green-700" : "text-red-600"}`}
      >
        {delta.text}
      </p>
    </div>
  );
}
