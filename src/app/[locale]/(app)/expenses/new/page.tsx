import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpenseForm } from "../expense-form";
import { createExpense } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  await seedDefaults(workspace.id);
  const t = await getTranslations();
  const { jobId } = await searchParams;

  const [categories, jobs] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.job.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/expenses" label={t("Expenses.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Expenses.new")}</h1>
      <div className="mt-8">
        <ExpenseForm
          initial={jobId ? { jobId } : undefined}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          jobs={jobs}
          action={createExpense}
        />
      </div>
    </div>
  );
}
