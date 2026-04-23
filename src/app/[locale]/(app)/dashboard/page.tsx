import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Dashboard.title")}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">{t("Dashboard.empty")}</p>
    </div>
  );
}
