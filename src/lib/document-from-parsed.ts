import { prisma } from "./prisma";
import type { ParsedDocument } from "./ai/document-parser";

type DocType = "QUOTE" | "ADVANCE_INVOICE" | "FINAL_INVOICE" | "CREDIT_NOTE";

// Turn a Claude-parsed PDF into a real Document (status SENT — imported docs are
// already real-world, so we skip gapless auto-numbering and keep their own
// number from the source PDF). Shared by the bulk document importer and the
// "make document from a client's uploaded PDF" action so both stay identical.
export async function createDocumentFromParsed(opts: {
  workspaceId: string;
  userId: string;
  clientId: string;
  parsed: ParsedDocument;
}): Promise<{ documentId: string; type: DocType } | { error: string }> {
  const { workspaceId, userId, clientId, parsed } = opts;

  const profile = await prisma.companyProfile.findFirst({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!profile) return { error: "Create a company profile first" };

  const docType: DocType =
    parsed.documentType === "UNKNOWN" ? "FINAL_INVOICE" : parsed.documentType;
  const tpl = await prisma.documentTemplate.findFirst({
    where: { companyProfileId: profile.id, type: docType, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!tpl) return { error: `No template configured for ${docType}` };

  const issueDate = parsed.issueDate ? new Date(parsed.issueDate) : new Date();
  const taxPointDate = parsed.taxPointDate ? new Date(parsed.taxPointDate) : issueDate;
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : issueDate;

  const lines = (parsed.lineItems ?? [])
    .filter((l) => l.name && l.name.trim().length > 0)
    .map((l, i) => ({
      position: i + 1,
      name: l.name.slice(0, 200),
      description: l.description ?? null,
      quantity: (l.quantity ?? 1).toString(),
      unit: l.unit ?? "ks",
      unitPrice: (l.unitPrice ?? l.totalNet ?? 0).toString(),
      taxRatePercent: (l.taxRatePercent ?? 21).toString(),
      taxMode: "NET" as const,
    }));

  const created = await prisma.document.create({
    data: {
      workspaceId,
      type: docType,
      status: "SENT",
      number: parsed.number ?? null,
      clientId,
      companyProfileId: profile.id,
      documentTemplateId: tpl.id,
      createdById: userId,
      currency: (parsed.currency as "CZK" | "EUR" | "USD" | null) ?? "CZK",
      locale: "cs",
      issueDate,
      taxPointDate,
      dueDate,
      reverseCharge: false,
      notesToClient: parsed.notes ?? null,
      lineItems: { create: lines },
    },
  });

  return { documentId: created.id, type: docType };
}
