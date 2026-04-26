// Thin wrapper around Anthropic SDK. Centralises model choice, defaults, and
// cost accounting. Every call goes through here so usage stays observable.

import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = "claude-sonnet-4-6";
// Sonnet 4.6 pricing (USD per million tokens). Used for cost logging only;
// the real authority is your Anthropic console.
const PRICE_PER_M_INPUT_TOKENS = 3.0;
const PRICE_PER_M_OUTPUT_TOKENS = 15.0;
// Cached input tokens are billed at ~10% of standard input, cache writes ~125%.
const PRICE_PER_M_CACHE_READ_TOKENS = 0.3;
const PRICE_PER_M_CACHE_WRITE_TOKENS = 3.75;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type ClaudeUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
};

export type ClaudeJsonResult<T> = {
  data: T;
  usage: ClaudeUsage;
  durationMs: number;
};

export type ClaudeImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
};

// Use tool_use to coerce a strictly-shaped JSON output. Anthropic recommends
// this over "please answer in JSON" prompts because the schema is enforced.
export async function completeJson<T>(opts: {
  system: string;
  userPrompt: string;
  images?: ClaudeImage[];
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  cacheSystemPrompt?: boolean;
}): Promise<ClaudeJsonResult<T>> {
  const t0 = Date.now();
  const c = getClient();

  // Build system blocks with optional ephemeral cache marker. The system
  // prompt is the same across calls of the same feature, so caching saves
  // ~90% on repeat usage.
  const system = opts.cacheSystemPrompt
    ? [{ type: "text" as const, text: opts.system, cache_control: { type: "ephemeral" as const } }]
    : opts.system;

  const resp = await c.messages.create({
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? 600,
    system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [
      {
        role: "user",
        content:
          opts.images && opts.images.length > 0
            ? [
                ...opts.images.map(
                  (img) =>
                    ({
                      type: "image" as const,
                      source: {
                        type: "base64" as const,
                        media_type: img.mediaType,
                        data: img.base64,
                      },
                    }) satisfies Anthropic.ImageBlockParam,
                ),
                { type: "text" as const, text: opts.userPrompt },
              ]
            : opts.userPrompt,
      },
    ],
  });

  // Find the tool_use block — there should be exactly one because we forced it.
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const inputTokens = resp.usage.input_tokens;
  const outputTokens = resp.usage.output_tokens;
  const cacheRead = resp.usage.cache_read_input_tokens ?? 0;
  const cacheWrite = resp.usage.cache_creation_input_tokens ?? 0;
  const estimatedCostUsd =
    (inputTokens * PRICE_PER_M_INPUT_TOKENS +
      outputTokens * PRICE_PER_M_OUTPUT_TOKENS +
      cacheRead * PRICE_PER_M_CACHE_READ_TOKENS +
      cacheWrite * PRICE_PER_M_CACHE_WRITE_TOKENS) /
    1_000_000;

  return {
    data: toolUse.input as T,
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      estimatedCostUsd,
    },
    durationMs: Date.now() - t0,
  };
}

export const CLAUDE_MODEL_ID = MODEL_ID;
