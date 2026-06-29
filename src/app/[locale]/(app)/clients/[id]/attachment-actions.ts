"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveClientAttachment, deleteUpload, readUpload } from "@/lib/uploads";
import { parseDocumentPdf } from "@/lib/ai/document-parser";
import { createDocumentFromParsed } from "@/lib/document-from-parsed";
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

// Route a PDF the user attached to a client through the same Claude scanner the
// bulk importer uses, then create a real Document (quote/invoice/credit note)
// linked to that client — so a PDF dropped on a client's Files actually shows up
// in faktury / nabídky, not just as a dumb attachment.
export type ConvertAttachmentState = {
  error?: string;
  documentId?: string;
  type?: string;
};

const DOC_PATH: Record<string, string> = {
  QUOTE: "quotes",
  ADVANCE_INVOICE: "advance-invoices",
  FINAL_INVOICE: "final-invoices",
  CREDIT_NOTE: "credit-notes",
};

export async function convertAttachmentToDocument(
  attachmentId: string,
): Promise<ConvertAttachmentState> {
  const { user, workspace } = await requireWorkspace();
  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, workspaceId: workspace.id, clientId: { not: null } },
  });
  if (!att || !att.clientId) return { error: "notFound" };
  if (att.mimeType !== "application/pdf" && att.kind !== "PDF") {
    return { error: "Only PDF files can become documents." };
  }

  let buf: Buffer;
  try {
    buf = await readUpload(att.path);
  } catch {
    return { error: "Could not read the file." };
  }

  const result = await parseDocumentPdf({
    pdfBase64: buf.toString("base64"),
    filename: att.filename,
  });

  await prisma.aiCall.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      feature: "client-attachment-to-doc",
      model: "claude-sonnet-4-6",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cacheReadTokens: result.cacheReadTokens,
      cacheWriteTokens: result.cacheWriteTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      durationMs: result.durationMs,
      ok: result.ok,
      errorMessage: result.error ?? null,
    },
  });

  if (!result.ok || !result.data) {
    return { error: result.error ?? "Could not read this PDF." };
  }

  const created = await createDocumentFromParsed({
    workspaceId: workspace.id,
    userId: user.id,
    clientId: att.clientId,
    parsed: result.data,
  });
  if ("error" in created) return { error: created.error };

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: created.documentId,
    action: "create",
    after: { source: "client-attachment", attachmentId } as unknown as Record<string, unknown>,
  });

  revalidatePath(`/clients/${att.clientId}`);
  revalidatePath(`/${DOC_PATH[created.type] ?? "final-invoices"}`);
  return { documentId: created.documentId, type: created.type };
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
