"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { undoImport } from "./actions";

export type RecentBatch = {
  id: string;
  createdAt: string;
  filename: string | null;
  clients: number;
  jobs: number;
  status: "ACTIVE" | "UNDONE";
  undoneAt: string | null;
};

export function RecentImports({ batches }: { batches: RecentBatch[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (batches.length === 0) return null;

  function handleUndo(id: string) {
    if (!confirm("Soft-delete every client and job created by this import?")) return;
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await undoImport(id);
      setBusyId(null);
      if (res.error) setError(res.error);
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold">Recent imports</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card text-sm shadow-sm">
        {batches.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {b.filename ?? "(unnamed file)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(b.createdAt).toLocaleString()} · {b.clients}{" "}
                {b.clients === 1 ? "client" : "clients"}
                {b.jobs > 0 && ` · ${b.jobs} ${b.jobs === 1 ? "job" : "jobs"}`}
              </p>
            </div>
            {b.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending && busyId === b.id}
                onClick={() => handleUndo(b.id)}
              >
                {pending && busyId === b.id ? "Undoing…" : "Undo"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Undone {b.undoneAt ? new Date(b.undoneAt).toLocaleDateString() : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error === "notFound"
            ? "Batch not found in this workspace."
            : error === "alreadyUndone"
              ? "This batch was already undone."
              : error}
        </p>
      )}
    </section>
  );
}
