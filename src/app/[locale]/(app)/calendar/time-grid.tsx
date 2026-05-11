import { Link } from "@/i18n/navigation";
import type { CalendarItem } from "./calendar-item";
import { formatTimePrague, pragueParts } from "@/lib/format-datetime";

// 48 px per hour → full day = 1152 px. The scroll-container below caps the
// visible height so the whole day fits most screens without scrolling.
const HOUR_PX = 48;
const DEFAULT_DURATION_MIN = 60;

type Positioned = {
  item: CalendarItem;
  topPx: number;
  heightPx: number;
  col: number;
  cols: number;
};

// Lays events out in columns so overlapping events don't visually cover each
// other. Classic calendar-grid layout: within a cluster of transitively-
// overlapping events, each gets a column index 0..N-1, and renders with
// width = 100%/N, left = col * width.
// Project a Date onto a Prague-local minute-of-day. Anchored on Prague
// midnight, NOT server midnight — on Vercel the server is UTC, so naïve
// `entry.start - dayStart` arithmetic shifts blocks by 1–2 hours
// (DST-dependent) and the rendered position no longer matches the label.
function minuteOfDayPrague(d: Date): number {
  const p = pragueParts(d);
  return p.hour * 60 + p.minute;
}

function positionDayEvents(items: CalendarItem[]): Positioned[] {
  const entries = items
    .filter((it) => !it.allDay)
    .map((it) => {
      const startMin = minuteOfDayPrague(it.start);
      const endRaw =
        it.end ?? new Date(it.start.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
      // If the event ends on a later Prague-day, clamp to end-of-day so the
      // block doesn't spill past the visible 24h column.
      const sameDay = pragueDayKey(endRaw) === pragueDayKey(it.start);
      const endMin = sameDay ? minuteOfDayPrague(endRaw) : 24 * 60;
      return { item: it, start: startMin, end: Math.max(endMin, startMin + 1) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: Positioned[] = [];
  const clusters: (typeof entries)[] = [];
  for (const e of entries) {
    const last = clusters[clusters.length - 1];
    if (last && last.some((p) => p.end > e.start)) last.push(e);
    else clusters.push([e]);
  }

  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const assigned: { entry: (typeof entries)[0]; col: number }[] = [];
    for (const e of cluster) {
      let col = colEnds.findIndex((end) => end <= e.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = e.end;
      assigned.push({ entry: e, col });
    }
    const cols = colEnds.length;
    for (const { entry, col } of assigned) {
      const minutesFromMidnight = entry.start;
      const durationMin = entry.end - entry.start;
      result.push({
        item: entry.item,
        topPx: (minutesFromMidnight * HOUR_PX) / 60,
        heightPx: Math.max((durationMin * HOUR_PX) / 60, 18),
        col,
        cols,
      });
    }
  }
  return result;
}

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function pragueDayKey(d: Date): string {
  return DAY_KEY_FORMATTER.format(d);
}

export function TimeGridColumn({
  dayStart: _dayStart,
  items,
}: {
  dayStart: Date;
  items: CalendarItem[];
}) {
  const positioned = positionDayEvents(items);
  return (
    <div
      className="relative border-l border-border"
      style={{ height: HOUR_PX * 24 }}
    >
      {/* Hour separator lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-neutral-100"
          style={{ top: h * HOUR_PX }}
        />
      ))}
      {positioned.map((p) => (
        <EventBlock key={`${p.item.kind}:${p.item.id}`} p={p} />
      ))}
    </div>
  );
}

export function HourAxis() {
  return (
    <div
      className="relative w-14 shrink-0"
      style={{ height: HOUR_PX * 24 }}
    >
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
          style={{ top: h * HOUR_PX }}
        >
          {String(h).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

function EventBlock({ p }: { p: Positioned }) {
  const widthPct = 100 / p.cols;
  const leftPct = p.col * widthPct;
  return (
    <Link
      href={p.item.href}
      className="absolute overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight shadow-sm hover:ring-2 hover:ring-neutral-900/20"
      style={{
        top: p.topPx,
        height: p.heightPx,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: `${p.item.color}22`,
        color: p.item.color,
        borderLeft: `3px solid ${p.item.color}`,
        textDecoration: p.item.completedAt ? "line-through" : undefined,
      }}
      title={`${formatTime(p.item.start)}${p.item.end ? "–" + formatTime(p.item.end) : ""} ${p.item.title}`}
    >
      <div className="font-semibold truncate">{p.item.title}</div>
      <div className="text-[10px] opacity-75">
        {formatTime(p.item.start)}
        {p.item.end ? `–${formatTime(p.item.end)}` : ""}
        {p.item.subtitle ? ` · ${p.item.subtitle}` : ""}
      </div>
    </Link>
  );
}

function formatTime(d: Date) {
  return formatTimePrague(d);
}

export function AllDayStrip({ items }: { items: CalendarItem[] }) {
  const allDay = items.filter((i) => i.allDay);
  if (allDay.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-border p-1">
      {allDay.map((it) => (
        <Link
          key={`${it.kind}:${it.id}`}
          href={it.href}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: `${it.color}22`, color: it.color }}
        >
          {it.title}
        </Link>
      ))}
    </div>
  );
}
