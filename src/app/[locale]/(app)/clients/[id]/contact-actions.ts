"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const schema = z.object({
  clientId: z.string().min(1),
  jobId: z.string().optional().or(z.literal("")),
  type: z.enum(["PHONE", "EMAIL", "MEETING", "SITE_VISIT", "OTHER"]),
  notes: z.string().trim().min(1).max(5000),
  date: z.string().optional(),
});

export type ContactLogState = { error?: string; saved?: boolean };

export async function addContactLog(
  _prev: ContactLogState,
  formData: FormData,
): Promise<ContactLogState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const log = await prisma.contactLog.create({
    data: {
      workspaceId: workspace.id,
      clientId: parsed.data.clientId,
      jobId: parsed.data.jobId || null,
      type: parsed.data.type,
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      loggedById: user.id,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ContactLog",
    entityId: log.id,
    action: "create",
    after: log as unknown as Record<string, unknown>,
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  if (parsed.data.jobId) revalidatePath(`/jobs/${parsed.data.jobId}`);
  return { saved: true };
}

const updateSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["PHONE", "EMAIL", "MEETING", "SITE_VISIT", "OTHER"]),
  notes: z.string().trim().min(1).max(5000),
  date: z.string().optional(),
});

export async function updateContactLog(
  _prev: ContactLogState,
  formData: FormData,
): Promise<ContactLogState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const before = await prisma.contactLog.findFirst({
    where: { id: parsed.data.id, workspaceId: workspace.id },
  });
  if (!before) return { error: "notFound" };

  const updated = await prisma.contactLog.update({
    where: { id: parsed.data.id },
    data: {
      type: parsed.data.type,
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : before.date,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ContactLog",
    entityId: updated.id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  revalidatePath(`/clients/${updated.clientId}`);
  if (updated.jobId) revalidatePath(`/jobs/${updated.jobId}`);
  return { saved: true };
}

export async function deleteContactLog(id: string): Promise<ContactLogState> {
  const { user, workspace } = await requireWorkspace();
  const log = await prisma.contactLog.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!log) return { error: "notFound" };

  await prisma.contactLog.delete({ where: { id } });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ContactLog",
    entityId: id,
    action: "delete",
    before: log as unknown as Record<string, unknown>,
  });

  revalidatePath(`/clients/${log.clientId}`);
  if (log.jobId) revalidatePath(`/jobs/${log.jobId}`);
  return { saved: true };
}
