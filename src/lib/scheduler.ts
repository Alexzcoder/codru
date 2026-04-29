// Speaker scheduling optimizer for the IE Public Speaking demo. Stateless:
// takes a CSV of speaker availability + a set of target IE bachelor degrees
// and returns the top 3 slots ranked by length and overlap with each degree's
// "best" weekday/hour window.
//
// The degree windows are an opinionated heuristic — adjust DEGREE_WINDOWS as
// you learn more about each cohort's actual free time.

export const DEGREES = [
  { code: "BBA",  label: "Bachelor in Business Administration" },
  { code: "BIE",  label: "Bachelor in International Economics" },
  { code: "BIR",  label: "Bachelor in International Relations" },
  { code: "BLB",  label: "Bachelor in Laws (Bilingual)" },
  { code: "BCDA", label: "Bachelor in Computer Science & Data Analytics" },
  { code: "BCM",  label: "Bachelor in Communication & Digital Media" },
  { code: "BIA",  label: "Bachelor in International Affairs" },
  { code: "BDes", label: "Bachelor in Design" },
] as const;

export type DegreeCode = (typeof DEGREES)[number]["code"];

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0
const MON: Weekday = 1, TUE: Weekday = 2, WED: Weekday = 3, THU: Weekday = 4, FRI: Weekday = 5;

const DEGREE_WINDOWS: Record<DegreeCode, { days: Weekday[]; from: number; to: number }> = {
  BBA:  { days: [TUE, THU], from: 18, to: 20 },
  BIE:  { days: [MON, WED], from: 17, to: 19 },
  BIR:  { days: [TUE, THU], from: 19, to: 21 },
  BLB:  { days: [MON, WED], from: 18, to: 20 },
  BCDA: { days: [WED, FRI], from: 16, to: 18 },
  BCM:  { days: [TUE, THU], from: 19, to: 21 },
  BIA:  { days: [MON, TUE], from: 18, to: 20 },
  BDes: { days: [WED, FRI], from: 17, to: 19 },
};

export type ParsedSlot = {
  date: string;          // YYYY-MM-DD
  fromHour: number;      // 0–23.99
  toHour: number;
  weekday: Weekday;
  durationMinutes: number;
};

export type DegreeBreakdown = {
  code: DegreeCode;
  overlapMinutes: number;
};

export type RankedSlot = {
  date: string;
  fromHour: number;
  toHour: number;
  durationMinutes: number;
  totalScore: number;
  totalOverlapMinutes: number;
  perDegree: DegreeBreakdown[];
};

const HHMM = /^(\d{1,2}):(\d{2})$/;
function parseHHMM(s: string): number | null {
  const m = HHMM.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h + mm / 60;
}

const ISODATE = /^\d{4}-\d{2}-\d{2}$/;
const CZDATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
function parseDate(s: string): Date | null {
  const t = s.trim();
  if (ISODATE.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const cz = CZDATE.exec(t);
  if (cz) {
    const d = new Date(Number(cz[3]), Number(cz[2]) - 1, Number(cz[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Parse a CSV-ish text into slots. Accepted shapes per row:
 *   2026-05-12,18:00,20:00
 *   12.5.2026, 18:00, 20:00
 *   2026-05-12;18:00;20:00
 * Any other rows are silently skipped — the caller surfaces the count.
 */
export function parseSpeakerCsv(text: string): { slots: ParsedSlot[]; rejected: number } {
  const rows: ParsedSlot[] = [];
  let rejected = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length < 3) {
      rejected++;
      continue;
    }
    const date = parseDate(parts[0]);
    const fromHour = parseHHMM(parts[1]);
    const toHour = parseHHMM(parts[2]);
    if (!date || fromHour == null || toHour == null || toHour <= fromHour) {
      rejected++;
      continue;
    }
    const dateIso = date.toISOString().slice(0, 10);
    const weekday = date.getDay() as Weekday;
    const durationMinutes = Math.round((toHour - fromHour) * 60);
    rows.push({ date: dateIso, fromHour, toHour, weekday, durationMinutes });
  }
  return { slots: rows, rejected };
}

function overlapMinutes(slot: ParsedSlot, win: { days: Weekday[]; from: number; to: number }): number {
  if (!win.days.includes(slot.weekday)) return 0;
  const lo = Math.max(slot.fromHour, win.from);
  const hi = Math.min(slot.toHour, win.to);
  return hi > lo ? Math.round((hi - lo) * 60) : 0;
}

const OVERLAP_WEIGHT = 60; // 1 minute of degree-overlap = 60 score points
const LENGTH_WEIGHT = 1;   // 1 minute of slot length = 1 score point

function rank(slot: ParsedSlot, degrees: DegreeCode[]): RankedSlot {
  const perDegree: DegreeBreakdown[] = degrees.map((code) => ({
    code,
    overlapMinutes: overlapMinutes(slot, DEGREE_WINDOWS[code]),
  }));
  const totalOverlapMinutes = perDegree.reduce((s, x) => s + x.overlapMinutes, 0);
  const totalScore =
    LENGTH_WEIGHT * slot.durationMinutes + OVERLAP_WEIGHT * totalOverlapMinutes;
  return {
    date: slot.date,
    fromHour: slot.fromHour,
    toHour: slot.toHour,
    durationMinutes: slot.durationMinutes,
    totalScore,
    totalOverlapMinutes,
    perDegree,
  };
}

export function pickTopSlots(
  csv: string,
  degrees: DegreeCode[],
  topN = 3,
): { ranked: RankedSlot[]; parsedCount: number; rejectedCount: number } {
  const { slots, rejected } = parseSpeakerCsv(csv);
  const ranked = slots.map((s) => rank(s, degrees));
  ranked.sort((a, b) => b.totalScore - a.totalScore);
  return {
    ranked: ranked.slice(0, topN),
    parsedCount: slots.length,
    rejectedCount: rejected,
  };
}

/**
 * Single-day variant: caller picks a target date and a list of time ranges
 * the speaker is available within that date. UI exposes only date + time,
 * dropping score / per-degree breakdown.
 */
export type DayRange = { fromHour: number; toHour: number };

export function pickTopSlotsForDay(
  date: string, // YYYY-MM-DD
  ranges: DayRange[],
  degrees: DegreeCode[],
  topN = 3,
): { ranked: RankedSlot[]; parsedCount: number; rejectedCount: number } {
  const d = parseDate(date);
  if (!d) return { ranked: [], parsedCount: 0, rejectedCount: ranges.length };
  const weekday = d.getDay() as Weekday;
  const slots: ParsedSlot[] = [];
  let rejected = 0;
  for (const r of ranges) {
    if (
      typeof r.fromHour !== "number" ||
      typeof r.toHour !== "number" ||
      r.toHour <= r.fromHour ||
      r.fromHour < 0 ||
      r.toHour > 24
    ) {
      rejected++;
      continue;
    }
    slots.push({
      date,
      fromHour: r.fromHour,
      toHour: r.toHour,
      weekday,
      durationMinutes: Math.round((r.toHour - r.fromHour) * 60),
    });
  }
  const ranked = slots.map((s) => rank(s, degrees));
  ranked.sort((a, b) => b.totalScore - a.totalScore);
  return {
    ranked: ranked.slice(0, topN),
    parsedCount: slots.length,
    rejectedCount: rejected,
  };
}

export function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
