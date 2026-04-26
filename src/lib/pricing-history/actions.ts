"use server";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { suggestPrice as suggest, type Suggestion, type HistoricalLine } from "./index";
import { estimateWithClaude, type AiEstimate } from "./ai-estimate";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";
import type { ClaudeImage } from "@/lib/ai/claude";

export type ContextLine = { name: string; description?: string | null };

// Hard cap to keep cost predictable. 4 photos × ~1500 tokens ≈ $0.018 per call.
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type SaveTemplateResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

// "Memorise" a price as a reusable ItemTemplate so it appears in the dropdown
// on future quotes. Adjacent to the AI suggester — an explicit way for the
// user to lock in a label like "Tall grass (2m)" with its current best price.
export async function saveLineAsItemTemplate(input: {
  name: string;
  description?: string | null;
  unit: string;
  unitPrice: number;
  taxRatePercent?: number | null;
}): Promise<SaveTemplateResult> {
  await requireUser();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: "Name is too short." };
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    return { ok: false, message: "Price must be positive." };
  }

  // Resolve unit by name (case-insensitive). If the AI returned an unknown
  // unit, fall back to the workspace's first unit so we never block save.
  const { sanitizeUnitName } = await import("@/lib/sanitize");
  const unitName = sanitizeUnitName(input.unit || "") || "ks";
  const unit =
    (await prisma.unit.findFirst({
      where: { name: { equals: unitName, mode: "insensitive" }, archivedAt: null },
    })) ??
    (await prisma.unit.findFirst({ where: { archivedAt: null }, orderBy: { name: "asc" } }));
  if (!unit) return { ok: false, message: "No units configured." };

  // Resolve tax rate: prefer the percent the user picked, else the default,
  // else the highest. Czech standard is 21 %.
  const taxRate =
    (input.taxRatePercent != null
      ? await prisma.taxRate.findFirst({
          where: { percent: input.taxRatePercent, archivedAt: null },
        })
      : null) ??
    (await prisma.taxRate.findFirst({
      where: { archivedAt: null, isDefault: true },
    })) ??
    (await prisma.taxRate.findFirst({
      where: { archivedAt: null },
      orderBy: { percent: "desc" },
    }));
  if (!taxRate) return { ok: false, message: "No tax rates configured." };

  const tpl = await prisma.itemTemplate.create({
    data: {
      name,
      description: input.description?.trim() || null,
      unitId: unit.id,
      defaultQuantity: "1",
      defaultUnitPrice: input.unitPrice.toFixed(2),
      defaultTaxRateId: taxRate.id,
      defaultTaxMode: "NET",
    },
  });
  return { ok: true, id: tpl.id };
}

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
  photos: ClaudeImage[] = [],
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
  const safePhotos = photos
    .slice(0, MAX_PHOTOS)
    .filter((p) => {
      // base64 length × 0.75 ≈ byte count
      const approxBytes = (p.base64?.length ?? 0) * 0.75;
      return approxBytes > 0 && approxBytes <= MAX_PHOTO_BYTES;
    });
  const t0 = Date.now();
  try {
    const extraLines = await loadDbLines();
    const est = await estimateWithClaude(description, {
      contextLines,
      extraLines,
      images: safePhotos,
    });
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
