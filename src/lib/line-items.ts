// Pure calculation engine for line items + document totals.
// PRD §8.2 rules + §21.1/§21.5 VAT behavior + §22.6 precision.
//
// Conventions:
// - All monetary values are strings, 2 decimal places, rounded HALF_UP at
//   the boundary (Czech invoicing convention).
// - Quantities are strings with up to 3 decimal places.
// - Percentages are strings with up to 2 decimal places.
// - Rounding happens at the line level, then sums use already-rounded values.

import Decimal from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type TaxMode = "NET" | "GROSS"; // price is before / after tax

export type LineInput = {
  quantity: string | number;
  unitPrice: string | number;
  taxRatePercent: string | number;
  taxMode: TaxMode;
  lineDiscountPercent?: string | number | null;
  lineDiscountAmount?: string | number | null;
  /**
   * Advance-deduction lines (the negative "odečet zálohy" lines on a final
   * invoice that reverse an already-paid advance). They must be EXCLUDED from
   * the document-level discount base — the discount applies to the work only,
   * then the paid advance is deducted at its full invoiced value. See §12 +
   * the discount/deduction ordering fix. Defaults to false → ordinary work line.
   */
  isAdvanceDeduction?: boolean | null;
};

export type LineTotals = {
  /** unitPrice × quantity, in the mode's currency (net or gross) */
  base: string;
  /** The line-level discount amount, 2dp */
  lineDiscount: string;
  /** Line net (after line discount), 2dp */
  net: string;
  /** Line tax (0 if document is reverse-charged — that's decided at document level, not here), 2dp */
  tax: string;
  /** Line gross, 2dp (= net + tax) */
  gross: string;
};

export type DocInput = {
  lines: LineInput[];
  documentDiscountPercent?: string | number | null;
  documentDiscountAmount?: string | number | null;
  reverseCharge?: boolean;
};

export type TaxBand = {
  ratePercent: string;
  /** Net after proportional share of document-level discount, 2dp */
  net: string;
  /** Tax on that band (0 if reverse-charged), 2dp */
  tax: string;
};

export type DocTotals = {
  lines: LineTotals[];
  /** Sum of line nets, 2dp */
  subtotalNet: string;
  /** Document-level discount amount applied to the WORK subtotal, 2dp */
  documentDiscount: string;
  /** subtotalNet minus documentDiscount, 2dp */
  adjustedSubtotalNet: string;
  /** Per-tax-rate breakdown (net + tax after discount + reverse-charge) */
  taxBands: TaxBand[];
  /** Final totals (sum of taxBands) — the amount due after any advance deduction */
  totalNet: string;
  totalTax: string;
  totalGross: string;
  /** Sum of advance-deduction lines only (negative), 2dp. "0.00" if none. */
  advanceDeductionNet: string;
  advanceDeductionTax: string;
  advanceDeductionGross: string;
  reverseCharge: boolean;
};

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const ONE = new Decimal(1);

function dec(x: string | number | null | undefined): Decimal {
  if (x === null || x === undefined || x === "") return ZERO;
  // Never throw on user input. The live totals calc runs on every keystroke;
  // a stray symbol ("abc"), a half-typed value ("-", "1."), or the Czech
  // decimal comma ("1,5") must not crash the editor and wipe the form.
  const norm = typeof x === "string" ? x.replace(",", ".").trim() : x;
  try {
    const d = new Decimal(norm);
    return d.isFinite() ? d : ZERO;
  } catch {
    return ZERO;
  }
}

