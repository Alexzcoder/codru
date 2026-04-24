import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryForm } from "./category-form";
import { archiveExpenseCategory } from "./actions";
import { Button } from "@/components/ui/button";

export default async function ExpenseCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  await seedDefaults();
  const t = await getTranslations();

  const categories = await prisma.expenseCategory.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">{t("Settings.navExpenseCategories")}</h2>
      <ul className="mt-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-2">
            <span>{c.name}</span>
            <form
              action={async () => {
                "use server";
                await archiveExpenseCategory(c.id);
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                {t("Settings.archive")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <CategoryForm />
      </div>
    </div>
  );
}
