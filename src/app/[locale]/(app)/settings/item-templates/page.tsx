import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function ItemTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspaceOwner();
  await seedDefaults(workspace.id);
  const t = await getTranslations();

  const templates = await prisma.itemTemplate.findMany({
    where: { archivedAt: null },
    include: { category: true, unit: true, defaultTaxRate: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("ItemTemplates.title")}</h2>
        <Link href="/settings/item-templates/new">
          <Button size="sm">{t("ItemTemplates.new")}</Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("ItemTemplates.empty")}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("ItemTemplates.fields.name")}</th>
                <th className="px-4 py-2 text-left">{t("ItemTemplates.fields.category")}</th>
                <th className="px-4 py-2 text-left">{t("ItemTemplates.fields.unit")}</th>
                <th className="px-4 py-2 text-right">{t("ItemTemplates.fields.defaultUnitPrice")}</th>
                <th className="px-4 py-2 text-left">{t("ItemTemplates.fields.defaultTaxRate")}</th>
                <th className="px-4 py-2 text-left">{t("ItemTemplates.fields.defaultTaxMode")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((tmpl) => (
                <tr key={tmpl.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/settings/item-templates/${tmpl.id}`}
                      className="font-medium hover:underline"
                    >
                      {tmpl.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tmpl.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{tmpl.unit.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {tmpl.defaultUnitPrice.toString()}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tmpl.defaultTaxRate.label}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tmpl.defaultTaxMode === "NET"
                      ? t("ItemTemplates.fields.taxModeNet")
                      : t("ItemTemplates.fields.taxModeGross")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
