"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasFeature } from "@/lib/features";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

const eventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  location: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export type EventState = { error?: string };

export async function createEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const name = sanitizeFreeName(d.name, 200);
  if (!name) return { error: "invalidInput" };

  const ev = await prisma.event.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      name,
      description: d.description?.trim() || null,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
      location: d.location?.trim() || null,
      notes: d.notes?.trim() || null,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Event",
    entityId: ev.id,
    action: "create",
    after: { name } as unknown as Record<string, unknown>,
  });

  revalidatePath("/events");
  redirect(`/events/${ev.id}`);
}

export async function updateEvent(
  id: string,
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const name = sanitizeFreeName(d.name, 200);
  if (!name) return { error: "invalidInput" };

  const before = await prisma.event.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!before) return { error: "notFound" };

  await prisma.event.update({
    where: { id },
    data: {
      name,
      description: d.description?.trim() || null,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
      location: d.location?.trim() || null,
      notes: d.notes?.trim() || null,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Event",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}`);
}

export async function deleteEvent(id: string) {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();
  const ev = await prisma.event.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!ev) return;
  await prisma.event.delete({ where: { id } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Event",
    entityId: id,
    action: "delete",
    before: ev as unknown as Record<string, unknown>,
  });
  revalidatePath("/events");
  redirect("/events");
}
