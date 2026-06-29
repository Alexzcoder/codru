"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { readUpload } from "@/lib/uploads";
import { parseDocumentPdf, type ParsedDocument } from "@/lib/ai/document-parser";
import { matchClient } from "@/lib/ai/client-matcher";
import { createDocumentFromParsed } from "@/lib/document-from-parsed";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateSessionState = { error?: string; sessionId?: string };

type BlobRef = { url: string; filename: string; size?: number };

/**
 * Step 1: record a session for PDFs the browser already uploaded directly to
 * Blob storage. We DON'T parse here — uploading + N sequential Claude calls in
 * one request blew the body-size limit and timed out past ~5 files. Instead we
 * create the items as PENDING and redirect to the review page, which parses each
 * one in its own short request (see `parseImportItem`).
 */
export async function createDocumentImportSession(
  _prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const { user, workspace } = await requireWorkspace();

  let blobs: BlobRef[];
  try {
    const raw = formData.get("blobs");
    blobs = raw ? (JSON.parse(String(raw)) as BlobRef[]) : [];
  } catch {
    return { error: "Bad upload payload — please retry." };
  }
  blobs = blobs.filter(
    (b) =>
      b &&
      typeof b.url === "string" &&
      b.url.startsWith("http") &&
      typeof b.filename === "string",
  );
  if (blobs.length === 0) return { error: "Pick at least one PDF." };
  if (blobs.length > 25) return { error: "Max 25 PDFs per session." };

  const capRaw = (formData.get("costCapUsd") as string | null) ?? "";
  const cap = Number.parseFloat(capRaw);
  const costCapUsd = Number.isFinite(cap) && cap > 0 && cap <= 50 ? cap : 5;

  const session = await prisma.documentImportSession.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      status: "PARSING",
      costCapUsd,
    },
  });

  await prisma.documentImportItem.createMany({
    data: blobs.map((b) => ({
      sessionId: session.id,
      filename: b.filename.slice(0, 255),
      storedPath: b.url,
      mimeType: "application/pdf",
      sizeBytes: Math.max(0, Math.round(b.size ?? 0)),
      status: "PENDING" as const,
    })),
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "DocumentImportSession",
    entityId: session.id,
    action: "create",
    after: { fileCount: blobs.length } as unknown as Record<string, unknown>,
  });

  redirect(`/imports/documents/${session.id}`);
}

export type ParseItemState = { ok: boolean; done?: boolean; error?: string };

/**
 * Parse ONE pending import item with Claude. Called once per item from the
 * review page so each runs in its own short request — no body limit, no
 * cumulative timeout, scales to the full 25-file session. Idempotent: a
 * non-PENDING item is a no-op.
 */
export async function parseImportItem(itemId: string): Promise<ParseItemState> {
  const { user, workspace } = await requireWorkspace();
  const item = await prisma.documentImportItem.findFirst({
    where: { id: itemId, session: { workspaceId: workspace.id } },
    include: {
      session: { include: { items: { select: { costUsd: true } } } },
    },
  });
  if (!item) return { ok: false, error: "notFound" };
  // Only PENDING / (interrupted) PARSING are parseable; anything else is a no-op.
  if (item.status !== "PENDING" && item.status !== "PARSING") {
    return { ok: true, done: await maybeFinalizeSession(item.sessionId) };
  }

  // Cost cap — stop spending once the session crosses its budget.
  const spent = item.session.items.reduce((s, i) => s + Number(i.costUsd ?? 0), 0);
  if (spent >= Number(item.session.costCapUsd)) {
    await prisma.documentImportItem.update({
      where: { id: item.id },
      data: { status: "FAILED", parseError: "Skipped — session cost cap reached" },
    });
    return { ok: false, error: "cost cap", done: await maybeFinalizeSession(item.sessionId) };
  }

  await prisma.documentImportItem.update({
    where: { id: item.id },
    data: { status: "PARSING" },
  });

  try {
    const buf = await readUpload(item.storedPath);
    const result = await parseDocumentPdf({
      pdfBase64: buf.toString("base64"),
      filename: item.filename,
    });

    await prisma.aiCall.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        feature: "doc-import-parse",
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
      await prisma.documentImportItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          parseError: result.error ?? "parse failed",
          costUsd: result.estimatedCostUsd,
        },
      });
    } else {
      const match = await matchClient({
        workspaceId: workspace.id,
        parsed: {
          clientName: result.data.clientName ?? null,
          clientIco: result.data.clientIco ?? null,
          clientEmail: result.data.clientEmail ?? null,
        },
      });
      await prisma.documentImportItem.update({
        where: { id: item.id },
        data: {
          status: "PARSED",
          parsed: result.data as unknown as object,
          matchedClientId: match.matchedClientId,
          matchConfidence: match.confidence,
          costUsd: result.estimatedCostUsd,
        },
      });
    }
  } catch (e) {
    await prisma.documentImportItem.update({
      where: { id: item.id },
      data: { status: "FAILED", parseError: e instanceof Error ? e.message : "parse failed" },
    });
  }

  const done = await maybeFinalizeSession(item.sessionId);
  revalidatePath(`/imports/documents/${item.sessionId}`);
  return { ok: true, done };
}

