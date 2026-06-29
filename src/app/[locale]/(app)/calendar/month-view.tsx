import { Link } from "@/i18n/navigation";
import { addDays, monthGridRange, sameDay, startOfMonth, endOfMonth } from "@/lib/calendar-dates";
import type { CalendarItem } from "./calendar-item";
import { formatTimePrague } from "@/lib/format-datetime";
import { pragueDayKey, itemEndDayKey } from "./calendar-span";

// The cell's `Date` is already at local-midnight (constructed from year,
// month, day fields) — its Prague-projected day equals the calendar day
// it represents, since Prague is always east of UTC.
function cellDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_SINGLE = 3; // single-day pills shown per cell before "+N more"
const DAY_NUM_H = 20; // px reserved at the top of each cell for the date number
const BAR_H = 20; // px per spanning-bar lane

const isMultiDay = (it: CalendarItem) =>
  itemEndDayKey(it.start, it.end) > pragueDayKey(it.start);

type Bar = {
  item: CalendarItem;
  startCol: number;
  endCol: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

// Place each multi-day item as one continuous bar across the week, stacking
// overlapping bars into lanes (greedy: first lane whose last bar already ended).
function layoutWeekBars(weekKeys: string[], spanItems: CalendarItem[]): Bar[] {
  const first = weekKeys[0];
  const last = weekKeys[6];
  const segs = spanItems
    .map((it) => {
      const sKey = pragueDayKey(it.start);
      const eKey = itemEndDayKey(it.start, it.end);
      return {
        item: it,
        sKey,
        eKey,
        startCol: sKey <= first ? 0 : weekKeys.indexOf(sKey),
        endCol: eKey >= last ? 6 : weekKeys.indexOf(eKey),
        continuesLeft: sKey < first,
        continuesRight: eKey > last,
      };
    })
    // Keep only items that actually overlap this week and resolved to real cols.
    .filter((s) => s.eKey >= first && s.sKey <= last && s.startCol !== -1 && s.endCol !== -1)
    .sort(
      (a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol),
    );

  const laneEnds: number[] = [];
  const bars: Bar[] = [];
  for (const s of segs) {
    let lane = laneEnds.findIndex((end) => end < s.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(-1);
    }
    laneEnds[lane] = s.endCol;
    bars.push({
      item: s.item,
      startCol: s.startCol,
      endCol: s.endCol,
      lane,
      continuesLeft: s.continuesLeft,
      continuesRight: s.continuesRight,
    });
  }
  return bars;
}

export function MonthView({
  anchorDate,
  items,
  weekdays,
}: {
  anchorDate: Date;
  items: CalendarItem[];
  weekdays: string[];
}) {
  const { start } = monthGridRange(anchorDate);
  // Six week-rows of seven days.
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  }

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-7 bg-secondary/40 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const weekKeys = week.map(cellDayKey);
        const bars = layoutWeekBars(weekKeys, items.filter(isMultiDay));
        const laneCount = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
        const barBand = laneCount * BAR_H;

        return (
          <div key={wi} className="relative grid grid-cols-7">
            {week.map((date, di) => {
              const key = weekKeys[di];
              const inMonth = date >= monthStart && date <= monthEnd;
              const isToday = sameDay(date, today);
              // Single-day items live in the cell; multi-day ones are the bars.
              const dayItems = items.filter(
                (it) => !isMultiDay(it) && pragueDayKey(it.start) === key,
              );
              return (
                <div
                  key={di}
                  className={`min-h-24 border-t border-r border-border p-1.5 text-xs ${di === 6 ? "border-r-0" : ""} ${inMonth ? "bg-white" : "bg-secondary/40/60 text-muted-foreground"}`}
                >
                  <div
                    className="text-right text-[11px] font-medium"
                    style={{ height: DAY_NUM_H }}
                  >
                    <span
                      className={
                        isToday
                          ? "inline-block rounded bg-primary px-1.5 py-0.5 text-white"
                          : ""
                      }
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  {/* reserve room so day pills sit below the spanning bars */}
                  <div style={{ marginTop: barBand }} className="space-y-0.5">
                    {dayItems.slice(0, MAX_SINGLE).map((it) => (
                      <EventPill key={`${it.kind}:${it.id}`} item={it} />
                    ))}
                    {dayItems.length > MAX_SINGLE && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{dayItems.length - MAX_SINGLE} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Spanning bars overlaid across the week's columns. */}
            <div className="pointer-events-none absolute inset-0">
              {bars.map((b) => (
                <SpanBar key={`${b.item.kind}:${b.item.id}`} bar={b} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpanBar({ bar }: { bar: Bar }) {
  const { item } = bar;
  const completed = Boolean(item.completedAt);
  const span = bar.endCol - bar.startCol + 1;
  // Square corners; flat on whichever end continues into an adjacent week.
  const padL = bar.continuesLeft ? 0 : 3;
  const padR = bar.continuesRight ? 0 : 3;
  return (
    <Link
      href={item.href}
      className="pointer-events-auto absolute flex items-center truncate px-1.5 text-[11px] font-medium hover:brightness-95"
      style={{
        left: `calc(${(bar.startCol / 7) * 100}% + ${padL}px)`,
        width: `calc(${(span / 7) * 100}% - ${padL + padR}px)`,
        top: DAY_NUM_H + bar.lane * BAR_H,
        height: BAR_H - 3,
        background: `${item.color}22`,
        color: item.color,
        borderLeft: bar.continuesLeft ? undefined : `3px solid ${item.color}`,
        textDecoration: completed ? "line-through" : undefined,
      }}
      title={`${item.allDay ? "" : formatTimePrague(item.start) + " "}${item.title}`}
    >
      <span className="truncate">
        {bar.continuesLeft ? "‹ " : ""}
        {item.title}
      </span>
    </Link>
  );
}

function EventPill({ item }: { item: CalendarItem }) {
  const completed = Boolean(item.completedAt);
  return (
    <Link
      href={item.href}
      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:underline"
      style={{
        background: `${item.color}22`,
        color: item.color,
        textDecoration: completed ? "line-through" : undefined,
      }}
      title={`${formatTimePrague(item.start)} ${item.title}`}
    >
      <span className="font-normal">{item.allDay ? "" : formatTimePrague(item.start) + " "}</span>
      {item.title}
    </Link>
  );
}
