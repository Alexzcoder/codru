"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Job } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { JobState } from "./actions";

type Initial = Partial<Job> & { assigneeIds?: string[] };

export function JobForm({
  initial,
  clients,
  users,
  action,
}: {
  initial?: Initial;
  clients: { id: string; name: string }[];
  users: { id: string; name: string; calendarColor: string }[];
  action: (prev: JobState, formData: FormData) => Promise<JobState>;
}) {
  const t = useTranslations("Jobs");
  const tSet = useTranslations("Settings");
  const [assignees, setAssignees] = useState<Set<string>>(
    new Set(initial?.assigneeIds ?? []),
  );
  const [state, formAction, pending] = useActionState<JobState, FormData>(action, {});

  const toggle = (id: string) => {
    const next = new Set(assignees);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAssignees(next);
  };

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <input type="hidden" name="assignees" value={Array.from(assignees).join(",")} />

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
          <Label htmlFor="clientId">{t("form.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={initial?.clientId ?? ""}
            required
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="" disabled>
              —
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">{t("form.status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "SCHEDULED"}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            {(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="scheduledStart">{t("form.start")}</Label>
          <Input
            id="scheduledStart"
            name="scheduledStart"
            type="datetime-local"
            defaultValue={toInput(initial?.scheduledStart)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledEnd">{t("form.end")}</Label>
          <Input
            id="scheduledEnd"
            name="scheduledEnd"
            type="datetime-local"
            defaultValue={toInput(initial?.scheduledEnd)}
          />
        </div>
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm text-neutral-500">
          {t("form.sitePrefix")}
        </legend>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="siteStreet">{t("form.street")}</Label>
            <Input
              id="siteStreet"
              name="siteStreet"
              defaultValue={initial?.siteStreet ?? ""}
            />
          </div>
          <div className="grid grid-cols-[1fr_140px_100px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="siteCity">{t("form.city")}</Label>
              <Input id="siteCity" name="siteCity" defaultValue={initial?.siteCity ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteZip">{t("form.zip")}</Label>
              <Input id="siteZip" name="siteZip" defaultValue={initial?.siteZip ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteCountry">{t("form.country")}</Label>
              <Input id="siteCountry" name="siteCountry" defaultValue={initial?.siteCountry ?? ""} />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label>{t("form.assignees")}</Label>
        <div className="flex flex-wrap gap-2">
          {users.map((u) => {
            const active = assignees.has(u.id);
            return (
              <label
                key={u.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={active}
                  onChange={() => toggle(u.id)}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: u.calendarColor }}
                />
                {u.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-28 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
        <Link href="/jobs">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

function toInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
