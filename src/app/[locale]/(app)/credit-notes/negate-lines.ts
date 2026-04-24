import type { DocumentLineItem } from "@prisma/client";
import type { EditorLine } from "../quotes/line-items-editor";

// Turn an original invoice's line items into negative-amount pre-population
// for a credit note editor. User can still edit them freely before saving.
export function negateLines(lines: DocumentLineItem[]): EditorLine[] {
  return lines
    .sort((a, b) => a.position - b.position)
    .map((l) => {
      const qty = Number.parseFloat(l.quantity.toString());
      // Invert quantity (keeps unitPrice positive, but result is negative).
      const negQty = (-qty).toFixed(3);
      return {
        name: l.name,
        description: l.description ?? "",
        quantity: negQty,
        unit: l.unit,
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? "",
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? "",
      };
    });
}
