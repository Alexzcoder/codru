"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ImportClientsState } from "./actions";

export function ImportForm({
  action,
}: {
  action: (
    prev: ImportClientsState,
    formData: FormData,
  ) => Promise<ImportClientsState>;
}) {
  const [state, formAction, pending] = useActionState<ImportClientsState, FormData>(
    action,
    {},
  );
  const [dryRun, setDryRun] = useState(true);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="file"
        name="file"
        accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        required
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="dryRun"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
        />
        Preview only (don&apos;t actually create anything yet)
      </label>

      <Button type="submit" disabled={pending} size="sm">
        {pending
          ? dryRun
            ? "Previewing…"
            : "Importing…"
          : dryRun
            ? "Preview"
            : "Import for real"}
      </Button>

      {state.ok && (
        <div
          className={`rounded-md border p-3 text-sm ${
            state.dryRun
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          {state.dryRun ? "Preview:" : "Done."} {state.inserted ?? 0}{" "}
          {state.dryRun ? "to create" : "created"}, {state.jobsInserted ?? 0}{" "}
          {state.dryRun ? "jobs to create" : "jobs created"},{" "}
          {state.skipped ?? 0} skipped.
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {state.dryRun && (
            <p className="mt-2 text-xs">
              Looks good? Untick &ldquo;Preview only&rdquo; above and click
              &ldquo;Import for real&rdquo;.
            </p>
          )}
        </div>
      )}

      {state.preview && state.preview.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card text-xs shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-secondary/40 uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Row</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">IČO / Email</th>
                <th className="px-3 py-2 text-left">Job</th>
                <th className="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {state.preview.map((p) => (
                <tr key={p.rowNo}>
                  <td className="px-3 py-2 text-muted-foreground">{p.rowNo}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        p.status === "would_create"
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-green-900"
                          : p.status === "would_skip"
                            ? "rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-900"
                            : "rounded-full bg-red-100 px-2 py-0.5 text-red-900"
                      }
                    >
                      {p.status === "would_create"
                        ? "create"
                        : p.status === "would_skip"
                          ? "skip"
                          : "error"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.client}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.ico ?? p.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.job ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.reason ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.ok === false && state.errors && (
        <ul className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
