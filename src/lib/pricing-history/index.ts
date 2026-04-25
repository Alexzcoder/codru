// Suggest a unit price for a new line item by retrieving similar past line
// items from the user's own quote history. Pure-Node, zero deps. The
// historical dataset is shipped as data.json (extracted by
// scripts/extract_pricing_history.py).
//
// Algorithm: BM25-style scoring over diacritic-folded Czech tokens. We don't
// pretend this is a model — it's transparent retrieval over the user's own
// pricing history, which is what they need for v1.

import rawData from "./data.json";

export type HistoricalLine = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_percent: number;
  net: number;
  vat: number;
  gross: number;
  source: string;
  doc_number: string;
  issue_date: string | null;
};

const DATA: HistoricalLine[] = rawData as HistoricalLine[];

// ── Tokenisation ─────────────────────────────────────────────────────────────

// Czech function words and units we don't want as match signal. Keep the list
// small — the goal is to remove genuine noise, not to over-stem.
const STOPWORDS = new Set([
  "a", "i", "o", "u", "v", "ve", "z", "ze", "s", "se", "do", "na", "po", "k",
  "ke", "od", "pro", "za", "při", "bez", "to", "ten", "ta", "te", "tě", "ji",
  "je", "ho", "mu", "si", "už", "že", "by", "byl", "byla", "byly", "ale",
  "tak", "také", "nebo", "ani", "ano", "ne", "vč", "cca", "ks", "kus", "kusy",
  "m2", "m²", "m3", "m³", "bm", "mb", "ml", "cm", "kg", "ks.", "vč.",
]);

// Strip Czech diacritics so "Demontáž" matches "demontaz".
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tokenize(s: string): string[] {
  const folded = fold(s);
  return folded
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// ── Index built once at module load ──────────────────────────────────────────

const docs: { tokens: string[]; line: HistoricalLine }[] = DATA.map((line) => ({
  line,
  tokens: tokenize(`${line.description} ${line.unit}`),
}));

const N = docs.length;
const df: Map<string, number> = new Map();
for (const d of docs) {
  const seen = new Set(d.tokens);
  for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
}
const idf: Map<string, number> = new Map();
for (const [t, freq] of df) {
  // BM25 IDF (smoothed)
  idf.set(t, Math.log(1 + (N - freq + 0.5) / (freq + 0.5)));
}
const avgDocLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, N);

// ── Scoring ──────────────────────────────────────────────────────────────────

const K1 = 1.5;
const B = 0.6;

function scoreDoc(queryTokens: string[], docTokens: string[]): number {
  if (docTokens.length === 0) return 0;
  // Term frequency in this doc.
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  const dl = docTokens.length;
  for (const q of queryTokens) {
    const f = tf.get(q);
    if (!f) continue;
    const w = idf.get(q) ?? 0;
    const norm = f * (K1 + 1) / (f + K1 * (1 - B + B * (dl / avgDocLen)));
    score += w * norm;
  }
  return score;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type Suggestion = {
  matches: Array<{
    description: string;
    unit: string;
    unitPrice: number;
    quantity: number;
    vatPercent: number;
    source: string;
    issueDate: string | null;
    score: number;
  }>;
  stats: {
    count: number;
    medianUnitPrice: number | null;
    p25UnitPrice: number | null;
    p75UnitPrice: number | null;
    detectedUnit: string | null;
  } | null;
};

export function suggestPrice(
  description: string,
  opts: { topK?: number; minScore?: number } = {},
): Suggestion {
  const topK = opts.topK ?? 8;
  const minScore = opts.minScore ?? 0.5;
  const qTokens = tokenize(description);
  if (qTokens.length === 0) return { matches: [], stats: null };

  const scored: Array<{ score: number; idx: number }> = [];
  for (let i = 0; i < docs.length; i++) {
    const s = scoreDoc(qTokens, docs[i].tokens);
    if (s >= minScore) scored.push({ score: s, idx: i });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  const matches = top.map(({ score, idx }) => {
    const line = docs[idx].line;
    return {
      description: line.description,
      unit: line.unit,
      unitPrice: line.unit_price,
      quantity: line.quantity,
      vatPercent: line.vat_percent,
      source: line.source,
      issueDate: line.issue_date,
      score,
    };
  });

  if (matches.length === 0) return { matches: [], stats: null };

  // Stats use the top matches' unit prices, weighted equally. Filter out
  // zero-priced lines (those are "supply only" placeholders).
  const prices = matches.map((m) => m.unitPrice).filter((p) => p > 0).sort((a, b) => a - b);
  const stats =
    prices.length === 0
      ? null
      : {
          count: prices.length,
          medianUnitPrice: percentile(prices, 0.5),
          p25UnitPrice: percentile(prices, 0.25),
          p75UnitPrice: percentile(prices, 0.75),
          detectedUnit: pickMode(matches.map((m) => m.unit).filter(Boolean)),
        };

  return { matches, stats };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function pickMode(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export const HISTORICAL_DATA_SIZE = N;
