import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ExpenseForm } from "../../expense-form";
import { updateExpense } from "../../actions";
import { BackLink } from "@/components/back-link";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [expense, categories, jobs] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.expenseCategory.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.job.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);
  if (!expense) notFound();

  const bound = updateExpense.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/expenses" label={t("Expenses.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{expense.description}</h1>
      <div className="mt-8">
        <ExpenseForm
          initial={expense}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          jobs={jobs}
          action={bound}
        />
      </div>
    </div>
  );
}
