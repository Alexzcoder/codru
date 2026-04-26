import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ItemTemplateForm } from "../item-template-form";
import { updateItemTemplate, archiveItemTemplate } from "../actions";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";

export default async function EditItemTemplatePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireOwner();
  const t = await getTranslations();

  const [tmpl, units, categories, taxRates] = await Promise.all([
    prisma.itemTemplate.findUnique({ where: { id } }),
    prisma.unit.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.itemCategory.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.taxRate.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { percent: "desc" }],
    }),
  ]);
  if (!tmpl || tmpl.archivedAt) notFound();

  const updateBound = updateItemTemplate.bind(null, id);
  const archiveBound = async () => {
    "use server";
    await archiveItemTemplate(id);
  };

  return (
    <div>
      <BackLink href="/settings/item-templates" label={t("ItemTemplates.title")} />
      <h2 className="text-lg font-semibold tracking-tight">{t("ItemTemplates.edit")}</h2>
      <div className="mt-6">
        <ItemTemplateForm
          initial={{
            id: tmpl.id,
            name: tmpl.name,
            description: tmpl.description,
            categoryId: tmpl.categoryId,
            unitId: tmpl.unitId,
            defaultQuantity: tmpl.defaultQuantity.toString(),
            defaultMarkupPercent: tmpl.defaultMarkupPercent?.toString() ?? null,
            defaultUnitPrice: tmpl.defaultUnitPrice.toString(),
            defaultTaxRateId: tmpl.defaultTaxRateId,
            defaultTaxMode: tmpl.defaultTaxMode,
          }}
          units={units.map((u) => ({ id: u.id, name: u.name }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          taxRates={taxRates.map((r) => ({
            id: r.id,
            label: r.label,
            percent: r.percent.toString(),
          }))}
          action={updateBound}
        />
      </div>
      <form action={archiveBound} className="mt-10">
        <Button type="submit" variant="outline" size="sm">
          {t("Settings.archive")}
        </Button>
      </form>
    </div>
  );
}
