import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { EventForm } from "../../event-form";
import { updateCalendarEvent, toggleComplete, deleteCalendarEvent } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [event, users, clients, jobs] = await Promise.all([
    prisma.calendarEvent.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { deactivatedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { deletedAt: null, anonymizedAt: null },
      select: { id: true, type: true, companyName: true, fullName: true, anonymizedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.job.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);
  if (!event) notFound();

  const updateBound = updateCalendarEvent.bind(null, id);
  const toggleBound = async () => {
    "use server";
    await toggleComplete(id);
  };
  const deleteBound = async () => {
    "use server";
    await deleteCalendarEvent(id);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-xs text-muted-foreground">{t("Calendar.title")}</p>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <div className="flex gap-2">
          <form action={toggleBound}>
            <Button type="submit" variant="outline" size="sm">
              {event.completedAt
                ? t("Calendar.markUncomplete")
                : t("Calendar.markComplete")}
            </Button>
          </form>
          <form action={deleteBound}>
            <Button type="submit" variant="outline" size="sm">
              {t("Settings.delete")}
            </Button>
          </form>
        </div>
      </div>
      <div className="mt-8">
        <EventForm
          initial={event}
          users={users}
          clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c) }))}
          jobs={jobs}
          action={updateBound}
        />
      </div>
    </div>
  );
}
