// Render a Date as "YYYY-MM-DD HH:MM" in Europe/Prague. Prevents the UTC
// drift that surfaced when CEST users saw "14:49" for a send that actually
// happened at 16:49 local. Use this anywhere a wall-clock time is shown.
//
// `sv-SE` formats as ISO ("YYYY-MM-DD HH:MM"), which sidesteps Czech-locale
// quirks (commas, dots) that the user has not asked for in these compact
// log/audit rows.
const FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const FORMATTER_WITH_SECONDS = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTimePrague(d: Date): string {
  return FORMATTER.format(d);
}

export function formatDateTimePragueWithSeconds(d: Date): string {
  return FORMATTER_WITH_SECONDS.format(d);
}

// "HH:MM" wall-clock in Europe/Prague. Server runs UTC on Vercel, so we
// can't use `d.getHours()` — that returns UTC hours and shifts the display
// 1-2h depending on DST.
const TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatTimePrague(d: Date): string {
  return TIME_FORMATTER.format(d);
}

// Returns the Prague-local clock-hour/minute/second for a Date. Used where
// the *server* needs to reason about wall-clock fields (e.g. "is this
// scheduled at midnight Prague?").
const PARTS_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function pragueParts(d: Date): { hour: number; minute: number; second: number } {
  const parts = PARTS_FORMATTER.formatToParts(d);
  const pick = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { hour: pick("hour"), minute: pick("minute"), second: pick("second") };
}

// "YYYY-MM-DD" + "HH:MM" pair, Prague TZ. Used to prefill <input type="date">
// and <input type="time"> from a stored UTC Date.
const FORM_PARTS = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function splitDateTimeForFormPrague(
  d: Date | null | undefined,
): { date: string; time: string } {
  if (!d) return { date: "", time: "" };
  const parts = FORM_PARTS.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

// "YYYY-MM-DD" Prague-local part of a Date.
export function pragueDateString(d: Date): string {
  return splitDateTimeForFormPrague(d).date;
}

// Parse a wall-clock string ("YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS")
// as Europe/Prague local time and return the equivalent UTC Date.
//
// Why: <input type="datetime-local"> posts naive wall-clock text, and on
// Vercel `new Date(s)` interprets that as UTC. Users mean Prague.
//
// Algorithm: build a UTC Date from the typed fields, ask Intl what Prague
// thinks that UTC moment is, then subtract the difference. DST edges are
// stable (no infinite loop) and pick a reasonable side of the gap/repeat.
export function parsePragueDateTimeLocal(s: string): Date {
  const [datePart, timePartRaw] = s.split("T");
  if (!datePart || !timePartRaw) return new Date(s);
  const [Y, M, D] = datePart.split("-").map(Number);
  const [h = 0, m = 0, sec = 0] = timePartRaw.split(":").map(Number);
  const asUtc = Date.UTC(Y, M - 1, D, h, m, sec);
  const parts = FORM_PARTS_WITH_SECONDS.formatToParts(new Date(asUtc));
  const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const pragueAsUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  const offsetMs = pragueAsUtc - asUtc;
  return new Date(asUtc - offsetMs);
}

const FORM_PARTS_WITH_SECONDS = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
