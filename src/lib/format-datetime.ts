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
