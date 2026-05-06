// Multimodal Claude call that takes one PDF (as base64) and returns a
// structured representation of the document inside (quote / advance invoice
// / final invoice / credit note / unknown), the issuing & receiving party,
// dates, totals, and line items. We use a tool-calling schema for forced
// JSON output — much more reliable than parsing free-form text.
//
// Cost is small per file (one Sonnet call, a few thousand tokens). The
// system prompt is identical across files in a session, so prompt caching
// at Anthropic's side absorbs most of the per-file overhead.

import Anthropic from "@anthropic-ai/sdk";

export type ParsedDocumentType =
  | "QUOTE"
  | "ADVANCE_INVOICE"
  | "FINAL_INVOICE"
  | "CREDIT_NOTE"
  | "UNKNOWN";

export type ParsedLineItem = {
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  taxRatePercent?: number | null;
  totalNet?: number | null;
  totalGross?: number | null;
};

export type ParsedDocument = {
  documentType: ParsedDocumentType;
  number?: string | null;
  issueDate?: string | null; // YYYY-MM-DD
  dueDate?: string | null;
  taxPointDate?: string | null;
  currency?: string | null; // CZK / EUR / USD
  totalNet?: number | null;
  totalVat?: number | null;
  totalGross?: number | null;
  // Issuing party (ours)
  issuerName?: string | null;
  issuerIco?: string | null;
  issuerDic?: string | null;
  // Receiving party (client)
  clientName?: string | null;
  clientIco?: string | null;
  clientDic?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  notes?: string | null;
  lineItems: ParsedLineItem[];
  // 0..1 self-reported confidence the model has in the overall extraction
  confidence?: number | null;
};

export type ParseResult = {
  ok: boolean;
  data?: ParsedDocument;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
};

const PARSE_TOOL: import("@anthropic-ai/sdk").Anthropic.Tool = {
  name: "extract_document",
  description:
    "Extract structured fields from a Czech business PDF (quote/invoice/credit note).",
  input_schema: {
    type: "object",
    properties: {
      documentType: {
        type: "string",
        enum: ["QUOTE", "ADVANCE_INVOICE", "FINAL_INVOICE", "CREDIT_NOTE", "UNKNOWN"],
        description:
          "QUOTE = nabídka/cenová nabídka. ADVANCE_INVOICE = zálohová faktura. FINAL_INVOICE = faktura/daňový doklad. CREDIT_NOTE = opravný daňový doklad/dobropis. UNKNOWN if not a Czech business document.",
      },
      number: { type: ["string", "null"], description: "Document number (e.g. 2025001)." },
      issueDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD; the issuance/billing date." },
      dueDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD; the payment due date." },
      taxPointDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD; DUZP." },
      currency: { type: ["string", "null"], enum: ["CZK", "EUR", "USD", null] },
      totalNet: { type: ["number", "null"] },
      totalVat: { type: ["number", "null"] },
      totalGross: { type: ["number", "null"], description: "Final amount the client owes/paid." },
      issuerName: { type: ["string", "null"] },
      issuerIco: { type: ["string", "null"] },
      issuerDic: { type: ["string", "null"] },
      clientName: { type: ["string", "null"], description: "Receiving party (Odběratel)." },
      clientIco: { type: ["string", "null"] },
      clientDic: { type: ["string", "null"] },
      clientEmail: { type: ["string", "null"] },
      clientPhone: { type: ["string", "null"] },
      clientAddress: { type: ["string", "null"], description: "Single-line address as printed." },
      notes: { type: ["string", "null"], description: "Any free-text notes (Poznámka pro klienta)." },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: ["string", "null"] },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            unitPrice: { type: ["number", "null"] },
            taxRatePercent: { type: ["number", "null"] },
            totalNet: { type: ["number", "null"] },
            totalGross: { type: ["number", "null"] },
          },
          required: ["name"],
        },
      },
      confidence: {
        type: ["number", "null"],
        description: "0..1 self-rating: how confident are you the extraction is correct?",
      },
    },
    required: ["documentType", "lineItems"],
  },
};

const SYSTEM_PROMPT = [
  "You read Czech business PDFs (quotes, invoices, credit notes) and extract their fields.",
  "Always respond by calling the extract_document tool exactly once. Never write free-form prose.",
  "Czech terms you'll see: Nabídka (quote), Zálohová faktura (advance), Faktura/Daňový doklad (final invoice), Opravný daňový doklad (credit note), Dodavatel (issuer/us), Odběratel (client), DUZP (tax point), Splatnost (due), IČO, DIČ.",
  "Numbers in CZ use a comma decimal separator and spaces as thousands. Convert to plain decimals (e.g. '12 345,67' → 12345.67).",
  "If a field is genuinely missing from the PDF, return null for it — do not guess.",
  "Return the documentType as UNKNOWN if the PDF clearly isn't one of the four supported types.",
].join(" ");

// Sonnet 4.6 pricing as of 2026 — see Anthropic console for current rates.
const PRICING_PER_MTOK = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
} as const;

function estimateCost(model: string, usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): number {
  const p = PRICING_PER_MTOK[model as keyof typeof PRICING_PER_MTOK] ?? PRICING_PER_MTOK["claude-sonnet-4-6"];
  return (
    (usage.input_tokens * p.input) / 1_000_000 +
    (usage.output_tokens * p.output) / 1_000_000 +
    ((usage.cache_read_input_tokens ?? 0) * p.cacheRead) / 1_000_000 +
    ((usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1_000_000
  );
}

export async function parseDocumentPdf({
  pdfBase64,
  filename,
  model = "claude-sonnet-4-6",
}: {
  pdfBase64: string;
  filename: string;
  model?: string;
}): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY not set",
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      estimatedCostUsd: 0, durationMs: 0,
    };
  }
  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        // Cache the system prompt — it's identical across every file in a
        // session, so subsequent calls hit Anthropic's prompt cache for ~90%
        // discount on this portion.
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "extract_document" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            {
              type: "text",
              text: `Extract the fields from this PDF (filename: ${filename}). Call the extract_document tool with your structured answer.`,
            },
          ],
        },
      ],
    });

    const usage = resp.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
    };
    const cost = estimateCost(model, usage);
    const tu = resp.content.find((c) => c.type === "tool_use");
    if (!tu || tu.type !== "tool_use") {
      return {
        ok: false,
        error: "Model did not return a tool call",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        estimatedCostUsd: cost,
        durationMs: Date.now() - start,
      };
    }
    const data = tu.input as ParsedDocument;
    return {
      ok: true,
      data,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      estimatedCostUsd: cost,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      estimatedCostUsd: 0,
      durationMs: Date.now() - start,
    };
  }
}
