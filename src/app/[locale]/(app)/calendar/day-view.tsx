import type { CalendarItem } from "./calendar-item";
import { HourAxis, TimeGridColumn, AllDayStrip } from "./time-grid";

export function DayView({
  anchorDate,
  items,
}: {
  anchorDate: Date;
  items: CalendarItem[];
}) {
  const dayKey = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}-${String(anchorDate.getDate()).padStart(2, "0")}`;
  const dateLabel = anchorDate.toLocaleDateString(undefined, { dateStyle: "full" });

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">
        {dateLabel}
      </div>
      <AllDayStrip items={items} />
      <div className="flex overflow-auto" style={{ maxHeight: "70vh" }}>
        <HourAxis />
        <div className="flex-1">
          <TimeGridColumn dayKey={dayKey} items={items} />
        </div>
      </div>
    </div>
  );
}
