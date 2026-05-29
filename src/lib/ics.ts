import type { CalendarItem } from "@/app/[locale]/(app)/calendar/calendar-item";

// iCalendar (RFC 5545) serialization shared by the in-app export and the
// public subscription feed.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ICS requires UTC in the form YYYYMMDDTHHMMSSZ.
export function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function toIcsDate(d: Date): string {
  return d.getUTCFullYear().toString() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function escape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function renderEvent(item: CalendarItem, stamp: Date): string {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${item.kind.toLowerCase()}-${item.id}@crm.local`);
  lines.push(`SUMMARY:${escape(item.title)}`);
  if (item.subtitle) lines.push(`DESCRIPTION:${escape(item.subtitle)}`);
  if (item.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(item.start)}`);
    const end = item.end ?? new Date(item.start.getTime() + 24 * 60 * 60 * 1000);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(end)}`);
  } else {
    lines.push(`DTSTART:${toIcsUtc(item.start)}`);
    const end = item.end ?? new Date(item.start.getTime() + 60 * 60 * 1000);
    lines.push(`DTEND:${toIcsUtc(end)}`);
  }
  lines.push(`DTSTAMP:${toIcsUtc(stamp)}`);
  if (item.completedAt) lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Build a full VCALENDAR document from calendar items. */
export function buildIcsCalendar(items: CalendarItem[], opts?: { name?: string }): string {
  const stamp = new Date();
  const head = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//NONSGML v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (opts?.name) {
    head.push(`X-WR-CALNAME:${escape(opts.name)}`);
    head.push(`NAME:${escape(opts.name)}`);
  }
  return [
    ...head,
    ...items.map((i) => renderEvent(i, stamp)),
    "END:VCALENDAR",
  ].join("\r\n");
}
