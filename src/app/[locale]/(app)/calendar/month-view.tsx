import { Link } from "@/i18n/navigation";
import { addDays, monthGridRange, sameDay, startOfMonth, endOfMonth } from "@/lib/calendar-dates";
import type { CalendarItem } from "./calendar-item";
import { formatTimePrague } from "@/lib/format-datetime";
import { coversDay } from "./calendar-span";

// The cell's `Date` is already at local-midnight (constructed from year,
// month, day fields) — its Prague-projected day equals the calendar day
// it represents, since Prague is always east of UTC.
function cellDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_VISIBLE = 3;

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
  const cells: { date: Date; items: CalendarItem[] }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const key = cellDayKey(d);
    cells.push({
      date: d,
      // A multi-day item appears in every cell from its start day to its end day.
      items: items.filter((it) => coversDay(it.start, it.end, key)),
    });
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
      <div className="grid grid-cols-7">
        {cells.map(({ date, items }, i) => {
          const inMonth = date >= monthStart && date <= monthEnd;
          const isToday = sameDay(date, today);
          return (
            <div
              key={i}
              className={`min-h-24 border-t border-r border-border p-1.5 text-xs ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${inMonth ? "bg-white" : "bg-secondary/40/60 text-muted-foreground"}`}
            >
              <div
                className={`mb-1 text-right text-[11px] font-medium ${isToday ? "inline-block rounded bg-primary px-1.5 py-0.5 text-white" : ""}`}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, MAX_VISIBLE).map((it) => (
                  <EventPill key={`${it.kind}:${it.id}`} item={it} />
                ))}
                {items.length > MAX_VISIBLE && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{items.length - MAX_VISIBLE} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
      title={`${formatTime(item.start)} ${item.title}`}
    >
      <span className="font-normal">{item.allDay ? "" : formatTime(item.start) + " "}</span>
      {item.title}
    </Link>
  );
}

function formatTime(d: Date) {
  return formatTimePrague(d);
}
