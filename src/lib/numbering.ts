import type { DocumentType, PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Per-day numbering scheme requested by the operator:
//   PREFIX (2 chars) + YY (2 digits) + MM + DD + 4-digit per-day sequence
// Example: an invoice issued 2026-05-07, second one of the day → FA2605070002.
// Sequence resets every day per (numbering scope, type).
//
// NUMBERING SCOPE = THE LEGAL ENTITY, NOT THE WORKSPACE/BRAND.
// A single Czech legal entity (one IČO) must issue ONE continuous, gapless,
// duplicate-free series per document type — even when it trades under several
// brands (workspaces) in this app. We therefore allocate against the *earliest*
// workspace that uses the issuing company profile's IČO. So two brands sharing
// IČO 02995573 share one FA/NA/ZF/OD series; a brand with a different IČO gets
// its own series. See `resolveNumberingScope`.
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

/** Czech IČO is exactly 8 digits. Returns the normalized digits or null. */
export function normalizeIco(ico: string | null | undefined): string | null {
  const digits = (ico ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

// Resolve which workspace's number series this document should draw from.
// All workspaces whose company profile shares the document's IČO are one legal
// entity → they must share a single series. We pick the EARLIEST such workspace
// as the stable owner of the series. If the profile has no usable IČO (demo
// data, junk), we fall back to the document's own workspace (legacy behaviour).
export async function resolveNumberingScope(
  tx: Tx,
  fallbackWorkspaceId: string,
  ico: string | null | undefined,
): Promise<string> {
  const normalized = normalizeIco(ico);
  if (!normalized) return fallbackWorkspaceId;

  // Few profiles in practice; load IČO-bearing ones ordered by workspace age
  // and match on normalized digits so formatting differences don't fragment
  // the series.
  const candidates = await tx.companyProfile.findMany({
    where: { ico: { not: null }, workspace: { deletedAt: null } },
    select: { ico: true, workspaceId: true },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  const primary = candidates.find((c) => normalizeIco(c.ico) === normalized);
  return primary?.workspaceId ?? fallbackWorkspaceId;
}

// Atomically allocate the next number for (scopeWorkspaceId, type, day).
// `scopeWorkspaceId` is the legal-entity series owner from resolveNumberingScope
// — NOT necessarily the document's own workspace.
// Must be called INSIDE a prisma.$transaction so the upsert + update commit together.
// `issueDate` drives the embedded date in the number AND the sequence scope.
export async function allocateNumber(
  tx: Tx,
  scopeWorkspaceId: string,
  type: DocumentType,
  issueDate: Date,
): Promise<{ number: string; seq: number; year: number }> {
  const key = dateKey(issueDate);
  const year = issueDate.getFullYear();
  const existing = await tx.numberSeries.upsert({
    where: { workspaceId_type_dateKey: { workspaceId: scopeWorkspaceId, type, dateKey: key } },
    create: { workspaceId: scopeWorkspaceId, type, dateKey: key, year, nextSeq: 2 },
    update: { nextSeq: { increment: 1 } },
  });
  const seq = existing.nextSeq - 1;
  return { number: format(type, issueDate, seq), seq, year };
}
