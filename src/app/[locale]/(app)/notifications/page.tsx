import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "./actions";
import { PageHeader } from "@/components/page-header";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const markAllBound = async () => {
    "use server";
    await markAllNotificationsRead();
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        title={t("Notifications.title")}
        description={
          unreadCount > 0
            ? `${unreadCount} ${unreadCount === 1 ? "unread" : "unread"}`
            : "You're all caught up."
        }
        actions={
          unreadCount > 0 ? (
            <form action={markAllBound}>
              <Button type="submit" variant="outline" size="sm">
                {t("Notifications.markAllRead")}
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("Notifications.empty")}</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {notifications.map((n) => {
            const markBound = async () => {
              "use server";
              await markNotificationRead(n.id);
            };
            const isUnread = !n.readAt;
            return (
              <li
                key={n.id}
                className={`p-4 ${isUnread ? "bg-blue-50/40" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t(`Notifications.triggers.${n.trigger}`)}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {n.href ? (
                        <Link href={n.href} className="font-medium hover:underline">
                          {n.message}
                        </Link>
                      ) : (
                        <span className="font-medium">{n.message}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                  {isUnread && (
                    <form action={markBound}>
                      <Button type="submit" variant="ghost" size="sm">
                        {t("Notifications.markRead")}
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
