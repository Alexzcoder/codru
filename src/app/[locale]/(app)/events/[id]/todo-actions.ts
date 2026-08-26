"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasFeature } from "@/lib/features";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

// Todos live on event boards (feature "events") and on the standalone
// workspace board (feature "tasks") — either one grants access.
async function ensureTaskCtx() {
  const ctx = await requireWorkspace();
  if (
    !hasFeature(ctx.workspace, "events", ctx.membership) &&
    !hasFeature(ctx.workspace, "tasks", ctx.membership)
  ) {
    notFound();
  }
  return ctx;
}

function revalidateBoards(eventId: string | null) {
  if (eventId) revalidatePath(`/events/${eventId}`);
  revalidatePath("/tasks");
}

const addSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  teamId: z.string().optional(),
  dueDate: z.string().optional(),
});

export type AddTodoState = { error?: string };

export async function addTodo(
  eventId: string | null,
  _prev: AddTodoState,
  formData: FormData,
): Promise<AddTodoState> {
  const { user, workspace } = await ensureTaskCtx();
  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!event) notFound();
  }
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const title = sanitizeFreeName(parsed.data.title, 200);
  if (!title) return { error: "invalidInput" };

  const teamId = parsed.data.teamId || null;
  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!team) return { error: "invalidInput" };
  }

  const last = await prisma.eventTodo.findFirst({
    where: eventId ? { eventId } : { workspaceId: workspace.id, eventId: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const todo = await prisma.eventTodo.create({
    data: {
      workspaceId: workspace.id,
      eventId,
      teamId,
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

  revalidateBoards(eventId);
  return {};
}

async function findTodo(todoId: string, workspaceId: string) {
  return prisma.eventTodo.findFirst({
    where: { id: todoId, workspaceId },
  });
}

export async function setTodoStatus(
  todoId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE",
) {
  const { user, workspace } = await ensureTaskCtx();
  const todo = await findTodo(todoId, workspace.id);
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
  revalidateBoards(todo.eventId);
}

export async function setTodoAssignee(todoId: string, assigneeId: string) {
  const { workspace } = await ensureTaskCtx();
  const todo = await findTodo(todoId, workspace.id);
  if (!todo) return;
  if (assigneeId) {
    const member = await prisma.membership.findFirst({
      where: { workspaceId: workspace.id, userId: assigneeId },
      select: { id: true },
    });
    if (!member) return;
  }
  await prisma.eventTodo.update({
    where: { id: todoId },
    data: { assigneeId: assigneeId || null },
  });
  revalidateBoards(todo.eventId);
}

export async function setTodoTeam(todoId: string, teamId: string) {
  const { workspace } = await ensureTaskCtx();
  const todo = await findTodo(todoId, workspace.id);
  if (!todo) return;
  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!team) return;
  }
  await prisma.eventTodo.update({
    where: { id: todoId },
    data: { teamId: teamId || null },
  });
  revalidateBoards(todo.eventId);
}

export async function deleteTodo(todoId: string) {
  const { user, workspace } = await ensureTaskCtx();
  const todo = await findTodo(todoId, workspace.id);
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
  revalidateBoards(todo.eventId);
}
