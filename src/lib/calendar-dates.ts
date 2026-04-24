// Date helpers for calendar views. All work in local time (Europe/Prague for server
// per PRD §22.5). We accept/produce Date objects and YYYY-MM-DD strings.

export type View = "month" | "week" | "day";

export function parseDateParam(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toDateParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// Week starts Monday (Czech convention).
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const s = startOfDay(d);
  s.setDate(s.getDate() - day);
  return s;
}
export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  return endOfDay(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Grid used for monthly view: 6 weeks × 7 days, starting from the Monday on or
// before the 1st of the month, so every cell lines up regardless of which
// weekday the month begins on.
export function monthGridRange(d: Date): { start: Date; end: Date } {
  const firstOfMonth = startOfMonth(d);
  const start = startOfWeek(firstOfMonth);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42);
  return { start, end };
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function rangeForView(view: View, date: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(date), end: endOfDay(date) };
  if (view === "week") return { start: startOfWeek(date), end: endOfWeek(date) };
  return monthGridRange(date);
}
