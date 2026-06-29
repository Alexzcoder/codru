"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export type JobOption = { id: string; title: string; clientName?: string | null };

// Searchable replacement for the plain job <select>. The job list grew long
// enough that scrolling a native dropdown (esp. on mobile) was painful. Submits
// the chosen id through a hidden input named `name`, so it's a drop-in for
// forms that post FormData to a Server Action. Works controlled (pass
// value + onValueChange) or uncontrolled (pass defaultValue). Dependency-free.
export function JobCombobox({
  name,
  id,
  jobs,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  emptyLabel,
  noResultsLabel,
  required,
}: {
  name: string;
  id?: string;
  jobs: JobOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Text when a search matches nothing. Defaults to the job wording. */
  noResultsLabel?: string;
  required?: boolean;
}) {
  const locale = useLocale();
  const cs = locale === "cs";
  const [internal, setInternal] = useState(defaultValue ?? "");
  const selected = value !== undefined ? value : internal;
  const setSelected = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = (j: JobOption) =>
    j.clientName ? `${j.title} — ${j.clientName}` : j.title;

  const selectedJob = jobs.find((j) => j.id === selected);

  const filtered = useMemo(() => {
    const ql = query.trim().toLowerCase();
    const list = ql
      ? jobs.filter(
          (j) =>
            j.title.toLowerCase().includes(ql) ||
            (j.clientName?.toLowerCase().includes(ql) ?? false),
        )
      : jobs;
    return list.slice(0, 50);
  }, [jobs, query]);

  const placeholderText = placeholder ?? (cs ? "Vyberte zakázku…" : "Select a job…");
  const emptyText = emptyLabel ?? "—";

  const choose = (v: string) => {
    setSelected(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Posts with the form. `required` blocks empty submits when needed. */}
      <input type="hidden" name={name} value={selected} required={required} />
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={selectedJob ? "truncate" : "truncate text-muted-foreground"}>
          {selectedJob ? label(selectedJob) : placeholderText}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-1.5 border-b border-border px-2">
            <Search size={14} className="shrink-0 opacity-50" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={cs ? "Hledat…" : "Search…"}
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => choose("")}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="w-3.5 shrink-0">
                  {selected === "" && <Check size={14} />}
                </span>
                <span className="text-muted-foreground">{emptyText}</span>
              </button>
            </li>
            {filtered.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => choose(j.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="w-3.5 shrink-0">
                    {selected === j.id && <Check size={14} />}
                  </span>
                  <span className="truncate">{label(j)}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {noResultsLabel ?? (cs ? "Žádné zakázky" : "No jobs")}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
