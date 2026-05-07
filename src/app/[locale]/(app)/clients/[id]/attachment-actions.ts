"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveClientAttachment, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

const MAX_FILES_PER_CLIENT = 100;

export type ClientAttachmentState = {
  error?: string;
  uploadedCount?: number;
};

export async function uploadClientAttachment(
  clientId: string,
  _prev: ClientAttachmentState,
  formData: FormData,
): Promise<ClientAttachmentState> {
  const { user, workspace } = await requireWorkspace();
  const rawFiles = formData.getAll("file");
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  if (files.length === 0) return { error: "Pick at least one file." };

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id, deletedAt: null },
    select: { id: true },
  });
  if (!client) return { error: "Client not found in this workspace." };

  const existing = await prisma.attachment.count({
    where: { clientId, workspaceId: workspace.id },
  });
  if (existing + files.length > MAX_FILES_PER_CLIENT) {
    const remaining = Math.max(0, MAX_FILES_PER_CLIENT - existing);
    return {
      error:
        remaining === 0
          ? `Limit reached (${MAX_FILES_PER_CLIENT} files per client).`
          : `Only ${remaining} more file${remaining === 1 ? "" : "s"} fits.`,
    };
  }

  let uploaded = 0;
  const failures: string[] = [];
  for (const file of files) {
    try {
      const saved = await saveClientAttachment({ file, clientId });
      const att = await prisma.attachment.create({
        data: {
          workspaceId: workspace.id,
          clientId,
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
        entity: "Attachment",
        entityId: att.id,
        action: "create",
        after: { clientId, filename: att.filename } as unknown as Record<string, unknown>,
      });
      uploaded++;
    } catch (e) {
      failures.push(
        `${file.name}: ${e instanceof Error ? e.message : "uploadFailed"}`,
      );
    }
  }

  revalidatePath(`/clients/${clientId}`);

  if (uploaded === 0) return { error: failures[0] ?? "uploadFailed" };
  if (failures.length > 0) {
    return {
      uploadedCount: uploaded,
      error: `${failures.length} file(s) failed: ${failures.slice(0, 3).join("; ")}`,
    };
  }
  return { uploadedCount: uploaded };
}

export async function deleteClientAttachment(attachmentId: string): Promise<{ error?: string }> {
  const { user, workspace } = await requireWorkspace();
  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, workspaceId: workspace.id, clientId: { not: null } },
  });
  if (!att) return { error: "notFound" };

  await prisma.attachment.delete({ where: { id: att.id } });
  // Best-effort delete of the underlying file. If it errors (e.g. blob already
  // gone), we still want the DB row removed.
  await deleteUpload(att.path);

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Attachment",
    entityId: att.id,
    action: "delete",
    before: att as unknown as Record<string, unknown>,
  });

  if (att.clientId) revalidatePath(`/clients/${att.clientId}`);
  return {};
}
