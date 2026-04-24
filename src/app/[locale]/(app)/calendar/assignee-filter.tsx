"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import type { View } from "@/lib/calendar-dates";

export function AssigneeFilter({
  view,
  dateParam,
  assigneeId,
  users,
}: {
  view: View;
  dateParam: string;
  assigneeId: string | undefined;
  users: { id: string; name: string }[];
}) {
  const t = useTranslations("Calendar");
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <select
      className="ml-auto h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
      value={assigneeId ?? ""}
      onChange={(e) => {
        const qs = new URLSearchParams({
          view,
          date: dateParam,
          ...(e.target.value && { assignee: e.target.value }),
        }).toString();
        startTransition(() => router.push(`/calendar?${qs}`));
      }}
    >
      <option value="">{t("filter")}: all</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
