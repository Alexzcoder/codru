import { Download } from "lucide-react";

// Excel table download with a date-range (timeframe) filter. No-JS <details>
// disclosure wrapping a GET form straight to the export.xlsx route.
export function ExcelExport({
  action,
  label = "Excel",
  q,
}: {
  /** Locale-prefixed route, e.g. `/cs/final-invoices/export.xlsx` */
  action: string;
  label?: string;
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
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="xlsx-from">
              From
            </label>
            <input
              id="xlsx-from"
              type="date"
              name="from"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="xlsx-to">
              To
            </label>
            <input
              id="xlsx-to"
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
          Leave blank for all dates.
        </p>
      </form>
    </details>
  );
}
