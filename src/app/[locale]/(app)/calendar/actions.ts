"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const schema = z.object({
  title: z.string().trim().min(1).max(300),
  type: z.enum(["MEETING", "SITE_VISIT", "REMINDER", "OTHER"]),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().or(z.literal("")),
  allDay: z.coerce.boolean().optional(),
  assigneeId: z.string().optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  jobId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export type CalendarEventState = { error?: string };

function toPayload(d: z.infer<typeof schema>) {
  return {
    title: d.title,
    type: d.type,
    startsAt: new Date(d.startsAt),
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    allDay: d.allDay ?? false,
    assigneeId: d.assigneeId || null,
    clientId: d.clientId || null,
    jobId: d.jobId || null,
    notes: d.notes || null,
  };
}

export async function createCalendarEvent(
  _prev: CalendarEventState,
  formData: FormData,
): Promise<CalendarEventState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const ev = await prisma.calendarEvent.create({
    data: { ...toPayload(parsed.data), createdById: user.id },
  });
  await writeAudit({
    actorId: user.id,
    entity: "CalendarEvent",
    entityId: ev.id,
    action: "create",
    after: ev as unknown as Record<string, unknown>,
  });
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function updateCalendarEvent(
  id: string,
  _prev: CalendarEventState,
  formData: FormData,
): Promise<CalendarEventState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const before = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };
  const after = await prisma.calendarEvent.update({
    where: { id },
    data: toPayload(parsed.data),
  });
  await writeAudit({
    actorId: user.id,
    entity: "CalendarEvent",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });
  revalidatePath("/calendar");
  redirect("/calendar");
}

export async function toggleComplete(id: string) {
  const user = await requireUser();
  const ev = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!ev) return;
  await prisma.calendarEvent.update({
    where: { id },
    data: { completedAt: ev.completedAt ? null : new Date() },
  });
  await writeAudit({
    actorId: user.id,
    entity: "CalendarEvent",
    entityId: id,
    action: "update",
    before: { completedAt: ev.completedAt } as unknown as Record<string, unknown>,
    after: { completedAt: ev.completedAt ? null : new Date() } as unknown as Record<string, unknown>,
  });
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${id}/edit`);
}

export async function deleteCalendarEvent(id: string) {
  const user = await requireUser();
  const ev = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!ev) return;
  await prisma.calendarEvent.delete({ where: { id } });
  await writeAudit({
    actorId: user.id,
    entity: "CalendarEvent",
    entityId: id,
    action: "delete",
    before: ev as unknown as Record<string, unknown>,
  });
  revalidatePath("/calendar");
  redirect("/calendar");
}
