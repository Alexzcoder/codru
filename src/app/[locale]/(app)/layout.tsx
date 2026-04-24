import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logout } from "./actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { scanImplicitTriggers } from "@/lib/notifications";
import { Sidebar } from "./sidebar";
import { Bell, LogOut } from "lucide-react";

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

  scanImplicitTriggers().catch(() => {});

  const unreadCount = userId
    ? await prisma.notification.count({
        where: { userId, readAt: null },
      })
    : 0;

  const t = await getTranslations();

  return (
    <div className="flex flex-1">
      <Sidebar workspaceEmail={email} userInitial={(email[0] ?? "d")} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center justify-end gap-3 px-6 py-3">
            <Link
              href="/notifications"
              className="relative inline-flex items-center gap-1 rounded-md p-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("Notifications.title")}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1.5 text-sm">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {(email[0] ?? "d").toUpperCase()}
              </span>
              <span className="text-muted-foreground">{email}</span>
            </div>
            {!DEV_BYPASS && (
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
                  <LogOut size={14} />
                  {t("Auth.logout")}
                </Button>
              </form>
            )}
          </div>
        </header>
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