// Flip the session to READY (and tally spend) once nothing is left to parse.
async function maybeFinalizeSession(sessionId: string): Promise<boolean> {
  const remaining = await prisma.documentImportItem.count({
    where: { sessionId, status: { in: ["PENDING", "PARSING"] } },
  });
  if (remaining > 0) return false;
  const agg = await prisma.documentImportItem.aggregate({
    where: { sessionId },
    _sum: { costUsd: true },
  });
  await prisma.documentImportSession.update({
    where: { id: sessionId },
    data: { status: "READY", totalCostUsd: agg._sum.costUsd ?? 0 },
  });
  return true;
}

export type DecisionState = { error?: string };

/**
 * Approve a single parsed item: create the real Document with its line
 * items and attach the source PDF (as a job-style Attachment record on a
 * synthetic placeholder is too heavy — instead the item already carries
 * storedPath, and we record createdDocumentId so the link is two-way).
 */
export async function approveImportItem(
  itemId: string,
  formData: FormData,
): Promise<DecisionState> {
  const { user, workspace } = await requireWorkspace();
  const item = await prisma.documentImportItem.findFirst({
    where: { id: itemId, session: { workspaceId: workspace.id } },
    include: { session: true },
  });
  if (!item) return { error: "notFound" };
  if (item.status !== "PARSED") return { error: "Not in PARSED state" };

  const parsed = item.parsed as unknown as ParsedDocument | null;
  if (!parsed) return { error: "No parsed payload" };

  // The form may carry an override for matchedClientId (user manually
  // re-assigned in the review UI).
  const overrideClientId = (formData.get("clientId") as string | null) ?? null;
  const clientId = overrideClientId || item.matchedClientId;
  if (!clientId) return { error: "Pick a client first" };

  const result = await createDocumentFromParsed({
    workspaceId: workspace.id,
    userId: user.id,
    clientId,
    parsed,
  });
  if ("error" in result) return { error: result.error };

  await prisma.documentImportItem.update({
    where: { id: item.id },
    data: { status: "APPROVED", createdDocumentId: result.documentId },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: result.documentId,
    action: "create",
    after: { source: "doc-import", sessionId: item.sessionId, itemId } as unknown as Record<string, unknown>,
  });

  revalidatePath(`/imports/documents/${item.sessionId}`);
  return {};
}

export async function skipImportItem(itemId: string): Promise<DecisionState> {
  const { user, workspace } = await requireWorkspace();
  const item = await prisma.documentImportItem.findFirst({
    where: { id: itemId, session: { workspaceId: workspace.id } },
  });
  if (!item) return { error: "notFound" };
  await prisma.documentImportItem.update({
    where: { id: itemId },
    data: { status: "SKIPPED" },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "DocumentImportItem",
    entityId: itemId,
    action: "update",
    after: { skipped: true } as unknown as Record<string, unknown>,
  });
  revalidatePath(`/imports/documents/${item.sessionId}`);
  return {};
}

export async function finalizeImportSession(sessionId: string): Promise<DecisionState> {
  const { user, workspace } = await requireWorkspace();
  const session = await prisma.documentImportSession.findFirst({
    where: { id: sessionId, workspaceId: workspace.id },
  });
  if (!session) return { error: "notFound" };
  await prisma.documentImportSession.update({
    where: { id: sessionId },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "DocumentImportSession",
    entityId: sessionId,
    action: "update",
    after: { finalized: true } as unknown as Record<string, unknown>,
  });
  revalidatePath("/imports/documents");
  return {};
}
