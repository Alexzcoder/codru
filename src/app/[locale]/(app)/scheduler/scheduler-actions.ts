"use server";

import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { notFound } from "next/navigation";
import {
  pickTopSlotsForDay,
  DEGREES,
  formatHour,
  type DegreeCode,
  type DayRange,
} from "@/lib/scheduler";

// User-facing slot — intentionally bare. No score, no overlap, no degree
// breakdown. Just date + time, the way the speaker would write it back.
export type DisplaySlot = {
  date: string; // YYYY-MM-DD
  from: string; // HH:MM
  to: string;   // HH:MM
};

export type AnalyzeResult =
  | { ok: true; slots: DisplaySlot[] }
  | { ok: false; error: string };

export async function analyzeSchedule(input: {
  date: string;
  ranges: DayRange[];
  degrees: DegreeCode[];
}): Promise<AnalyzeResult> {
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "scheduler")) notFound();

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Pick the day you want the event on." };
  }
  if (!input.ranges || input.ranges.length === 0) {
    return { ok: false, error: "Add at least one time slot the speaker is free." };
  }
  const validDegrees = input.degrees.filter((d): d is DegreeCode =>
    DEGREES.some((x) => x.code === d),
  );
  if (validDegrees.length === 0) {
    return { ok: false, error: "Pick at least one target degree." };
  }

  const { ranked } = pickTopSlotsForDay(input.date, input.ranges, validDegrees, 3);
  if (ranked.length === 0) {
    return { ok: false, error: "None of those slots are usable — check the times." };
  }

  return {
    ok: true,
    slots: ranked.map((s) => ({
      date: s.date,
      from: formatHour(s.fromHour),
      to: formatHour(s.toHour),
    })),
  };
}
