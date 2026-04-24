import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnitForm } from "./unit-form";
import { archiveUnit } from "./actions";
import { Button } from "@/components/ui/button";

export default async function UnitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  await seedDefaults();
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{t("Settings.navUnits")}</h2>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {units.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-2">
            <span>{u.name}</span>
            <form
              action={async () => {
                "use server";
                await archiveUnit(u.id);
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
        <UnitForm />
      </div>
    </div>
  );
}
