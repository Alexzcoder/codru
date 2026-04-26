"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="file"
        name="file"
        accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        required
      />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Importing…" : "Import"}
      </Button>

      {state.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Inserted {state.inserted ?? 0}; skipped {state.skipped ?? 0}.
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
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
