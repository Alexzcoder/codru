import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/client-display";
import { upcomingRuns } from "@/lib/recurrence";
import type { CalendarItem } from "./calendar-item";

const FALLBACK_COLOR = "#6b7280";
const RECURRENCE_COLOR = "#8b5cf6"; // soft violet — distinct from user colors

export async function loadCalendarItems({
  workspaceId,
  start,
  end,
  assigneeId,
}: {
  workspaceId: string;
  start: Date;
  end: Date;
  assigneeId?: string;
}): Promise<CalendarItem[]> {
  const [jobs, events, rules] = await Promise.all([
    prisma.job.findMany({
      where: {
        workspaceId,
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
        workspaceId,
        startsAt: { gte: start, lt: end },
        ...(assigneeId && { assigneeId }),
      },
      include: {
        assignee: { select: { id: true, calendarColor: true } },
        client: { select: { type: true, companyName: true, fullName: true, anonymizedAt: true } },
      },
    }),
    // Recurring rules with at least one upcoming run in or before the view end
    // (we expand into multiple synthetic items below).
    prisma.recurrenceRule.findMany({
      where: {
        workspaceId,
        pausedAt: null,
        nextRunAt: { lte: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
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

  // Synthetic recurrence items: PRD §16.5 "Upcoming generations shown on the calendar."
  for (const r of rules) {
    const horizonDays = Math.ceil((end.getTime() - Date.now()) / 86_400_000) + 30;
    for (const d of upcomingRuns(r, Math.max(horizonDays, 1))) {
      if (d < start || d >= end) continue;
      items.push({
        id: `${r.id}:${d.getTime()}`,
        kind: "EVENT",
        title: `↻ ${r.name}`,
        subtitle: r.targetKind.toLowerCase(),
        start: d,
        end: null,
        allDay: true,
        color: RECURRENCE_COLOR,
        href: `/recurring/${r.id}`,
        completedAt: null,
        assigneeIds: [],
        type: "OTHER",
      });
    }
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items;
}
