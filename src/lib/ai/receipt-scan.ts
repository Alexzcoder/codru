// Claude vision: read a receipt photo and pull supplier / date / amount /
// VAT into a structured object the expense form can pre-fill.

import { completeJson, type ClaudeImage } from "@/lib/ai/claude";

const SYSTEM_PROMPT = `You are reading a Czech retail or supplier receipt photo. Extract: supplier name, date in ISO format, total amount in CZK, VAT rate (21, 15, 12, or 0), and a short description of the purchase. Numbers may use Czech formatting (comma decimal separator, space thousands). If a field is unclear, return null. Respond only via the supplied tool.`;

const SCHEMA = {
  type: "object",
  required: ["supplier", "date", "total_amount", "vat_rate_percent", "description"],
  properties: {
    supplier: {
      type: ["string", "null"],
      description: "Supplier / shop name as printed on the receipt.",
    },
    date: {
      type: ["string", "null"],
      description: "Receipt date in ISO YYYY-MM-DD.",
    },
    total_amount: {
      type: ["number", "null"],
      description: "Final amount paid in CZK (gross, including VAT).",
    },
    net_amount: {
      type: ["number", "null"],
      description: "Net amount before VAT, if printed separately.",
    },
    vat_amount: {
      type: ["number", "null"],
      description: "VAT amount in CZK, if printed separately.",
    },
    vat_rate_percent: {
      type: ["number", "null"],
      description: "VAT rate (21, 15, 12, or 0). Pick the dominant rate when multiple appear.",
    },
    description: {
      type: ["string", "null"],
      description: "1-line summary of what was purchased (Czech or English).",
    },
  },
};

export type ReceiptScan = {
  supplier: string | null;
  date: string | null;
  totalAmount: number | null;
  netAmount: number | null;
  vatAmount: number | null;
  vatRatePercent: number | null;
  description: string | null;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
};

export async function scanReceiptWithClaude(image: ClaudeImage): Promise<ReceiptScan> {
  const result = await completeJson<{
    supplier: string | null;
    date: string | null;
    total_amount: number | null;
    net_amount: number | null;
    vat_amount: number | null;
    vat_rate_percent: number | null;
    description: string | null;
  }>({
    system: SYSTEM_PROMPT,
    userPrompt: "Extract the receipt fields.",
    images: [image],
    toolName: "extract_receipt",
    toolDescription: "Return the structured fields read from the receipt photo.",
    schema: SCHEMA,
    maxTokens: 600,
    cacheSystemPrompt: true,
  });

  return {
    supplier: result.data.supplier,
    date: result.data.date,
    totalAmount: result.data.total_amount,
    netAmount: result.data.net_amount,
    vatAmount: result.data.vat_amount,
    vatRatePercent: result.data.vat_rate_percent,
    description: result.data.description,
    estimatedCostUsd: result.usage.estimatedCostUsd,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}
