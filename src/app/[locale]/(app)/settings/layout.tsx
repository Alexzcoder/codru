import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Settings.title")}
      </h1>
      <div className="mt-6 flex flex-col gap-8 md:flex-row">
        <aside className="md:w-56 shrink-0">
          <SettingsNav isOwner={user.role === "OWNER"} />
        </aside>
        <section className="flex-1 min-w-0">{children}</section>
      </div>
    </div>
  );
}
