import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { clientDisplayName } from "@/lib/client-display";
import { EventForm } from "../../event-form";
import { updateCalendarEvent, toggleComplete, deleteCalendarEvent } from "../../actions";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const [event, users, clients, jobs] = await Promise.all([
    prisma.calendarEvent.findFirst({ where: { id, workspaceId: workspace.id } }),
    prisma.user.findMany({
      where: { deactivatedAt: null, memberships: { some: { workspaceId: workspace.id } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
      select: { id: true, type: true, companyName: true, fullName: true, anonymizedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.job.findMany({
      where: { workspaceId: workspace.id },
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
      <BackLink href="/calendar" label={t("Calendar.title")} />
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
            <ConfirmButton
              label={t("Settings.delete")}
              message="This event will be removed permanently."
            />
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
