import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logout } from "./actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

const DEV_BYPASS = process.env.DEV_BYPASS === "true";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let email = "dev";
  if (DEV_BYPASS) {
    const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, select: { email: true } });
    email = owner?.email ?? "dev";
  } else {
    const session = await auth();
    if (!session?.user) redirect("/login");
    email = session.user.email ?? "";
  }

  const t = await getTranslations();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold">
              {t("App.title")}
            </Link>
            <Link href="/clients" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Clients.title")}
            </Link>
            <Link href="/jobs" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Jobs.title")}
            </Link>
            <Link href="/calendar" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Calendar.title")}
            </Link>
            <Link href="/quotes" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Quotes.title")}
            </Link>
            <Link href="/advance-invoices" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("AdvanceInvoices.title")}
            </Link>
            <Link href="/settings/profile" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Settings.title")}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">{email}</span>
            {!DEV_BYPASS && (
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm">
                  {t("Auth.logout")}
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
