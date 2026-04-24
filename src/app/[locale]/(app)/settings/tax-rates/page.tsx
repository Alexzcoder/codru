import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TaxRateForm } from "./tax-rate-form";
import { archiveTaxRate, setDefaultTaxRate } from "./actions";
import { Button } from "@/components/ui/button";

export default async function TaxRatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  await seedDefaults();
  const t = await getTranslations();

  const rates = await prisma.taxRate.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { percent: "desc" }],
  });

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{t("Settings.navTaxRates")}</h2>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">{t("Settings.fields.label")}</th>
              <th className="px-4 py-2 text-right">{t("Settings.fields.percent")}</th>
              <th className="px-4 py-2 text-left">{t("Settings.fields.isDefault")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rates.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {r.percent.toString()}
                </td>
                <td className="px-4 py-2">
                  {r.isDefault ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      {t("Settings.fields.isDefault")}
                    </span>
                  ) : (
                    <form
                      action={async () => {
                        "use server";
                        await setDefaultTaxRate(r.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Make default
                      </Button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <form
                    action={async () => {
                      "use server";
                      await archiveTaxRate(r.id);
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm">
                      {t("Settings.archive")}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium">{t("Settings.create")}</h3>
        <div className="mt-3">
          <TaxRateForm />
        </div>
      </div>
    </div>
  );
}
