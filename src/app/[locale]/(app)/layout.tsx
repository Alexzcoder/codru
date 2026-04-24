import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logout } from "./actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { scanImplicitTriggers } from "@/lib/notifications";

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
  let userId: string | null = null;
  if (DEV_BYPASS) {
    const owner = await prisma.user.findFirst({
      where: { role: "OWNER" },
      select: { id: true, email: true },
    });
    email = owner?.email ?? "dev";
    userId = owner?.id ?? null;
  } else {
    const session = await auth();
    if (!session?.user) redirect("/login");
    email = session.user.email ?? "";
    userId = session.user.id ?? null;
  }

  // Fan out time-driven notifications (throttled). Non-blocking for the UI.
  scanImplicitTriggers().catch(() => {});

  // Badge count for the bell.
  const unreadCount = userId
    ? await prisma.notification.count({
        where: { userId, readAt: null },
      })
    : 0;

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
            <Link href="/final-invoices" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("FinalInvoices.title")}
            </Link>
            <Link href="/credit-notes" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("CreditNotes.title")}
            </Link>
            <Link href="/payments" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Payments.title")}
            </Link>
            <Link href="/expenses" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Expenses.title")}
            </Link>
            <Link href="/accounting" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Accounting.title")}
            </Link>
            <Link href="/recurring" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Recurring.title")}
            </Link>
            <Link href="/settings/profile" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t("Settings.title")}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label={t("Notifications.title")}
            >
              <span aria-hidden>🔔</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-5 text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
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
