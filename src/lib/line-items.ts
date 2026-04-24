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
  /** Document-level discount amount applied to subtotal, 2dp */
  documentDiscount: string;
  /** subtotalNet minus documentDiscount, 2dp */
  adjustedSubtotalNet: string;
  /** Per-tax-rate breakdown (net + tax after discount + reverse-charge) */
  taxBands: TaxBand[];
  /** Final totals (sum of taxBands) */
  totalNet: string;
  totalTax: string;
  totalGross: string;
  reverseCharge: boolean;
};

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const ONE = new Decimal(1);

function dec(x: string | number | null | undefined): Decimal {
  if (x === null || x === undefined || x === "") return ZERO;
  return new Decimal(x);
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

  // Group line nets (and their rate) into bands.
  // Use an ordered Map so the output order matches the order rates first appeared.
  const bands = new Map<string, Decimal>();
  for (let i = 0; i < doc.lines.length; i++) {
    const key = dec(doc.lines[i].taxRatePercent).toFixed(2);
    const net = new Decimal(lineResults[i].net);
    bands.set(key, (bands.get(key) ?? ZERO).plus(net));
  }

  const subtotalNet = lineResults.reduce(
    (s, r) => s.plus(new Decimal(r.net)),
    ZERO,
  );

  // Document-level discount (percent precedence over amount).
  let docDiscount: Decimal;
  if (
    doc.documentDiscountPercent !== null &&
    doc.documentDiscountPercent !== undefined &&
    doc.documentDiscountPercent !== ""
  ) {
    docDiscount = subtotalNet.mul(dec(doc.documentDiscountPercent)).div(HUNDRED);
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

  // Distribute doc discount proportionally across bands, then compute per-band tax.
  const taxBands: TaxBand[] = [];
  let totalNet = ZERO;
  let totalTax = ZERO;

  if (subtotalNet.isZero()) {
    for (const rate of bands.keys()) {
      taxBands.push({ ratePercent: rate, net: "0.00", tax: "0.00" });
    }
  } else {
    for (const [rate, bandNet] of bands.entries()) {
      const share = bandNet.div(subtotalNet).mul(docDiscount);
      const bandAdjNet = bandNet
        .sub(share)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const bandTax = reverseCharge
        ? ZERO
        : bandAdjNet
            .mul(dec(rate))
            .div(HUNDRED)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      taxBands.push({
        ratePercent: rate,
        net: bandAdjNet.toFixed(2),
        tax: bandTax.toFixed(2),
      });
      totalNet = totalNet.plus(bandAdjNet);
      totalTax = totalTax.plus(bandTax);
    }
  }

  const totalGross = totalNet.plus(totalTax);

  return {
    lines: lineResults,
    subtotalNet: subtotalNet.toFixed(2),
    documentDiscount: docDiscount.toFixed(2),
    adjustedSubtotalNet: adjustedSubtotalNet.toFixed(2),
    taxBands,
    totalNet: totalNet.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalGross: totalGross.toFixed(2),
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
