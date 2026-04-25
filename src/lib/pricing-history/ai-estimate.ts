// Claude-powered price estimate for line items where BM25 retrieval is weak
// or you want a sanity-check second opinion. Feeds Claude the user's
// description plus the top retrieved historical lines so it can reason on
// known anchor prices, not from scratch.

import { completeJson } from "@/lib/ai/claude";
import { suggestPrice } from "./index";

const SYSTEM_PROMPT = `You are pricing a line item for a Czech construction / handyman quote (VENIREX s.r.o., based in Prague). Use the user's own past prices (provided in the prompt) as anchors. Prices are in Kč (CZK), excluding VAT, per unit (per piece by default; or per m², bm, etc. when stated). Round to clean amounts (50/100). If the new line is clearly comparable to one or two past lines, anchor close to those. If it is composite (multiple sub-tasks), price proportionally. Always give a confidence level: "high" if you have ≥3 close matches, "medium" if 1-2 weak matches, "low" if you are extrapolating. Reasoning should be 1-2 short sentences in English, citing which historical lines you anchored on.`;

export type AiEstimate = {
  unitPrice: number;
  unit: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
};

const SCHEMA = {
  type: "object",
  required: ["unit_price", "unit", "confidence", "reasoning"],
  properties: {
    unit_price: {
      type: "number",
      description: "Suggested unit price in Kč (CZK), excluding VAT.",
    },
    unit: {
      type: "string",
      description: "Unit (e.g., 'ks', 'm²', 'bm', or empty if pricing the whole task as one).",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Confidence in the estimate based on availability of comparable past lines.",
    },
    reasoning: {
      type: "string",
      description: "One or two short sentences citing which historical line(s) you anchored on.",
    },
  },
};

export async function estimateWithClaude(
  description: string,
): Promise<AiEstimate> {
  const retrieval = suggestPrice(description, { topK: 8, minScore: 0 });
  const context = retrieval.matches
    .slice(0, 8)
    .map(
      (m, i) =>
        `${i + 1}. "${m.description}"${m.unit ? ` [${m.unit}]` : ""} — ${m.unitPrice.toFixed(0)} Kč (${m.issueDate ?? "n.d."})`,
    )
    .join("\n");

  const userPrompt = `New line item to price:
"${description}"

Past lines from this same business that may be relevant:
${context || "(no close matches found)"}

Suggest a unit price.`;

  const result = await completeJson<{
    unit_price: number;
    unit: string;
    confidence: "low" | "medium" | "high";
    reasoning: string;
  }>({
    system: SYSTEM_PROMPT,
    userPrompt,
    toolName: "suggest_price",
    toolDescription: "Return a structured price suggestion for the new line item.",
    schema: SCHEMA,
    maxTokens: 400,
    cacheSystemPrompt: true,
  });

  return {
    unitPrice: result.data.unit_price,
    unit: result.data.unit,
    confidence: result.data.confidence,
    reasoning: result.data.reasoning,
    estimatedCostUsd: result.usage.estimatedCostUsd,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}
