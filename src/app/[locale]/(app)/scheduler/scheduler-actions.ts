"use server";

import { requireWorkspace } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { notFound } from "next/navigation";
import { pickTopSlots, DEGREES, type DegreeCode, type RankedSlot } from "@/lib/scheduler";

export type AnalyzeResult =
  | {
      ok: true;
      slots: RankedSlot[];
      parsedCount: number;
      rejectedCount: number;
      degrees: DegreeCode[];
    }
  | { ok: false; error: string };

export async function analyzeSchedule(
  csv: string,
  degrees: DegreeCode[],
): Promise<AnalyzeResult> {
  const { workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "scheduler")) notFound();

  if (!csv || csv.trim().length === 0) {
    return { ok: false, error: "Paste at least one row of speaker availability." };
  }
  const valid = degrees.filter((d): d is DegreeCode =>
    DEGREES.some((x) => x.code === d),
  );
  if (valid.length === 0) {
    return { ok: false, error: "Pick at least one target degree." };
  }
  const { ranked, parsedCount, rejectedCount } = pickTopSlots(csv, valid, 3);
  if (ranked.length === 0) {
    return {
      ok: false,
      error: `No usable rows in the CSV (${rejectedCount} skipped).`,
    };
  }
  return {
    ok: true,
    slots: ranked,
    parsedCount,
    rejectedCount,
    degrees: valid,
  };
}
