"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { EpisodeState } from "./actions";

type Initial = {
  title?: string;
  guestName?: string | null;
  recordingDate?: Date | string | null;
  publishDate?: Date | string | null;
  audioUrl?: string | null;
  showNotes?: string | null;
  campus?: "MADRID" | "SEGOVIA" | "BOTH" | null;
};

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function EpisodeForm({
  initial,
  action,
  submitLabel,
}: {
  initial?: Initial;
  action: (prev: EpisodeState, formData: FormData) => Promise<EpisodeState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<EpisodeState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">Episode title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          maxLength={200}
          placeholder="e.g. The Power of Storytelling — Ep. 4"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guestName">Guest</Label>
          <Input
            id="guestName"
            name="guestName"
            defaultValue={initial?.guestName ?? ""}
            maxLength={200}
            placeholder="e.g. Dr. Marta Ruiz"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campus">Campus</Label>
          <select
            id="campus"
            name="campus"
            defaultValue={initial?.campus ?? "BOTH"}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="BOTH">Both campuses</option>
            <option value="MADRID">Madrid</option>
            <option value="SEGOVIA">Segovia</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recordingDate">Recording date</Label>
          <Input
            id="recordingDate"
            name="recordingDate"
            type="date"
            defaultValue={toDateInput(initial?.recordingDate)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="publishDate">Publish date</Label>
          <Input
            id="publishDate"
            name="publishDate"
            type="date"
            defaultValue={toDateInput(initial?.publishDate)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="audioUrl">Audio URL</Label>
        <Input
          id="audioUrl"
          name="audioUrl"
          type="url"
          defaultValue={initial?.audioUrl ?? ""}
          maxLength={500}
          placeholder="https://example.com/episode.mp3"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="showNotes">Show notes</Label>
        <textarea
          id="showNotes"
          name="showNotes"
          defaultValue={initial?.showNotes ?? ""}
          className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Topics, timestamps, links mentioned…"
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
        <Link href="/podcast">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
