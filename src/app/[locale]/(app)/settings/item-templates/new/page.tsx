import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ItemTemplateForm } from "../item-template-form";
import { createItemTemplate } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewItemTemplatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspaceOwner();
  await seedDefaults(workspace.id);
  const t = await getTranslations();

  const [units, categories, taxRates] = await Promise.all([
    prisma.unit.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.itemCategory.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.taxRate.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { percent: "desc" }],
    }),
  ]);

  return (
    <div>
      <BackLink href="/settings/item-templates" label={t("ItemTemplates.title")} />
      <h2 className="text-lg font-semibold tracking-tight">{t("ItemTemplates.new")}</h2>
      <div className="mt-6">
        <ItemTemplateForm
          units={units.map((u) => ({ id: u.id, name: u.name }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          taxRates={taxRates.map((r) => ({
            id: r.id,
            label: r.label,
            percent: r.percent.toString(),
          }))}
          action={createItemTemplate}
        />
      </div>
    </div>
  );
}
