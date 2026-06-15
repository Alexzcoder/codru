import { Download } from "lucide-react";

// A no-JS bulk PDF download control: pick a month, get a ZIP of every document's
// PDF for that month. Submits a GET form straight to the export.zip route, so it
// works without client-side JavaScript. Leave the month empty to download all.
export function PdfZipExport({
  action,
  label,
  defaultMonth,
  q,
}: {
  /** Locale-prefixed route, e.g. `/cs/final-invoices/export.zip` */
  action: string;
  label: string;
  /** YYYY-MM to preselect (usually the current month). */
  defaultMonth?: string;
  /** Carry the current search filter into the export. */
  q?: string;
}) {
  return (
    <form method="get" action={action} className="flex items-center gap-1.5">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      <input
        type="month"
        name="month"
        defaultValue={defaultMonth}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label={label}
      />
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
      >
        <Download size={14} /> {label}
      </button>
    </form>
  );
}
