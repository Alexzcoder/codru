"use server";

import { requireUser } from "@/lib/session";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";
import { scanReceiptWithClaude, type ReceiptScan } from "@/lib/ai/receipt-scan";

export type ScanReceiptResult =
  | { ok: true; scan: ReceiptScan }
  | { ok: false; reason: "rate-limit" | "no-key" | "error"; message: string };

export async function scanReceipt(input: {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}): Promise<ScanReceiptResult> {
  const user = await requireUser();
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
    const scan = await scanReceiptWithClaude({
      mediaType: input.mediaType,
      base64: input.base64,
    });
    await logAiCall({
      userId: user.id,
      feature: "receipt-scan",
      usage: {
        inputTokens: scan.inputTokens,
        outputTokens: scan.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: scan.estimatedCostUsd,
      },
      durationMs: Date.now() - t0,
      ok: true,
    });
    return { ok: true, scan };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await logAiCall({
      userId: user.id,
      feature: "receipt-scan",
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
