import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Plus } from "lucide-react";

const PAGE_SIZE = 50;

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    categoryId?: string;
    jobId?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();
  const sp = await searchParams;

  const where = {
    ...(sp.from && { date: { gte: new Date(sp.from) } }),
    ...(sp.to && { date: { lte: new Date(sp.to) } }),
    ...(sp.categoryId && { categoryId: sp.categoryId }),
    ...(sp.jobId && { jobId: sp.jobId }),
  };
  const page = Math.max(1, Number(sp.page) || 1);

  const [expenses, total, categories, jobs, monthSummary] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { category: true, job: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.expense.count({ where }),
    prisma.expenseCategory.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.job.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    summaryForCurrentMonth(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title={t("Expenses.title")}
        description={`${total} ${total === 1 ? "expense" : "expenses"}`}
        actions={
          <Link href="/expenses/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> {t("Expenses.new")}
            </Button>
          </Link>
        }
      />

      {/* Monthly summary */}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Expenses.summary.total")} · {monthSummary.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {monthSummary.total.toFixed(2)} CZK
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Expenses.summary.vatPaid")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {monthSummary.vat.toFixed(2)} CZK
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Expenses.summary.byCategory")}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {monthSummary.byCategory.length === 0 ? (
              <li className="text-muted-foreground">—</li>
            ) : (
              monthSummary.byCategory.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="tabular-nums">{c.amount.toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Filters */}
      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card shadow-sm p-3">
        <label className="flex flex-col text-xs text-muted-foreground">
          {t("Expenses.filters.from")}
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          {t("Expenses.filters.to")}
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          {t("Expenses.filters.category")}
          <select
            name="categoryId"
            defaultValue={sp.categoryId ?? ""}
            className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          {t("Expenses.filters.job")}
          <select
            name="jobId"
            defaultValue={sp.jobId ?? ""}
            className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

      {expenses.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("Expenses.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("Expenses.fields.date")}</th>
                <th className="px-4 py-2 text-left">{t("Expenses.fields.category")}</th>
                <th className="px-4 py-2 text-left">{t("Expenses.fields.supplier")}</th>
                <th className="px-4 py-2 text-left">{t("Expenses.fields.description")}</th>
                <th className="px-4 py-2 text-left">{t("Expenses.fields.job")}</th>
                <th className="px-4 py-2 text-right">{t("Expenses.fields.totalAmount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-2 text-muted-foreground">
                    <Link href={`/expenses/${e.id}`} className="hover:underline">
                      {e.date.toISOString().slice(0, 10)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{e.category.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.supplier ?? "—"}</td>
                  <td className="px-4 py-2 truncate max-w-[24ch]">{e.description}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.job ? (
                      <Link href={`/jobs/${e.job.id}`} className="hover:underline">
                        {e.job.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {e.totalAmount.toString()} {e.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={{ pathname: "/expenses", query: { ...sp, page: page - 1 } }}>
                <Button variant="outline" size="sm">
                  Prev
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={{ pathname: "/expenses", query: { ...sp, page: page + 1 } }}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function summaryForCurrentMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: end }, currency: "CZK" },
    include: { category: true },
  });
  const total = expenses.reduce(
    (s, e) => s + Number.parseFloat(e.totalAmount.toString()),
    0,
  );
  const vat = expenses.reduce(
    (s, e) => s + Number.parseFloat(e.vatAmount.toString()),
    0,
  );
  const byCategoryMap = new Map<string, number>();
  for (const e of expenses) {
    const prev = byCategoryMap.get(e.category.name) ?? 0;
    byCategoryMap.set(
      e.category.name,
      prev + Number.parseFloat(e.totalAmount.toString()),
    );
  }
  return {
    label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    total,
    vat,
    byCategory: Array.from(byCategoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
