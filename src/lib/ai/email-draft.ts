import { completeJson } from "./claude";

const SYSTEM_PROMPT = `You write short, professional Czech-business client emails for a tradesman's CRM. Style: warm but concise, addressed to the client by name when known, references the document number and total, mentions PDF is attached, signs off with the user's name. 3-5 sentences total in the body, plain text (no HTML). Subject is short and specific (no quotes around it).`;

const SCHEMA = {
  type: "object",
  required: ["subject", "body"],
  properties: {
    subject: {
      type: "string",
      description: "Short, specific subject line. No quotes.",
    },
    body: {
      type: "string",
      description:
        "3-5 sentence email body, plain text (no markdown, no HTML). Polite Czech business style if language is 'cs', otherwise English.",
    },
  },
};

export type EmailDraftInput = {
  language: "cs" | "en";
  documentType: "QUOTE" | "ADVANCE_INVOICE" | "FINAL_INVOICE" | "CREDIT_NOTE";
  documentNumber: string | null;
  totalGross: string;
  currency: string;
  clientDisplayName: string;
  companyDisplayName: string;
  senderName: string;
  dueDate: string | null;
  validUntil: string | null;
  customerNote: string | null; // optional extra context user typed
};

export type EmailDraftResult = {
  subject: string;
  body: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export async function draftClientEmail(
  input: EmailDraftInput,
): Promise<EmailDraftResult> {
  const docTypeLabel: Record<EmailDraftInput["documentType"], string> = {
    QUOTE: input.language === "cs" ? "cenová nabídka" : "price quote",
    ADVANCE_INVOICE: input.language === "cs" ? "zálohová faktura" : "advance invoice",
    FINAL_INVOICE: input.language === "cs" ? "faktura" : "invoice",
    CREDIT_NOTE: input.language === "cs" ? "opravný daňový doklad" : "credit note",
  };

  const userPrompt = [
    `Language: ${input.language === "cs" ? "Czech" : "English"}.`,
    `Document type: ${docTypeLabel[input.documentType]}.`,
    `Document number: ${input.documentNumber ?? "(draft)"}.`,
    `Total (incl. VAT): ${input.totalGross} ${input.currency}.`,
    `Client name: ${input.clientDisplayName}.`,
    `Company sending it: ${input.companyDisplayName}.`,
    `Signed by: ${input.senderName}.`,
    input.dueDate ? `Due date: ${input.dueDate}.` : "",
    input.validUntil ? `Valid until: ${input.validUntil}.` : "",
    input.customerNote ? `\nExtra context from user:\n${input.customerNote}` : "",
    "",
    "Draft an email body and a subject line. The PDF is attached automatically — mention this in the body.",
  ]
    .filter(Boolean)
    .join("\n");

  const r = await completeJson<{ subject: string; body: string }>({
    system: SYSTEM_PROMPT,
    userPrompt,
    toolName: "draft_email",
    toolDescription: "Return a structured email draft (subject + plain-text body).",
    schema: SCHEMA,
    maxTokens: 600,
    cacheSystemPrompt: true,
  });

  return {
    subject: r.data.subject,
    body: r.data.body,
    estimatedCostUsd: r.usage.estimatedCostUsd,
    inputTokens: r.usage.inputTokens,
    outputTokens: r.usage.outputTokens,
    durationMs: r.durationMs,
  };
}
