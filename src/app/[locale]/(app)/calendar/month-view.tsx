import { Link } from "@/i18n/navigation";
import { addDays, monthGridRange, sameDay, startOfMonth, endOfMonth } from "@/lib/calendar-dates";
import type { CalendarItem } from "./calendar-item";

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
    cells.push({
      date: d,
      items: items.filter((it) => sameDay(it.start, d)),
    });
  }

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 bg-neutral-50 text-center text-xs font-medium uppercase tracking-wider text-neutral-500">
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
              className={`min-h-24 border-t border-r border-neutral-200 p-1.5 text-xs ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${inMonth ? "bg-white" : "bg-neutral-50/60 text-neutral-400"}`}
            >
              <div
                className={`mb-1 text-right text-[11px] font-medium ${isToday ? "inline-block rounded bg-neutral-900 px-1.5 py-0.5 text-white" : ""}`}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, MAX_VISIBLE).map((it) => (
                  <EventPill key={`${it.kind}:${it.id}`} item={it} />
                ))}
                {items.length > MAX_VISIBLE && (
                  <p className="px-1 text-[10px] text-neutral-500">
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
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
