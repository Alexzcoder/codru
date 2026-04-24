import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";

export type CreditNoteLink = {
  id: string;
  number: string | null;
  status: string;
  totalGross: string;
  currency: string;
};

// Sum linked SENT credit notes' gross amounts to show the "effective balance"
// on an invoice detail page. PRD §13.3: once issued, the original invoice's
// effective balance is reduced by the credit note amount. Drafts don't count.
export async function loadCreditNotesForOriginal(
  originalId: string,
): Promise<{ notes: CreditNoteLink[]; effectiveReduction: string }> {
  const notes = await prisma.document.findMany({
    where: {
      type: "CREDIT_NOTE",
      originalDocumentId: originalId,
      deletedAt: null,
    },
    include: { lineItems: true },
    orderBy: { createdAt: "asc" },
  });

  let effectiveReduction = 0;
  const rows: CreditNoteLink[] = [];
  for (const n of notes) {
    const totals = calculateDocument({
      lines: n.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      reverseCharge: n.reverseCharge,
    });
    rows.push({
      id: n.id,
      number: n.number,
      status: n.status,
      totalGross: totals.totalGross,
      currency: n.currency,
    });
    // Only SENT credit notes reduce the effective balance.
    if (n.status === "SENT" || n.status === "PAID") {
      effectiveReduction += Number.parseFloat(totals.totalGross);
    }
  }

  return { notes: rows, effectiveReduction: effectiveReduction.toFixed(2) };
}
