import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logout } from "./actions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold">
            {t("App.title")}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">{session.user.email}</span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                {t("Auth.logout")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
