"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

// Friendlier alternative to <input type="datetime-local">: separate date,
// 12-hour time (with autocomplete suggestions in 30-min slots), and AM/PM.
// Posts a hidden datetime-local-formatted value (YYYY-MM-DDTHH:MM in 24h)
// under `name`, so the existing zod parser keeps working unchanged.
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
  const [ampm, setAmpm] = useState(initial.ampm);

  const combined = combine(date, time, ampm);
  const slots = useTimeSlots();
  const listId = `${name}-time-slots`;

  return (
    <>
      <input type="hidden" name={name} value={combined} />
      <div className="flex gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1"
          aria-label="Date"
        />
        <Input
          type="text"
          inputMode="numeric"
          placeholder="hh:mm"
          list={listId}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-24"
          aria-label="Time"
        />
        <datalist id={listId}>
          {slots.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <select
          value={ampm}
          onChange={(e) => setAmpm(e.target.value as "AM" | "PM")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="AM/PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </>
  );
}

function useTimeSlots() {
  return useMemo(() => {
    const out: string[] = [];
    for (let h = 1; h <= 12; h++) {
      for (const m of [0, 30]) out.push(`${h}:${String(m).padStart(2, "0")}`);
    }
    return out;
  }, []);
}

function splitInitial(d: Date | null) {
  if (!d) return { date: "", time: "", ampm: "AM" as "AM" | "PM" };
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const h24 = dt.getHours();
  const m = dt.getMinutes();
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${h12}:${String(m).padStart(2, "0")}`,
    ampm,
  };
}

function combine(date: string, time: string, ampm: "AM" | "PM"): string {
  if (!date) return "";
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  let h = Number(match[1]);
  const min = Number(match[2]);
  if (h < 1 || h > 12 || min > 59) return "";
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
