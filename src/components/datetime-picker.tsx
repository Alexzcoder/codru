"use client";

import { useMemo, useState } from "react";

// Date + time inputs that post a single hidden datetime-local-formatted value
// (YYYY-MM-DDTHH:MM in 24h) under `name`, so the existing zod parser keeps
// working unchanged.
//
// Native inputs only — base-ui's <Input> wrapper has historically dropped
// attributes on us, and the previous 12-hour + AM/PM split confused Czech
// users who type 24-hour time. Native `type="time"` already shows the right
// format for the user's locale (24h in cs, 12h in en).
const inputCls =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DateTimePicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: Date | null;
}) {
  const initial = useMemo(() => splitInitial(defaultValue ?? null), [defaultValue]);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  const combined = date && time ? `${date}T${time}` : "";

  return (
    <>
      <input type="hidden" name={name} value={combined} />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputCls} flex-1`}
          aria-label="Date"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={`${inputCls} w-28`}
          aria-label="Time"
          step="60"
        />
      </div>
    </>
  );
}

function splitInitial(d: Date | null) {
  if (!d) return { date: "", time: "" };
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}
