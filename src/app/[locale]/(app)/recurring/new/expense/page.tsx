import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpenseRuleForm } from "./form";
import { createExpenseRule } from "../../actions";
import { BackLink } from "@/components/back-link";

export default async function NewExpenseRulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  await seedDefaults();
  const t = await getTranslations();

  const [categories, jobs] = await Promise.all([
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/recurring/new" label={t("Recurring.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Recurring.new")} · {t("Recurring.kinds.EXPENSE")}
      </h1>
      <div className="mt-8">
        <ExpenseRuleForm
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          jobs={jobs}
          action={createExpenseRule}
        />
      </div>
    </div>
  );
}
