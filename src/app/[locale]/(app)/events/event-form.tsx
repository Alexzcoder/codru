"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { EventState } from "./actions";

type Initial = {
  name?: string;
  description?: string | null;
  startDate?: Date | string;
  endDate?: Date | string | null;
  location?: string | null;
  notes?: string | null;
};

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function EventForm({
  initial,
  action,
  submitLabel,
}: {
  initial?: Initial;
  action: (prev: EventState, formData: FormData) => Promise<EventState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<EventState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          maxLength={200}
          placeholder="e.g. Spring Speaker Night"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInput(initial?.startDate)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={toDateInput(initial?.endDate)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={initial?.location ?? ""}
          maxLength={200}
          placeholder="e.g. Aula Magna, IE Tower"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Short description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
          className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Anything the team should know — running orders, reminders, contact details…"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href="/events">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
