import { prisma } from "@/lib/prisma";
import type { ClaudeUsage } from "./claude";
import { CLAUDE_MODEL_ID } from "./claude";

// Per-user daily soft cap. Surfaces a friendly error instead of calling Claude
// once exceeded. 50 calls/day at ~$0.0075 each = ~$0.40/day max per user.
const PER_USER_DAILY_CAP = Number(process.env.AI_DAILY_CAP_PER_USER ?? 50);

export async function checkDailyCap(userId: string | null): Promise<{
  ok: boolean;
  callsToday: number;
  cap: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const callsToday = await prisma.aiCall.count({
    where: {
      ...(userId ? { userId } : {}),
      createdAt: { gte: since },
      ok: true,
    },
  });
  return { ok: callsToday < PER_USER_DAILY_CAP, callsToday, cap: PER_USER_DAILY_CAP };
}

export async function logAiCall(opts: {
  userId: string | null;
  feature: string;
  usage: ClaudeUsage;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.aiCall.create({
      data: {
        userId: opts.userId,
        feature: opts.feature,
        model: CLAUDE_MODEL_ID,
        inputTokens: opts.usage.inputTokens,
        outputTokens: opts.usage.outputTokens,
        cacheReadTokens: opts.usage.cacheReadTokens,
        cacheWriteTokens: opts.usage.cacheWriteTokens,
        estimatedCostUsd: opts.usage.estimatedCostUsd.toFixed(6),
        durationMs: opts.durationMs,
        ok: opts.ok,
        errorMessage: opts.errorMessage,
      },
    });
  } catch {
    // Never fail the user-facing call because of an audit-write failure.
  }
}
