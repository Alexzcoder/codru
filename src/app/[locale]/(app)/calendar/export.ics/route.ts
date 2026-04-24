import { requireUser } from "@/lib/session";
import { parseDateParam, rangeForView, type View } from "@/lib/calendar-dates";
import { loadCalendarItems } from "../load-items";
import type { CalendarItem } from "../calendar-item";

const VIEWS: View[] = ["month", "week", "day"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ICS requires UTC in the form YYYYMMDDTHHMMSSZ.
function toIcsUtc(d: Date): string {
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

function toIcsDate(d: Date): string {
  return (
    d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate())
  );
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function renderEvent(item: CalendarItem): string {
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
  lines.push(`DTSTAMP:${toIcsUtc(new Date())}`);
  if (item.completedAt) lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const view: View = VIEWS.includes(url.searchParams.get("view") as View)
    ? (url.searchParams.get("view") as View)
    : "month";
  const date = parseDateParam(url.searchParams.get("date") ?? undefined);
  const { start, end } = rangeForView(view, date);

  const items = await loadCalendarItems({ start, end });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//NONSGML v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...items.map(renderEvent),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="crm-calendar-${toIcsDate(start)}.ics"`,
    },
  });
}
