import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Document, DocumentLineItem, DocumentType } from "@prisma/client";
import { prisma } from "./prisma";
import { allocateNumber } from "./numbering";
import { DocumentPdf } from "./pdf/document-pdf";
import { buildQrPlatbaDataUrl } from "./pdf/qr-platba";
import { calculateDocument } from "./line-items";
import { clientDisplayName } from "./client-display";
import type { PdfDocumentData, PdfLineItem } from "./pdf/types";
import { writeAudit } from "./audit";

export type DocumentWithLines = Document & { lineItems: DocumentLineItem[] };

// Map a Document row into the shape the PDF renderer wants. Fetches all the
// related entities it needs (client, company profile, template, creator).
export async function buildPdfDataForDocument(
  doc: DocumentWithLines,
): Promise<PdfDocumentData> {
  const [client, company, creator, original] = await Promise.all([
    prisma.client.findUnique({ where: { id: doc.clientId } }),
    prisma.companyProfile.findUnique({ where: { id: doc.companyProfileId } }),
    prisma.user.findUnique({ where: { id: doc.createdById } }),
    doc.originalDocumentId
      ? prisma.document.findUnique({ where: { id: doc.originalDocumentId } })
      : Promise.resolve(null),
  ]);
  if (!client || !company) throw new Error("Missing related entities");

  const absolute = (p: string | null | undefined) =>
    p && p.startsWith("/uploads/") ? path.join(process.cwd(), "public", p) : null;

  const lines: PdfLineItem[] = doc.lineItems
    .sort((a, b) => a.position - b.position)
    .map((l) => ({
      position: l.position,
      name: l.name,
      description: l.description,
      quantity: l.quantity.toString(),
      unit: l.unit,
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    }));

  return {
    type: doc.type,
    locale: doc.locale,
    currency: doc.currency,
    // Drafts haven't been allocated a real number yet — gapless numbering
    // only fires on send. Show "KONCEPT" so the PDF clearly says "draft"
    // instead of the random-looking cuid suffix we used to print.
    number: doc.number ?? (doc.locale === "en" ? "DRAFT" : "KONCEPT"),
    issueDate: doc.issueDate,
    taxPointDate: doc.taxPointDate,
    dueDate: doc.dueDate,
    validUntil: doc.validUntilDate,
    variableSymbol: doc.number ? doc.number.replace(/\D/g, "") : null,
    company: {
      name: company.name,
      ico: company.ico,
      dic: company.dic,
      addressStreet: company.addressStreet,
      addressCity: company.addressCity,
      addressZip: company.addressZip,
      addressCountry: company.addressCountry,
      iban: company.iban,
      swift: company.swift,
      accountNumber: company.accountNumber,
      logoAbsolutePath: absolute(company.logoPath),
      defaultFooterText: company.defaultFooterText,
    },
    client: {
      type: client.type,
      displayName: clientDisplayName(client),
      ico: client.ico,
      dic: client.dic,
      addressStreet: client.addressStreet,
      addressCity: client.addressCity,
      addressZip: client.addressZip,
      addressCountry: client.addressCountry,
    },
    lines,
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
    originalDocumentNumber: original?.number ?? null,
    creditReason: doc.creditReason,
    notesToClient: doc.notesToClient,
    signatureAbsolutePath: absolute(creator?.signatureImagePath),
    issuedByName: creator?.name ?? null,
  };
}

