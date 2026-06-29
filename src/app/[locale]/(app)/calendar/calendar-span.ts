import { pragueParts } from "@/lib/format-datetime";

// Multi-day placement helpers. A calendar item occupies every Prague-day from
// its start to its end; these decide which day-cells it belongs in. Day keys
// are YYYY-MM-DD (sv-SE / zero-padded) so plain string compare == date compare.

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function pragueDayKey(d: Date): string {
  return DAY_KEY_FORMATTER.format(d);
}

export function minuteOfDayPrague(d: Date): number {
  const p = pragueParts(d);
  return p.hour * 60 + p.minute;
}

function isPragueMidnight(d: Date): boolean {
  const p = pragueParts(d);
  return p.hour === 0 && p.minute === 0 && p.second === 0;
}

// Last Prague-day the item visually occupies. An end exactly at midnight belongs
// to the previous day — a 1–3 May event ending 3 May 24:00 covers 1, 2, 3, not 4.
export function itemEndDayKey(start: Date, end: Date | null | undefined): string {
  const startKey = pragueDayKey(start);
  if (!end || end.getTime() <= start.getTime()) return startKey;
  const adj = isPragueMidnight(end) ? new Date(end.getTime() - 1) : end;
  const endKey = pragueDayKey(adj);
  return endKey < startKey ? startKey : endKey;
}

// Does the item cover the given Prague day-key (inclusive of start and end day)?
export function coversDay(
  start: Date,
  end: Date | null | undefined,
  dayKey: string,
): boolean {
  return dayKey >= pragueDayKey(start) && dayKey <= itemEndDayKey(start, end);
}
