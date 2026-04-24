import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Notifications.title")}{" "}
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-800 font-medium align-middle">
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <form action={markAllBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Notifications.markAllRead")}
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-600">{t("Notifications.empty")}</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
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
                    <p className="text-xs uppercase tracking-wider text-neutral-500">
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
                    <p className="mt-0.5 text-xs text-neutral-500">
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
