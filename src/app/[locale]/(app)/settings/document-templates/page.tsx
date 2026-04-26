import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, { cs: string; en: string }> = {
  QUOTE: { cs: "Cenová nabídka", en: "Quote" },
  ADVANCE_INVOICE: { cs: "Zálohová faktura", en: "Advance invoice" },
  FINAL_INVOICE: { cs: "Faktura", en: "Final invoice" },
  CREDIT_NOTE: { cs: "Opravný daňový doklad", en: "Credit note" },
};

export default async function DocumentTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspaceOwner();
  await seedDefaults(workspace.id);
  const t = await getTranslations();
  const lng = locale === "cs" ? "cs" : "en";

  const templates = await prisma.documentTemplate.findMany({
    where: { archivedAt: null, companyProfile: { workspaceId: workspace.id } },
    include: { companyProfile: true },
    orderBy: [{ type: "asc" }, { isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("Settings.navDocumentTemplates")}</h2>
        <Link href="/settings/document-templates/new">
          <Button size="sm">New template</Button>
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Company profile</th>
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.map((tmpl) => (
              <tr key={tmpl.id}>
                <td className="px-4 py-2 text-muted-foreground">
                  {TYPE_LABELS[tmpl.type][lng]}
                  {tmpl.isDefault && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      default
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded border border-border"
                      style={{ background: tmpl.accentColor }}
                    />
                    <Link
                      href={`/settings/document-templates/${tmpl.id}`}
                      className="font-medium hover:underline"
                    >
                      {tmpl.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {tmpl.companyProfile?.name ?? "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={`/settings/document-templates/${tmpl.id}/preview`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    Preview PDF ↗
                  </a>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/settings/document-templates/${tmpl.id}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {t("Settings.edit")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
