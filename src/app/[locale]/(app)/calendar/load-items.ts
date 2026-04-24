import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/client-display";
import type { CalendarItem } from "./calendar-item";

const FALLBACK_COLOR = "#6b7280";

export async function loadCalendarItems({
  start,
  end,
  assigneeId,
}: {
  start: Date;
  end: Date;
  assigneeId?: string;
}): Promise<CalendarItem[]> {
  const [jobs, events] = await Promise.all([
    prisma.job.findMany({
      where: {
        scheduledStart: { gte: start, lt: end },
        ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
      },
      include: {
        client: { select: { type: true, companyName: true, fullName: true, anonymizedAt: true } },
        assignments: {
          include: { user: { select: { id: true, calendarColor: true } } },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        startsAt: { gte: start, lt: end },
        ...(assigneeId && { assigneeId }),
      },
      include: {
        assignee: { select: { id: true, calendarColor: true } },
        client: { select: { type: true, companyName: true, fullName: true, anonymizedAt: true } },
      },
    }),
  ]);

  const items: CalendarItem[] = [];

  for (const j of jobs) {
    if (!j.scheduledStart) continue;
    const first = j.assignments[0];
    items.push({
      id: j.id,
      kind: "JOB",
      title: j.title,
      subtitle: clientDisplayName(j.client),
      start: j.scheduledStart,
      end: j.scheduledEnd ?? null,
      allDay: false,
      color: first?.user.calendarColor ?? FALLBACK_COLOR,
      href: `/jobs/${j.id}`,
      completedAt: j.status === "COMPLETED" ? j.updatedAt : null,
      assigneeIds: j.assignments.map((a) => a.user.id),
      type: "JOB",
    });
  }

  for (const e of events) {
    items.push({
      id: e.id,
      kind: "EVENT",
      title: e.title,
      subtitle: e.client ? clientDisplayName(e.client) : null,
      start: e.startsAt,
      end: e.endsAt,
      allDay: e.allDay,
      color: e.assignee?.calendarColor ?? FALLBACK_COLOR,
      href: `/calendar/${e.id}/edit`,
      completedAt: e.completedAt,
      assigneeIds: e.assigneeId ? [e.assigneeId] : [],
      type: e.type,
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items;
}
