"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveImportSessionPdf } from "@/lib/uploads";
import { parseDocumentPdf, type ParsedDocument } from "@/lib/ai/document-parser";
import { matchClient } from "@/lib/ai/client-matcher";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateSessionState = { error?: string; sessionId?: string };

/**
 * Step 1: receive the user's chosen PDFs, save them, kick off Claude on each,
 * and persist parsed JSON + matched-client suggestions. Sequential so we
 * don't blow the cost cap unintentionally; with prompt caching this is
 * still fast (~2-4s/file). When done, the user is redirected to the
 * review page.
 */
export async function createDocumentImportSession(
  _prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const { user, workspace } = await requireWorkspace();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Pick at least one PDF." };
  if (files.length > 25) return { error: "Max 25 PDFs per session." };

  // Validate each is a PDF before we charge anything to Anthropic.
  for (const f of files) {
    if (f.type !== "application/pdf") {
      return { error: `Only PDFs accepted — got ${f.type || "unknown"} for "${f.name}".` };
    }
  }

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

  // Save all PDFs first (so user gets the review page even if AI hiccups).
  const items = [];
  for (const f of files) {
    const item = await prisma.documentImportItem.create({
      data: {
        sessionId: session.id,
        filename: f.name,
        storedPath: "", // updated below once we have its ID
        mimeType: f.type,
        sizeBytes: f.size,
        status: "PENDING",
      },
    });
    let saved;
    try {
      saved = await saveImportSessionPdf({ file: f, sessionId: session.id, itemId: item.id });
    } catch (e) {
      await prisma.documentImportItem.update({
        where: { id: item.id },
        data: { status: "FAILED", parseError: e instanceof Error ? e.message : "save failed" },
      });
      continue;
    }
    await prisma.documentImportItem.update({
      where: { id: item.id },
      data: { storedPath: saved.path },
    });
    items.push({ ...item, storedPath: saved.path });
  }

  // Parse each in turn. Stop early if cost cap hit.
  let totalCost = 0;
  for (const item of items) {
    if (totalCost >= costCapUsd) {
      await prisma.documentImportItem.update({
        where: { id: item.id },
        data: { status: "FAILED", parseError: "Skipped — session cost cap reached" },
      });
      continue;
    }
    await prisma.documentImportItem.update({
      where: { id: item.id },
      data: { status: "PARSING" },
    });
    const buf = await fs.readFile(path.join(process.cwd(), "public", item.storedPath));
    const result = await parseDocumentPdf({
      pdfBase64: buf.toString("base64"),
      filename: item.filename,
    });
    totalCost += result.estimatedCostUsd;

    // Always log the AI call for audit / spend visibility.
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
      continue;
    }

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

  await prisma.documentImportSession.update({
    where: { id: session.id },
    data: { status: "READY", totalCostUsd: totalCost },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "DocumentImportSession",
    entityId: session.id,
    action: "create",
    after: { fileCount: files.length, totalCostUsd: totalCost } as unknown as Record<string, unknown>,
  });

  redirect(`/imports/documents/${session.id}`);
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

  // Default company profile + document template (the user can edit afterward).
  const profile = await prisma.companyProfile.findFirst({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!profile) return { error: "Create a company profile first" };
  const docType = parsed.documentType === "UNKNOWN" ? "FINAL_INVOICE" : parsed.documentType;
  const tpl = await prisma.documentTemplate.findFirst({
    where: {
      companyProfileId: profile.id,
      type: docType as "QUOTE" | "ADVANCE_INVOICE" | "FINAL_INVOICE" | "CREDIT_NOTE",
      archivedAt: null,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!tpl) return { error: `No template configured for ${docType}` };

  const issueDate = parsed.issueDate ? new Date(parsed.issueDate) : new Date();
  const taxPointDate = parsed.taxPointDate ? new Date(parsed.taxPointDate) : issueDate;
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : issueDate;

  const lines = (parsed.lineItems ?? [])
    .filter((l) => l.name && l.name.trim().length > 0)
    .map((l, i) => ({
      position: i + 1,
      name: l.name.slice(0, 200),
      description: l.description ?? null,
      quantity: (l.quantity ?? 1).toString(),
      unit: l.unit ?? "ks",
      unitPrice: (l.unitPrice ?? l.totalNet ?? 0).toString(),
      taxRatePercent: (l.taxRatePercent ?? 21).toString(),
      taxMode: "NET" as const,
    }));

  // Imported docs are already real-world: import them as SENT (skip the
  // gapless numbering trip — we don't auto-number imported history because
  // they already have their own number on the source PDF).
  const created = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      type: docType as "QUOTE" | "ADVANCE_INVOICE" | "FINAL_INVOICE" | "CREDIT_NOTE",
      status: "SENT",
      number: parsed.number ?? null,
      clientId,
      companyProfileId: profile.id,
      documentTemplateId: tpl.id,
      createdById: user.id,
      currency: (parsed.currency as "CZK" | "EUR" | "USD" | null) ?? "CZK",
      locale: "cs",
      issueDate,
      taxPointDate,
      dueDate,
      reverseCharge: false,
      notesToClient: parsed.notes ?? null,
      lineItems: { create: lines },
    },
  });

  await prisma.documentImportItem.update({
    where: { id: item.id },
    data: { status: "APPROVED", createdDocumentId: created.id },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: created.id,
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
