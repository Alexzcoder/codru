import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function CompanyProfilesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspaceOwner();
  const t = await getTranslations();

  const profiles = await prisma.companyProfile.findMany({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("Settings.navCompanyProfiles")}</h2>
        <Link href="/settings/company-profiles/new">
          <Button size="sm">{t("Settings.newCompanyProfile")}</Button>
        </Link>
      </div>

      {profiles.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No company profiles yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-border"
                    style={{ background: p.brandColor }}
                  />
                  <span className="font-medium">{p.name}</span>
                  {p.isDefault && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      {t("Settings.fields.isDefault")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.ico && `IČO ${p.ico}`} {p.dic && ` · DIČ ${p.dic}`}
                </div>
              </div>
              <Link
                href={`/settings/company-profiles/${p.id}`}
                className="text-sm font-medium text-foreground hover:text-foreground"
              >
                {t("Settings.edit")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
