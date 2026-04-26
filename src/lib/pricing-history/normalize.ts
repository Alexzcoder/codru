// Old pricing extractions have area baked into the description with quantity 1
// and unit "" — e.g. `Sekání trávníku (900 m²)` qty=1 unit_price=4500. That
// makes the per-unit price misleading: the real rate is 5 Kč/m², not 4500 Kč/ks.
// Normalise these at load time so retrieval and stats see usable per-area
// prices and a stripped description.
//
// Triggers only when:
//   - quantity is exactly 1
//   - unit is empty (or "ks"/"kus")
//   - description contains a parenthetical area marker
// We never override extractions that already had a real quantity + unit.

import type { HistoricalLine } from "./index";

const NUM = "(\\d+(?:[.,]\\d+)?)";
// Matches:  (900 m²)  (cca 10 m²)  (~20 m²)  (10–15 m²)  (5,6 m²)
//   also catches: cca 10 m², approx. 10 m² without parentheses if surrounded by spaces
const AREA_PARENS = new RegExp(
  `\\(\\s*(?:cca\\s*|approx\\.?\\s*|~|asi\\s*)?${NUM}(?:\\s*[–\\-]\\s*${NUM})?\\s*m\\s*[²2]\\s*\\)`,
  "i",
);
// Matches "60 m² × 150 Kč/m²" style — qty + per-m² price baked in.
const AREA_TIMES_PRICE = new RegExp(
  `${NUM}\\s*m\\s*[²2]\\s*[×x*]\\s*${NUM}\\s*K[čc]\\s*/?\\s*m\\s*[²2]`,
  "i",
);

function parseNum(s: string): number {
  return Number.parseFloat(s.replace(",", "."));
}

function isUnscoped(line: HistoricalLine): boolean {
  if (line.quantity !== 1) return false;
  const u = (line.unit ?? "").trim().toLowerCase();
  return u === "" || u === "ks" || u === "kus";
}

export function normaliseLine(line: HistoricalLine): HistoricalLine {
  // Pattern A: "60 m² × 150 Kč/m²" — most informative. The quote total is
  // (60 * 150) but the line had qty=1 unit_price=9000 — fix to qty=60, up=150.
  const ap = line.description.match(AREA_TIMES_PRICE);
  if (ap && isUnscoped(line)) {
    const qty = parseNum(ap[1]);
    const perUnit = parseNum(ap[2]);
    if (qty > 0 && perUnit > 0) {
      return {
        ...line,
        quantity: qty,
        unit: "m²",
        unit_price: perUnit,
        description: line.description
          .replace(AREA_TIMES_PRICE, "")
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  }

  // Pattern B: "Sekání trávníku (900 m²)" — area in parentheses, single price.
  // Treat the line's gross/net relative to that area as per-m² rate.
  const ar = line.description.match(AREA_PARENS);
  if (ar && isUnscoped(line)) {
    const lo = parseNum(ar[1]);
    const hi = ar[2] ? parseNum(ar[2]) : null;
    const qty = hi != null ? (lo + hi) / 2 : lo;
    if (qty > 0 && line.unit_price > 0) {
      const perUnit = round2(line.unit_price / qty);
      return {
        ...line,
        quantity: qty,
        unit: "m²",
        unit_price: perUnit,
        description: line.description
          .replace(AREA_PARENS, "")
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  }

  return line;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normaliseAll(lines: HistoricalLine[]): HistoricalLine[] {
  return lines.map(normaliseLine);
}
