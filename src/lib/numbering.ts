import type { DocumentType, PrismaClient } from "@prisma/client";

// Number formats per PRD §10.1/§11.1/§12.1/§13.2.
// One series per type per year, resets annually. Czech-style prefixes:
//   NAB  = Nabídka (quote)
//   ZF   = Zálohová faktura (advance invoice)
//   FA   = Faktura (final invoice)
//   OD   = Opravný daňový doklad (credit note)
const PREFIX: Record<DocumentType, string> = {
  QUOTE: "NAB",
  ADVANCE_INVOICE: "ZF",
  FINAL_INVOICE: "FA",
  CREDIT_NOTE: "OD",
};

function format(type: DocumentType, year: number, seq: number): string {
  return `${PREFIX[type]}-${year}-${String(seq).padStart(3, "0")}`;
}

// Atomically allocate the next number for (workspaceId, type, year).
// Must be called INSIDE a prisma.$transaction so the upsert + update commit together.
export async function allocateNumber(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  workspaceId: string,
  type: DocumentType,
  year: number,
): Promise<{ number: string; seq: number; year: number }> {
  // Upsert with atomic increment. Prisma's `update` with `increment` is a single SQL
  // UPDATE, which holds a row lock inside the transaction — that's what makes this
  // gapless under concurrent issuers.
  const existing = await tx.numberSeries.upsert({
    where: { workspaceId_type_year: { workspaceId, type, year } },
    create: { workspaceId, type, year, nextSeq: 2 }, // just allocated seq=1
    update: { nextSeq: { increment: 1 } },
  });
  const seq = existing.nextSeq - 1; // upsert returns the row AFTER increment
  return { number: format(type, year, seq), seq, year };
}
