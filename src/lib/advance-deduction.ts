import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";

export type DeductionLineInput = {
  name: string;
  description: string | null;
  quantity: string;
  unit: string;
  unitPrice: string; // negative
  taxRatePercent: string;
  taxMode: "NET";
  lineDiscountPercent: string | null;
  lineDiscountAmount: string | null;
};

// For each deducted advance, split the deduction into one negative line per
// tax band the advance used. This preserves VAT accounting: the VAT already
// paid on the advance is reversed at the matching rate on the final invoice.
// PRD §12.2 — each becomes a negative line.
export async function buildDeductionLines(
  advanceIds: string[],
  labelFn: (number: string, rate: string) => string,
): Promise<DeductionLineInput[]> {
  if (advanceIds.length === 0) return [];

  const advances = await prisma.document.findMany({
    where: { id: { in: advanceIds }, type: "ADVANCE_INVOICE" },
    include: { lineItems: true },
  });

  const lines: DeductionLineInput[] = [];
  for (const adv of advances) {
    const totals = calculateDocument({
      lines: adv.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: adv.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: adv.documentDiscountAmount?.toString() ?? null,
      reverseCharge: adv.reverseCharge,
    });

    const advNumber = adv.number ?? `ADV-draft/${adv.id.slice(-6)}`;
    for (const band of totals.taxBands) {
      // Skip zero bands
      if (band.net === "0.00") continue;
      lines.push({
        name: labelFn(advNumber, band.ratePercent),
        description: null,
        quantity: "1",
        unit: "ks",
        unitPrice: `-${band.net}`,
        taxRatePercent: band.ratePercent,
        taxMode: "NET",
        lineDiscountPercent: null,
        lineDiscountAmount: null,
      });
    }
  }
  return lines;
}
