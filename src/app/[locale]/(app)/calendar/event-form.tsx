"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { CalendarEventState } from "./actions";

type Initial = Partial<CalendarEvent>;

export function EventForm({
  initial,
  users,
  clients,
  jobs,
  action,
}: {
  initial?: Initial;
  users: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  jobs: { id: string; title: string }[];
  action: (prev: CalendarEventState, formData: FormData) => Promise<CalendarEventState>;
}) {
  const t = useTranslations("Calendar");
  const tSet = useTranslations("Settings");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [state, formAction, pending] = useActionState<CalendarEventState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">{t("form.title")}</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type">{t("form.type")}</Label>
          <select
            id="type"
            name="type"
            defaultValue={initial?.type ?? "MEETING"}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            {(["MEETING", "SITE_VISIT", "REMINDER", "OTHER"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`type.${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigneeId">{t("form.assignee")}</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={initial?.assigneeId ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="">{t("form.none")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        {t("form.allDay")}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startsAt">{t("form.startsAt")}</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={toInput(initial?.startsAt, allDay)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">{t("form.endsAt")}</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={toInput(initial?.endsAt, allDay)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="clientId">{t("form.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={initial?.clientId ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="">{t("form.none")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">{t("form.job")}</Label>
          <select
            id="jobId"
            name="jobId"
            defaultValue={initial?.jobId ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="">{t("form.none")}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-24 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tSet("save")}
        </Button>
        <Link href="/calendar">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

function toInput(d: Date | null | undefined, allDay: boolean): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  if (allDay) return ymd;
  return `${ymd}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
