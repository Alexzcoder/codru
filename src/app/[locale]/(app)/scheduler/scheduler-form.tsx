"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { DEGREES, type DegreeCode } from "@/lib/scheduler";
import { analyzeSchedule, type AnalyzeResult } from "./scheduler-actions";

type Row = { from: string; to: string };

const HHMM = /^(\d{1,2}):(\d{2})$/;

function hhmmToHour(s: string): number | null {
  const m = HHMM.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h + mm / 60;
}

const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function SchedulerForm() {
  const [date, setDate] = useState(todayIso);
  const [rows, setRows] = useState<Row[]>([{ from: "18:00", to: "20:00" }]);
  const [picked, setPicked] = useState<Set<DegreeCode>>(
    new Set(["BBA", "BIR"]),
  );
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, startTransition] = useTransition();

  const addRow = () => setRows((prev) => [...prev, { from: "", to: "" }]);
  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const togglePicked = (code: DegreeCode) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ranges = rows
      .map((r) => {
        const fromHour = hhmmToHour(r.from);
        const toHour = hhmmToHour(r.to);
        if (fromHour == null || toHour == null) return null;
        return { fromHour, toHour };
      })
      .filter((r): r is { fromHour: number; toHour: number } => r !== null);

    startTransition(async () => {
      const r = await analyzeSchedule({
        date,
        ranges,
        degrees: Array.from(picked),
      });
      setResult(r);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">Event day</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-xs"
          required
        />
      </div>

      {/* Time slots */}
      <div className="space-y-3">
        <Label>Speaker availability that day</Label>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
            >
              <Input
                type="time"
                value={r.from}
                onChange={(e) => updateRow(i, { from: e.target.value })}
                aria-label="Start time"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="time"
                value={r.to}
                onChange={(e) => updateRow(i, { to: e.target.value })}
                aria-label="End time"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                aria-label="Remove slot"
                className="cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-secondary disabled:opacity-30"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="gap-1.5"
        >
          <Plus size={14} /> Add another slot
        </Button>
      </div>

      {/* Degrees */}
      <div className="space-y-2">
        <Label>Target degrees</Label>
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
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Finding the best slots…" : "Find best slots"}
      </Button>

      {result && !result.ok && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {result && result.ok && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top {result.slots.length} time slot
            {result.slots.length === 1 ? "" : "s"}
          </h2>
          <ol className="space-y-2">
            {result.slots.map((s, i) => (
              <li
                key={`${s.date}-${s.from}-${s.to}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="text-sm font-medium tabular-nums">
                  {s.date} · {s.from}–{s.to}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </form>
  );
}
