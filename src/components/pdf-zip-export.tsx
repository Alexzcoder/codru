import { Download } from "lucide-react";

// Bulk PDF download with filters: status (e.g. only accepted quotes / rejected /
// paid) and a date-range timeframe. A no-JS <details> disclosure holding a GET
// form straight to the export.zip route, so it works without client JavaScript.
export function PdfZipExport({
  action,
  label,
  allLabel,
  statuses,
  q,
}: {
  /** Locale-prefixed route, e.g. `/cs/quotes/export.zip` */
  action: string;
  label: string;
  /** Label for the "any status" option, e.g. "All". */
  allLabel: string;
  /** Selectable statuses for this document type. */
  statuses: { value: string; label: string }[];
  /** Carry the current search filter into the export. */
  q?: string;
}) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
        <Download size={14} /> {label}
        <span className="text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form
        method="get"
        action={action}
        className="absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-md border border-border bg-card p-3 text-sm shadow-lg"
      >
        {q ? <input type="hidden" name="q" value={q} /> : null}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="zip-status">
            Status
          </label>
          <select
            id="zip-status"
            name="status"
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{allLabel}</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="zip-from">
              From
            </label>
            <input
              id="zip-from"
              type="date"
              name="from"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="zip-to">
              To
            </label>
            <input
              id="zip-to"
              type="date"
              name="to"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Download size={14} /> {label}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Leave fields blank to include everything.
        </p>
      </form>
    </details>
  );
}
