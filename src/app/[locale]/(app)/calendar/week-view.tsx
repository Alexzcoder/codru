import { Link } from "@/i18n/navigation";
import { addDays, sameDay, startOfWeek } from "@/lib/calendar-dates";
import type { CalendarItem } from "./calendar-item";

export function WeekView({
  anchorDate,
  items,
  weekdays,
}: {
  anchorDate: Date;
  items: CalendarItem[];
  weekdays: string[];
}) {
  const start = startOfWeek(anchorDate);
  const days: { date: Date; items: CalendarItem[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push({
      date: d,
      items: items.filter((it) => sameDay(it.start, d)),
    });
  }

  const today = new Date();

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {days.map(({ date, items }, i) => {
        const isToday = sameDay(date, today);
        return (
          <div
            key={i}
            className="rounded-md border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                {weekdays[i]}
              </span>
              <span
                className={`text-sm font-medium ${isToday ? "rounded bg-neutral-900 px-1.5 py-0.5 text-white" : ""}`}
              >
                {date.getDate()}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {items.length === 0 && (
                <li className="text-[11px] text-neutral-400">—</li>
              )}
              {items.map((it) => (
                <li key={`${it.kind}:${it.id}`}>
                  <Link
                    href={it.href}
                    className="block rounded px-2 py-1 text-xs hover:underline"
                    style={{
                      background: `${it.color}22`,
                      color: it.color,
                      textDecoration: it.completedAt ? "line-through" : undefined,
                    }}
                  >
                    <span className="font-semibold">{it.title}</span>
                    <br />
                    <span className="text-[10px] opacity-75">
                      {it.allDay
                        ? "all day"
                        : `${formatTime(it.start)}${it.end ? "–" + formatTime(it.end) : ""}`}
                      {it.subtitle ? ` · ${it.subtitle}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