// Render a PDF in memory. Used both for previews (no persistence) and snapshots.
export async function renderDocumentPdf(doc: DocumentWithLines): Promise<Buffer> {
  const template = await prisma.documentTemplate.findUnique({
    where: { id: doc.documentTemplateId },
  });
  if (!template) throw new Error("Template missing");

  const data = await buildPdfDataForDocument(doc);

  const totals = calculateDocument({
    lines: data.lines,
    documentDiscountPercent: data.documentDiscountPercent ?? undefined,
    documentDiscountAmount: data.documentDiscountAmount ?? undefined,
    reverseCharge: data.reverseCharge,
  });

  const qr =
    template.showQrPlatba &&
    (doc.type === "ADVANCE_INVOICE" || doc.type === "FINAL_INVOICE") &&
    data.company.iban &&
    !doc.reverseCharge
      ? await buildQrPlatbaDataUrl({
          iban: data.company.iban,
          amount: totals.totalGross,
          currency: data.currency,
          variableSymbol: data.variableSymbol ?? undefined,
          message: data.number,
        })
      : null;

  return renderToBuffer(
    DocumentPdf({
      data,
      options: {
        accentColor: template.accentColor,
        showLogo: template.showLogo,
        showSignature: template.showSignature,
        showQrPlatba: template.showQrPlatba,
        showReverseChargeNote: template.showReverseChargeNote,
        customHeaderText: template.customHeaderText,
        customFooterText: template.customFooterText,
        letterheadAbsolutePath:
          template.letterheadImagePath && template.letterheadImagePath.startsWith("/uploads/")
            ? path.join(process.cwd(), "public", template.letterheadImagePath)
            : null,
      },
      qrDataUrl: qr,
    }),
  );
}

// Freeze a PDF snapshot to disk (PRD §9.5). Called on UNSENT → SENT transition.
// The snapshot preserves whatever was rendered at that moment for legal audit.
export async function createPdfSnapshot(doc: DocumentWithLines): Promise<void> {
  const buffer = await renderDocumentPdf(doc);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const dir = path.join(process.cwd(), "public", "uploads", "snapshots", doc.id);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${hash.slice(0, 16)}-${Date.now()}.pdf`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);

  const relPath = `/uploads/snapshots/${doc.id}/${filename}`;
  await prisma.pdfSnapshot.create({
    data: {
      documentId: doc.id,
      filePath: relPath,
      contentHash: hash,
      sizeBytes: buffer.length,
    },
  });
}

// Fetch the latest snapshot for a document (what should be shown/downloaded
// once SENT; pre-send we render on-demand).
export async function latestSnapshotPath(documentId: string): Promise<string | null> {
  const snap = await prisma.pdfSnapshot.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: { filePath: true },
  });
  return snap?.filePath ?? null;
}

// Centralised "transition to SENT" logic used by all document types.
// Assigns a gapless number + freezes a PDF snapshot, all in one transaction.
export async function transitionToSent(
  actorId: string,
  documentId: string,
): Promise<void> {
  const year = new Date().getFullYear();
  const { number, seq, workspaceId } = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id: documentId },
      include: { lineItems: true },
    });
    if (!doc) throw new Error("Document not found");
    if (doc.status !== "UNSENT") {
      // Idempotent: if already sent, just return the existing number.
      return {
        number: doc.number ?? "",
        seq: doc.numberSeq ?? 0,
        workspaceId: doc.workspaceId,
      };
    }
    const allocated = await allocateNumber(tx, doc.workspaceId, doc.type, year);
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: "SENT",
        number: allocated.number,
        yearSeries: allocated.year,
        numberSeq: allocated.seq,
        sentAt: new Date(),
      },
    });
    return { number: allocated.number, seq: allocated.seq, workspaceId: doc.workspaceId };
  });

  // Snapshot is rendered OUTSIDE the DB transaction (PDF renders are slow).
  // If it fails, the number is still issued (gaplessness preserved) and we
  // can regenerate the snapshot manually. Log for audit regardless.
  const fresh = await prisma.document.findUnique({
    where: { id: documentId },
    include: { lineItems: true },
  });
  if (fresh && fresh.status === "SENT") {
    try {
      await createPdfSnapshot(fresh);
    } catch (err) {
      console.error("Snapshot failed for", documentId, err);
    }
  }

  await writeAudit({
    workspaceId,
    actorId,
    entity: "Document",
    entityId: documentId,
    action: "update",
    after: { status: "SENT", number, seq } as unknown as Record<string, unknown>,
  });
}
