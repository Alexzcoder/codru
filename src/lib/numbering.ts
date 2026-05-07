import type { DocumentType, PrismaClient } from "@prisma/client";

// Per-day numbering scheme requested by the operator:
//   PREFIX (2 chars) + YY (2 digits) + MM + DD + 4-digit per-day sequence
// Example: an invoice issued 2026-05-07, second one of the day → FA2605070002.
// Sequence resets every day per (workspaceId, type).
// Czech-style prefixes:
//   NA = Nabídka, ZF = Zálohová faktura, FA = Faktura, OD = Opravný daňový doklad.
const PREFIX: Record<DocumentType, string> = {
  QUOTE: "NA",
  ADVANCE_INVOICE: "ZF",
  FINAL_INVOICE: "FA",
  CREDIT_NOTE: "OD",
};

function dateKey(d: Date): number {
  // YYYYMMDD as a single integer — sortable, unique per-day, fits in INT.
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y * 10000 + m * 100 + day;
}

function format(type: DocumentType, d: Date, seq: number): string {
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${PREFIX[type]}${yy}${mm}${dd}${String(seq).padStart(4, "0")}`;
}

// Atomically allocate the next number for (workspaceId, type, day).
// Must be called INSIDE a prisma.$transaction so the upsert + update commit together.
// `issueDate` drives the embedded date in the number AND the sequence scope.
export async function allocateNumber(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  workspaceId: string,
  type: DocumentType,
  issueDate: Date,
): Promise<{ number: string; seq: number; year: number }> {
  const key = dateKey(issueDate);
  const year = issueDate.getFullYear();
  const existing = await tx.numberSeries.upsert({
    where: { workspaceId_type_dateKey: { workspaceId, type, dateKey: key } },
    create: { workspaceId, type, dateKey: key, year, nextSeq: 2 },
    update: { nextSeq: { increment: 1 } },
  });
  const seq = existing.nextSeq - 1;
  return { number: format(type, issueDate, seq), seq, year };
}
