"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasFeature } from "@/lib/features";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

async function ensureEvent(eventId: string) {
  const ctx = await requireWorkspace();
  if (!hasFeature(ctx.workspace, "events")) notFound();
  const event = await prisma.event.findFirst({
    where: { id: eventId, workspaceId: ctx.workspace.id },
    select: { id: true },
  });
  if (!event) notFound();
  return ctx;
}

const addSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

export type AddTodoState = { error?: string };

export async function addTodo(
  eventId: string,
  _prev: AddTodoState,
  formData: FormData,
): Promise<AddTodoState> {
  const { user, workspace } = await ensureEvent(eventId);
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const title = sanitizeFreeName(parsed.data.title, 200);
  if (!title) return { error: "invalidInput" };

  const last = await prisma.eventTodo.findFirst({
    where: { eventId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const todo = await prisma.eventTodo.create({
    data: {
      eventId,
      title,
      description: parsed.data.description?.trim() || null,
      assigneeId: parsed.data.assigneeId || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      position: (last?.position ?? -1) + 1,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "EventTodo",
    entityId: todo.id,
    action: "create",
    after: { eventId, title } as unknown as Record<string, unknown>,
  });

  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function setTodoStatus(
  eventId: string,
  todoId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE",
) {
  const { user, workspace } = await ensureEvent(eventId);
  const todo = await prisma.eventTodo.findFirst({
    where: { id: todoId, eventId },
  });
  if (!todo) return;
  await prisma.eventTodo.update({
    where: { id: todoId },
    data: {
      status,
      doneAt: status === "DONE" ? new Date() : null,
    },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "EventTodo",
    entityId: todoId,
    action: "update",
    after: { status } as unknown as Record<string, unknown>,
  });
  revalidatePath(`/events/${eventId}`);
}

export async function setTodoAssignee(
  eventId: string,
  todoId: string,
  assigneeId: string,
) {
  await ensureEvent(eventId);
  const todo = await prisma.eventTodo.findFirst({
    where: { id: todoId, eventId },
  });
  if (!todo) return;
  await prisma.eventTodo.update({
    where: { id: todoId },
    data: { assigneeId: assigneeId || null },
  });
  revalidatePath(`/events/${eventId}`);
}

export async function deleteTodo(eventId: string, todoId: string) {
  const { user, workspace } = await ensureEvent(eventId);
  const todo = await prisma.eventTodo.findFirst({
    where: { id: todoId, eventId },
  });
  if (!todo) return;
  await prisma.eventTodo.delete({ where: { id: todoId } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "EventTodo",
    entityId: todoId,
    action: "delete",
    before: todo as unknown as Record<string, unknown>,
  });
  revalidatePath(`/events/${eventId}`);
}
