"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasFeature } from "@/lib/features";
import { saveEventAttachment, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

const MAX_FILES_PER_EVENT = 50;

export type EventAttachmentState = { error?: string };

export async function uploadEventAttachment(
  eventId: string,
  _prev: EventAttachmentState,
  formData: FormData,
): Promise<EventAttachmentState> {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  if (!file || file.size === 0) return { error: "noFile" };

  const event = await prisma.event.findFirst({
    where: { id: eventId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!event) return { error: "notFound" };

  // Optional: when the upload came from a todo card the form posts a todoId.
  // We set both event + todo links so the file shows on the card AND in the
  // event Files section.
  const rawTodoId = (formData.get("todoId") as string | null)?.trim() || null;
  let todoId: string | null = null;
  if (rawTodoId) {
    const todo = await prisma.eventTodo.findFirst({
      where: { id: rawTodoId, eventId },
      select: { id: true },
    });
    if (todo) todoId = todo.id;
  }

  const count = await prisma.eventAttachment.count({ where: { eventId } });
  if (count >= MAX_FILES_PER_EVENT) return { error: "tooManyFiles" };

  let saved;
  try {
    saved = await saveEventAttachment({ file, eventId });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "uploadFailed" };
  }

  const att = await prisma.eventAttachment.create({
    data: {
      eventId,
      todoId,
      filename: saved.filename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      kind: saved.kind,
      path: saved.path,
      caption,
      uploadedById: user.id,
    },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "EventAttachment",
    entityId: att.id,
    action: "create",
    after: { eventId, filename: att.filename } as unknown as Record<string, unknown>,
  });
  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function deleteEventAttachment(eventId: string, attachmentId: string) {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "events")) notFound();

  const att = await prisma.eventAttachment.findFirst({
    where: { id: attachmentId, event: { workspaceId: workspace.id, id: eventId } },
  });
  if (!att) return;
  await prisma.eventAttachment.delete({ where: { id: attachmentId } });
  await deleteUpload(att.path);
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "EventAttachment",
    entityId: attachmentId,
    action: "delete",
    before: att as unknown as Record<string, unknown>,
  });
  revalidatePath(`/events/${eventId}`);
}
