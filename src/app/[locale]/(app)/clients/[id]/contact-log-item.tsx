"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateContactLog, deleteContactLog } from "./contact-actions";

type Log = {
  id: string;
  type: "PHONE" | "EMAIL" | "MEETING" | "SITE_VISIT" | "OTHER";
  date: string; // ISO
  notes: string;
  loggedByName: string | null;
};

export function ContactLogItem({ log }: { log: Log }) {
  const t = useTranslations("Clients");
  const [editing, setEditing] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpdate(formData: FormData) {
    setError(null);
    formData.set("id", log.id);
    startTransition(async () => {
      const res = await updateContactLog({}, formData);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this contact log entry?")) return;
    startTransition(async () => {
      const res = await deleteContactLog(log.id);
      if (res.error) setError(res.error);
    });
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={handleUpdate} className="space-y-2">
          <div className="flex items-center gap-2">
            <select
              name="type"
              defaultValue={log.type}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {(["PHONE", "EMAIL", "MEETING", "SITE_VISIT", "OTHER"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`contactType.${v}`)}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              name="date"
              defaultValue={log.date.slice(0, 16)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <textarea
            name="notes"
            defaultValue={log.notes}
            required
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group px-4 py-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t(`contactType.${log.type}`)} · {log.loggedByName ?? "—"}
        </span>
        <div className="flex items-center gap-3">
          <time>{log.date.slice(0, 16).replace("T", " ")}</time>
          <button
            type="button"
            className="opacity-0 transition group-hover:opacity-100 hover:text-foreground"
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            Edit
          </button>
          <button
            type="button"
            className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
            onClick={handleDelete}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{log.notes}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}
