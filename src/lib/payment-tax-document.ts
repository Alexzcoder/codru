import { prisma } from "./prisma";
import { transitionToSent } from "./documents";
import { writeAudit } from "./audit";

// Daňový doklad k přijaté platbě (tax document for a received payment).
//
// A Czech VAT payer who receives an advance (zálohová faktura) before the
// taxable supply must issue a tax document for that received payment — the VAT
// point arises when the money is received, not when the work is done. This
// module auto-issues that document the moment an advance becomes fully paid.
//
// The document mirrors the advance's line items (and any document discount) so
// its VAT recap and total exactly equal the received amount. It gets its own
// gapless "DD" series (scoped to the legal entity, like every other doc type),
// is numbered + PDF-archived via transitionToSent, and links back to the
// advance through `sourceQuoteId`.

/**
 * Issue the payment tax document for a fully-paid advance invoice. Idempotent:
 * if one already exists for this advance it is returned unchanged. Returns null
 * if the advance isn't eligible (wrong type, never sent, etc.).
 */
export async function issuePaymentTaxDocumentForAdvance(
  actorId: string,
  advanceId: string,
): Promise<{ id: string } | null> {
  const advance = await prisma.document.findUnique({
    where: { id: advanceId },
    include: {
      lineItems: { orderBy: { position: "asc" } },
      paymentAllocations: { include: { payment: true } },
    },
  });
  if (!advance) return null;
  if (advance.type !== "ADVANCE_INVOICE") return null;
  if (advance.deletedAt) return null;
  // Must have been issued (numbered) — we don't document payments on drafts.
  if (advance.status === "UNSENT") return null;

  // Idempotency: one payment tax document per advance.
  const existing = await prisma.document.findFirst({
    where: {
      type: "PAYMENT_TAX_DOCUMENT",
      sourceQuoteId: advanceId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return existing;

  // Tax point = the date the money was received (latest allocation's payment
  // date); fall back to now if for some reason there are no allocations.
  const paymentDates = advance.paymentAllocations
    .map((a) => a.payment.date)
    .sort((a, b) => b.getTime() - a.getTime());
  const taxPoint = paymentDates[0] ?? new Date();
  const issueDate = new Date();

  const note =
    advance.locale === "en"
      ? `Tax document for the payment received against advance invoice ${advance.number}.`
      : `Daňový doklad k přijaté platbě k zálohové faktuře ${advance.number}.`;
  const title =
    advance.locale === "en"
      ? `Received payment — advance ${advance.number}`
      : `Přijatá platba — záloha ${advance.number}`;

  const created = await prisma.document.create({
    data: {
      workspaceId: advance.workspaceId,
      type: "PAYMENT_TAX_DOCUMENT",
      status: "UNSENT",
      clientId: advance.clientId,
      jobId: advance.jobId,
      companyProfileId: advance.companyProfileId,
      documentTemplateId: advance.documentTemplateId,
      createdById: actorId,
      currency: advance.currency,
      exchangeRateToCzk: advance.exchangeRateToCzk,
      locale: advance.locale,
      issueDate,
      taxPointDate: taxPoint,
      reverseCharge: advance.reverseCharge,
      documentDiscountPercent: advance.documentDiscountPercent,
      documentDiscountAmount: advance.documentDiscountAmount,
      sourceQuoteId: advance.id,
      title,
      notesToClient: note,
      lineItems: {
        create: advance.lineItems.map((l) => ({
          position: l.position,
          name: l.name,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          taxRatePercent: l.taxRatePercent,
          taxMode: l.taxMode,
          lineDiscountPercent: l.lineDiscountPercent,
          lineDiscountAmount: l.lineDiscountAmount,
          isAdvanceDeduction: false,
        })),
      },
    },
    select: { id: true },
  });

  // Number it + archive the PDF snapshot (own gapless DD series).
  await transitionToSent(actorId, created.id);

  await writeAudit({
    workspaceId: advance.workspaceId,
    actorId,
    entity: "Document",
    entityId: created.id,
    action: "create",
    after: {
      type: "PAYMENT_TAX_DOCUMENT",
      sourceAdvanceId: advance.id,
    } as unknown as Record<string, unknown>,
  });

  return created;
}
