"use server";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { suggestPrice as suggest, type Suggestion, type HistoricalLine } from "./index";
import { estimateWithClaude, type AiEstimate } from "./ai-estimate";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";

export type ContextLine = { name: string; description?: string | null };

// Pull line items from the user's own documents so anything they billed since
// onboarding feeds back into the retrieval corpus. Cheap-ish: typical user
// has <2k lines, query is one indexed scan.
async function loadDbLines(): Promise<HistoricalLine[]> {
  const rows = await prisma.documentLineItem.findMany({
    where: { document: { deletedAt: null } },
    select: {
      name: true,
      description: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      taxRatePercent: true,
      document: { select: { number: true, issueDate: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return rows.map((r) => {
    const qty = Number(r.quantity);
    const unitPrice = Number(r.unitPrice);
    const vatPct = Number(r.taxRatePercent);
    const desc = [r.name, r.description].filter(Boolean).join(" — ");
    return {
      description: desc,
      quantity: qty,
      unit: r.unit ?? "",
      unit_price: unitPrice,
      vat_percent: vatPct,
      net: unitPrice * qty,
      vat: unitPrice * qty * (vatPct / 100),
      gross: unitPrice * qty * (1 + vatPct / 100),
      source: r.document?.number ?? "this workspace",
      doc_number: r.document?.number ?? "",
      issue_date: r.document?.issueDate?.toISOString().slice(0, 10) ?? null,
    };
  });
}

export async function suggestPriceForDescription(
  description: string,
  contextLines: ContextLine[] = [],
): Promise<Suggestion> {
  await requireUser();
  if (!description || description.trim().length < 3) {
    return { matches: [], stats: null };
  }
  const extraLines = await loadDbLines();
  return suggest(description, {
    topK: 8,
    minScore: 0.5,
    extraLines,
    contextLines,
  });
}

export type AskAiResult =
  | { ok: true; estimate: AiEstimate }
  | { ok: false; reason: "rate-limit" | "no-key" | "error"; message: string };

export async function askClaudeForPrice(
  description: string,
  contextLines: ContextLine[] = [],
): Promise<AskAiResult> {
  const user = await requireUser();
  if (!description || description.trim().length < 3) {
    return { ok: false, reason: "error", message: "Description too short" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      reason: "no-key",
      message: "ANTHROPIC_API_KEY is not set in this environment.",
    };
  }
  const cap = await checkDailyCap(user.id);
  if (!cap.ok) {
    return {
      ok: false,
      reason: "rate-limit",
      message: `Daily AI call limit reached (${cap.callsToday}/${cap.cap}).`,
    };
  }
  const t0 = Date.now();
  try {
    const extraLines = await loadDbLines();
    const est = await estimateWithClaude(description, { contextLines, extraLines });
    await logAiCall({
      userId: user.id,
      feature: "price-suggest",
      usage: {
        inputTokens: est.inputTokens,
        outputTokens: est.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: est.estimatedCostUsd,
      },
      durationMs: Date.now() - t0,
      ok: true,
    });
    return { ok: true, estimate: est };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await logAiCall({
      userId: user.id,
      feature: "price-suggest",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0,
      },
      durationMs: Date.now() - t0,
      ok: false,
      errorMessage: message,
    });
    return { ok: false, reason: "error", message };
  }
}
