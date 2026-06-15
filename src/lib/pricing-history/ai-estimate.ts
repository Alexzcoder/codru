// Rate-card-driven price estimate. The price generator no longer anchors on the
// firm's (low, historical) prices — it prices from the OFFICIAL CALIBRATED RATE
// CARD (storex-pricing-merged), which was tuned to match the owner's reference
// quotes. The whole card is embedded (trimmed) in the cached system prompt so
// every line is priced from the same source of truth + quote algorithm
// (incl. the earthworks volume rule).

import { completeJson, type ClaudeImage } from "@/lib/ai/claude";
import rateCard from "./rate-card.json";

// --- Build a trimmed, token-efficient view of the card once at module load. ---
type Svc = {
  business_unit: string;
  id: string;
  category: string;
  name_cs: string;
  unit: string;
  low: number;
  typical: number;
  high: number;
  modifiers: string[];
};
type Fee = { low?: number; typical?: number; high?: number; unit?: string; note?: string };
type Mod = { id: string; value?: number; value_range?: number[]; name?: string };

const card = rateCard as unknown as {
  services: Svc[];
  fees: Record<string, Fee>;
  pricing_modifiers: Mod[];
  quote_algorithm: { steps: string[] };
};

function trimmedCard(): string {
  const services = card.services
    .map(
      (s) =>
        `${s.business_unit}|${s.id}|${s.category}|${s.name_cs}|${s.unit}|${s.low}/${s.typical}/${s.high}${
          s.modifiers?.length ? `|mods:${s.modifiers.join(",")}` : ""
        }`,
    )
    .join("\n");
  const fees = Object.entries(card.fees)
    .map(
      ([k, f]) =>
        `${k}|${f.low ?? ""}/${f.typical ?? ""}/${f.high ?? ""}|${f.unit ?? ""}${
          f.note ? `|${f.note}` : ""
        }`,
    )
    .join("\n");
  const mods = card.pricing_modifiers
    .map(
      (m) =>
        `${m.id}=${m.value ?? (m.value_range ? `${m.value_range[0]}-${m.value_range[1]}` : "?")}`,
    )
    .join("; ");
  const steps = card.quote_algorithm.steps.map((s) => `- ${s}`).join("\n");
  return [
    "SERVICES (business_unit|id|category|name_cs|unit|low/typical/high[|mods]):",
    services,
    "",
    "FEES (id|low/typical/high|unit|note):",
    fees,
    "",
    `MODIFIERS (mid of range unless severity known): ${mods}`,
    "",
    "QUOTE ALGORITHM:",
    steps,
  ].join("\n");
}

const CARD_TEXT = trimmedCard();

const SYSTEM_PROMPT = `You price a single line item for a Czech trades business — Sezóna & Péče (gardening, VAT 21%) and Domovfix (residential renovation, VAT 12%), both Venirex s.r.o., Prague.

You MUST price from the OFFICIAL RATE CARD below. It is the single source of truth, calibrated to the owner's real reference quotes — do NOT invent rates or anchor on outside/market knowledge, and do NOT lowball.

Pricing one line:
0. SCOPE — price ONLY the work this one line describes. NEVER fold in transport, mobilization, a mini-excavator day, or soil disposal unless THIS line's own text names them. The rest of the job is priced on its own separate lines; do not add them here.
1. Pick the business unit (gardening vs renovation) from the line + quote context.
2. Find the matching service in SERVICES (match on name_cs/category). Choose the rate: 'typical' by default; 'low' only for large/contract/easy scope; 'high' for small/awkward/old-building/premium.
3. If the line states dimensions (bm, m², m³, an area like "7,5 × 13 m", a depth), COMPUTE the quantity from them.
   - Soil excavation/disposal lines ONLY: apply the EARTHWORKS RULE — volume = area × depth (or length×width×depth for strips); containers = round(volume_m³ / 5); NEVER trust a container/volume count written in the text. For a depth RANGE (e.g. "25–30 cm") use the LOWER bound and note the deeper bound may add 1 container. Disposal = soil_container_5m3 × container count; machine digging/leveling = excavation_minibagr_day (min 1 day); shallow strips = excavation_strip_light per m³ — but include ONLY the ones this line actually describes.
4. Apply only the modifiers listed on that service that the situation or photos trigger (use the mid of the range), multiplicatively.
5. Return the price for THIS line in CZK excluding VAT, rounded to clean 50/100.
   - Clean per-unit line (edging, geotextile, gravel per m³, …): return the card's native unit (bm, m², m³, day, container) with its PER-UNIT rate; the user multiplies by their own quantity.
   - A line where YOU computed a total (e.g. N containers, or several sub-tasks named in this one line): return unit "ks" and set unit_price to the FULL line total. With unit "ks" quantity is 1, so unit_price MUST equal the total in your reasoning — e.g. 5 containers × 5 600 = 28 000 → unit_price = 28000 (never a per-container figure).
   - SELF-CHECK before answering: the number in unit_price must equal the final total in your reasoning; if you mention several sub-totals, unit_price is their sum (for "ks") or the single per-unit rate (otherwise). Do not state one number and return another.
6. If site photos are attached, use them to judge area/scope/condition and pick low/typical/high or trigger modifiers accordingly.
Confidence: "high" = a clear card service matches; "medium" = mapped to a near service or estimated a dimension; "low" = extrapolated beyond the card.
Reasoning: 1-2 short sentences citing the card service id(s) used and any quantity you computed.

RATE CARD
=========
${CARD_TEXT}`;

