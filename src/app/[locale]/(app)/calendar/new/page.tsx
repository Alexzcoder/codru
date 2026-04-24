import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientDisplayName } from "@/lib/client-display";
import { EventForm } from "../event-form";
import { createCalendarEvent } from "../actions";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();
  const t = await getTranslations();

  const [users, clients, jobs] = await Promise.all([
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
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Calendar.newEvent")}
      </h1>
      <div className="mt-8">
        <EventForm
          users={users}
          clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c) }))}
          jobs={jobs}
          action={createCalendarEvent}
        />
      </div>
    </div>
  );
}