function money(d: Decimal): string {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function calculateLine(line: LineInput): LineTotals {
  const qty = dec(line.quantity);
  const price = dec(line.unitPrice);
  const ratePct = dec(line.taxRatePercent);
  const base = price.mul(qty); // in line.taxMode's currency

  // Line discount (percent takes precedence when both provided)
  let discount: Decimal;
  if (line.lineDiscountPercent !== null && line.lineDiscountPercent !== undefined && line.lineDiscountPercent !== "") {
    discount = base.mul(dec(line.lineDiscountPercent)).div(HUNDRED);
  } else if (line.lineDiscountAmount !== null && line.lineDiscountAmount !== undefined && line.lineDiscountAmount !== "") {
    discount = dec(line.lineDiscountAmount);
  } else {
    discount = ZERO;
  }

  const discounted = base.sub(discount);

  let net: Decimal;
  let tax: Decimal;
  if (line.taxMode === "GROSS") {
    // price includes tax → extract net
    const factor = ONE.plus(ratePct.div(HUNDRED));
    net = discounted.div(factor);
    tax = discounted.sub(net);
  } else {
    net = discounted;
    tax = net.mul(ratePct).div(HUNDRED);
  }

  const netR = net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const taxR = tax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const grossR = netR.plus(taxR);

  return {
    base: money(base),
    lineDiscount: money(discount),
    net: netR.toFixed(2),
    tax: taxR.toFixed(2),
    gross: grossR.toFixed(2),
  };
}

export function calculateDocument(doc: DocInput): DocTotals {
  const reverseCharge = doc.reverseCharge ?? false;
  const lineResults = doc.lines.map(calculateLine);

  // Split each band's net into the WORK portion (ordinary lines) and the
  // ADVANCE-DEDUCTION portion (negative "odečet zálohy" lines). The document
  // discount is computed on, and distributed across, the WORK portion only;
  // deduction lines pass through at their full invoiced value. This keeps the
  // VAT recap correct (the advance's VAT is reversed at the matching rate) while
  // ensuring a document discount never erodes the amount already paid.
  // Ordered Maps so output order matches the order rates first appeared.
  const workBands = new Map<string, Decimal>();
  const deductionBands = new Map<string, Decimal>();
  for (let i = 0; i < doc.lines.length; i++) {
    const key = dec(doc.lines[i].taxRatePercent).toFixed(2);
    const net = new Decimal(lineResults[i].net);
    const target = doc.lines[i].isAdvanceDeduction ? deductionBands : workBands;
    target.set(key, (target.get(key) ?? ZERO).plus(net));
    // Ensure the rate appears in workBands too so band iteration is stable.
    if (!workBands.has(key)) workBands.set(key, workBands.get(key) ?? ZERO);
  }

  // subtotalNet = sum of ALL listed line nets (work + deductions), matching the
  // printed line-item table. workSubtotalNet drives the discount.
  const subtotalNet = lineResults.reduce(
    (s, r) => s.plus(new Decimal(r.net)),
    ZERO,
  );
  const workSubtotalNet = Array.from(workBands.values()).reduce(
    (s, n) => s.plus(n),
    ZERO,
  );

  // Document-level discount (percent precedence over amount). Computed on the
  // WORK subtotal only — never on the advance-deduction lines.
  let docDiscount: Decimal;
  if (
    doc.documentDiscountPercent !== null &&
    doc.documentDiscountPercent !== undefined &&
    doc.documentDiscountPercent !== ""
  ) {
    docDiscount = workSubtotalNet
      .mul(dec(doc.documentDiscountPercent))
      .div(HUNDRED);
  } else if (
    doc.documentDiscountAmount !== null &&
    doc.documentDiscountAmount !== undefined &&
    doc.documentDiscountAmount !== ""
  ) {
    docDiscount = dec(doc.documentDiscountAmount);
  } else {
    docDiscount = ZERO;
  }
  docDiscount = docDiscount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const adjustedSubtotalNet = subtotalNet.sub(docDiscount);

  // Per band: work net minus its proportional share of the discount, plus the
  // band's deduction net. Then compute tax on the result.
  const taxBands: TaxBand[] = [];
  let totalNet = ZERO;
  let totalTax = ZERO;
  let advanceDeductionNet = ZERO;
  let advanceDeductionTax = ZERO;

  for (const [rate, workBandNet] of workBands.entries()) {
    const share = workSubtotalNet.isZero()
      ? ZERO
      : workBandNet.div(workSubtotalNet).mul(docDiscount);
    const deductionBandNet = deductionBands.get(rate) ?? ZERO;
    const bandAdjNet = workBandNet
      .sub(share)
      .plus(deductionBandNet)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const bandTax = reverseCharge
      ? ZERO
      : bandAdjNet.mul(dec(rate)).div(HUNDRED).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    taxBands.push({
      ratePercent: rate,
      net: bandAdjNet.toFixed(2),
      tax: bandTax.toFixed(2),
    });
    totalNet = totalNet.plus(bandAdjNet);
    totalTax = totalTax.plus(bandTax);

    // Track the advance-deduction contribution on its own (negative values).
    const dedNetR = deductionBandNet.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const dedTax = reverseCharge
      ? ZERO
      : dedNetR.mul(dec(rate)).div(HUNDRED).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    advanceDeductionNet = advanceDeductionNet.plus(dedNetR);
    advanceDeductionTax = advanceDeductionTax.plus(dedTax);
  }

  const totalGross = totalNet.plus(totalTax);
  const advanceDeductionGross = advanceDeductionNet.plus(advanceDeductionTax);

  return {
    lines: lineResults,
    subtotalNet: subtotalNet.toFixed(2),
    documentDiscount: docDiscount.toFixed(2),
    adjustedSubtotalNet: adjustedSubtotalNet.toFixed(2),
    taxBands,
    totalNet: totalNet.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalGross: totalGross.toFixed(2),
    advanceDeductionNet: advanceDeductionNet.toFixed(2),
    advanceDeductionTax: advanceDeductionTax.toFixed(2),
    advanceDeductionGross: advanceDeductionGross.toFixed(2),
    reverseCharge,
  };
}

/** Compute unit price from cost + markup%. Used by item-template form. */
export function unitPriceFromCostAndMarkup(cost: string | number, markupPercent: string | number): string {
  return dec(cost)
    .mul(ONE.plus(dec(markupPercent).div(HUNDRED)))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
