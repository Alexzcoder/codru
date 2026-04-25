"use server";

import { requireUser } from "@/lib/session";
import { suggestPrice as suggest, type Suggestion } from "./index";
import { estimateWithClaude, type AiEstimate } from "./ai-estimate";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";

export async function suggestPriceForDescription(
  description: string,
): Promise<Suggestion> {
  await requireUser();
  if (!description || description.trim().length < 3) {
    return { matches: [], stats: null };
  }
  return suggest(description, { topK: 8, minScore: 0.5 });
}

export type AskAiResult =
  | { ok: true; estimate: AiEstimate }
  | { ok: false; reason: "rate-limit" | "no-key" | "error"; message: string };

export async function askClaudeForPrice(description: string): Promise<AskAiResult> {
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
    const est = await estimateWithClaude(description);
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
