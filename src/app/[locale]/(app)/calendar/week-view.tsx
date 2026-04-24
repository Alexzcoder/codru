import { addDays, sameDay, startOfDay, startOfWeek } from "@/lib/calendar-dates";
import type { CalendarItem } from "./calendar-item";
import { HourAxis, TimeGridColumn, AllDayStrip } from "./time-grid";

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

  // All-day items for the week to pin above the grid
  const allDayByDay = days.map((d) => d.items.filter((i) => i.allDay));
  const hasAllDay = allDayByDay.some((arr) => arr.length > 0);

  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      <div className="flex border-b border-neutral-200">
        <div className="w-14 shrink-0" />
        {days.map(({ date }, i) => {
          const isToday = sameDay(date, today);
          return (
            <div
              key={i}
              className="flex-1 border-l border-neutral-200 px-2 py-2 text-center"
            >
              <div className="text-xs uppercase tracking-wider text-neutral-500">
                {weekdays[i]}
              </div>
              <div
                className={`mt-0.5 text-sm font-medium ${isToday ? "inline-block rounded bg-neutral-900 px-1.5 py-0.5 text-white" : ""}`}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="flex border-b border-neutral-200">
          <div className="w-14 shrink-0 py-1 pl-2 text-[10px] uppercase text-neutral-500">
            all day
          </div>
          {allDayByDay.map((arr, i) => (
            <div key={i} className="flex-1 border-l border-neutral-200 p-1">
              <AllDayStrip items={arr} />
            </div>
          ))}
        </div>
      )}

      <div className="flex overflow-auto" style={{ maxHeight: "70vh" }}>
        <HourAxis />
        {days.map(({ date, items }, i) => (
          <div key={i} className="flex-1 min-w-0">
            <TimeGridColumn dayStart={startOfDay(date)} items={items} />
          </div>
        ))}
      </div>
    </div>
  );
}
