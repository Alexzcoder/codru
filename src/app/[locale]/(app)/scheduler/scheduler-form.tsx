"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEGREES, type DegreeCode, formatHour } from "@/lib/scheduler";
import { analyzeSchedule, type AnalyzeResult } from "./scheduler-actions";

const SAMPLE = `# date, from, to — one slot per line
2026-05-12, 18:00, 20:00
2026-05-13, 15:00, 17:30
2026-05-14, 09:00, 11:00
2026-05-15, 19:00, 21:00
2026-05-19, 17:00, 19:30`;

export function SchedulerForm() {
  const [csv, setCsv] = useState(SAMPLE);
  const [picked, setPicked] = useState<Set<DegreeCode>>(new Set(["BBA", "BIR"]));
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, startTransition] = useTransition();

  const togglePicked = (code: DegreeCode) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await analyzeSchedule(csv, Array.from(picked));
      setResult(r);
    });
  };

  const onCsvFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="csv">Speaker availability (CSV)</Label>
            <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
              />
              Upload a .csv
            </label>
          </div>
          <textarea
            id="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            spellCheck={false}
            className="h-64 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            One row per slot:{" "}
            <code className="rounded bg-secondary/60 px-1">date, from, to</code>.
            Date is <code>YYYY-MM-DD</code> or <code>D.M.YYYY</code>; times are{" "}
            <code>HH:MM</code> 24-hour.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Target IE degrees</Label>
          <div className="flex flex-wrap gap-2">
            {DEGREES.map((d) => {
              const active = picked.has(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => togglePicked(d.code)}
                  title={d.label}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d.code}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pick one or more cohorts you want to fill the room. Each degree has
            a built-in &ldquo;best window&rdquo; (weekday + hour range) the
            optimizer scores against.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Analyzing…" : "Analyze"}
      </Button>

      {result && !result.ok && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {result && result.ok && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Parsed {result.parsedCount} slot
            {result.parsedCount === 1 ? "" : "s"}
            {result.rejectedCount > 0
              ? `, ${result.rejectedCount} unusable row${result.rejectedCount === 1 ? "" : "s"} skipped.`
              : "."}{" "}
            Targets: {result.degrees.join(" + ")}.
          </p>
          <ol className="space-y-3">
            {result.slots.map((s, i) => {
              const fmt = (h: number) => formatHour(h);
              const overlapping = s.perDegree.filter((p) => p.overlapMinutes > 0);
              return (
                <li
                  key={`${s.date}-${s.fromHour}`}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        #{i + 1} · {s.date} · {fmt(s.fromHour)}–{fmt(s.toHour)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.durationMinutes} min total ·{" "}
                        {s.totalOverlapMinutes} min overlap with target degrees
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary tabular-nums">
                      score {s.totalScore}
                    </span>
                  </div>
                  {overlapping.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                      {overlapping.map((d) => (
                        <li
                          key={d.code}
                          className="rounded-full bg-secondary px-2 py-0.5 text-foreground"
                        >
                          {d.code}: {d.overlapMinutes} min
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      No overlap with picked degrees&apos; best windows — wins on length only.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </form>
  );
}