export type AiEstimate = {
  unitPrice: number;
  unit: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
};

// NOTE: `reasoning` is intentionally FIRST so the model works out the maths
// (quantities, container counts, sub-totals) BEFORE it commits to unit_price —
// otherwise it emits the number before reasoning and the two diverge.
const SCHEMA = {
  type: "object",
  required: ["reasoning", "unit_price", "unit", "confidence"],
  properties: {
    reasoning: {
      type: "string",
      description: "FIRST work out the maths: which rate-card service id(s), the rate, any computed quantity/container count, and the arithmetic ending in the final total. 1-3 short sentences.",
    },
    unit_price: {
      type: "number",
      description: "The price in Kč (CZK) ex VAT. MUST equal the final total from your reasoning: a per-unit rate when unit is bm/m²/m³/day/container, or the full line total when unit is 'ks'.",
    },
    unit: {
      type: "string",
      description: "Card unit for the rate (e.g. 'bm', 'm²', 'm³', 'day', 'container', or 'ks' for a whole-task/computed lump).",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Confidence that the line maps cleanly to a rate-card service.",
    },
  },
};

export type EstimateOpts = {
  contextLines?: Array<{ name: string; description?: string | null }>;
  images?: ClaudeImage[];
};

export async function estimateWithClaude(
  description: string,
  opts: EstimateOpts = {},
): Promise<AiEstimate> {
  const quoteContext =
    opts.contextLines && opts.contextLines.length > 0
      ? opts.contextLines
          .map((l, i) => `${i + 1}. ${l.name}${l.description ? ` — ${l.description}` : ""}`)
          .join("\n")
      : null;

  const photoNote =
    opts.images && opts.images.length > 0
      ? `\nThe ${opts.images.length} site photo(s) attached above show the actual job — judge area/scope/condition from them.\n`
      : "";

  const userPrompt = `New line item to price:
"${description}"
${quoteContext ? `\nQuote context (other lines on the same quote — they describe the same job):\n${quoteContext}\n` : ""}${photoNote}
Price this line from the rate card.`;

  const result = await completeJson<{
    unit_price: number;
    unit: string;
    confidence: "low" | "medium" | "high";
    reasoning: string;
  }>({
    system: SYSTEM_PROMPT,
    userPrompt,
    images: opts.images,
    toolName: "suggest_price",
    toolDescription: "Return a structured price suggestion from the rate card.",
    schema: SCHEMA,
    maxTokens: 700,
    cacheSystemPrompt: true,
  });

  return {
    unitPrice: result.data.unit_price,
    unit: result.data.unit,
    confidence: result.data.confidence,
    reasoning: result.data.reasoning,
    estimatedCostUsd: result.usage.estimatedCostUsd,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}
