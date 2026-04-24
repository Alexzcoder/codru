import { Link } from "@/i18n/navigation";
import type { CalendarItem } from "./calendar-item";

export function DayView({
  anchorDate,
  items,
}: {
  anchorDate: Date;
  items: CalendarItem[];
}) {
  // Bucket events into 24 hour rows; multi-hour events appear in the hour they start.
  const byHour: Record<number, CalendarItem[]> = {};
  for (const it of items) {
    const h = it.allDay ? -1 : it.start.getHours();
    (byHour[h] ??= []).push(it);
  }

  const allDay = byHour[-1] ?? [];
  const dateLabel = anchorDate.toLocaleDateString(undefined, { dateStyle: "full" });

  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-2 text-sm font-medium">
        {dateLabel}
      </div>
      {allDay.length > 0 && (
        <div className="flex items-start gap-3 border-b border-neutral-200 px-4 py-2">
          <span className="w-12 text-xs text-neutral-500">All day</span>
          <div className="flex flex-wrap gap-2">
            {allDay.map((it) => (
              <Pill key={`${it.kind}:${it.id}`} item={it} />
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: 24 }).map((_, hour) => {
          const bucket = byHour[hour] ?? [];
          return (
            <div key={hour} className="flex min-h-12 items-start gap-3 px-4 py-2">
              <span className="w-12 text-xs tabular-nums text-neutral-400">
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="flex flex-1 flex-wrap gap-2">
                {bucket.map((it) => (
                  <Pill key={`${it.kind}:${it.id}`} item={it} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ item }: { item: CalendarItem }) {
  return (
    <Link
      href={item.href}
      className="inline-block rounded px-2 py-1 text-xs font-medium hover:underline"
      style={{
        background: `${item.color}22`,
        color: item.color,
        textDecoration: item.completedAt ? "line-through" : undefined,
      }}
    >
      {item.allDay
        ? ""
        : `${formatTime(item.start)}${item.end ? "–" + formatTime(item.end) : ""}`}{" "}
      <span className="font-semibold">{item.title}</span>
      {item.subtitle ? <span className="opacity-75"> · {item.subtitle}</span> : null}
    </Link>
  );
}

function formatTime(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
