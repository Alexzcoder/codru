"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export function JobListFilters({
  initial,
  clients,
  users,
}: {
  initial: {
    q: string;
    status: (typeof STATUSES)[number];
    clientId: string;
    assigneeId: string;
    from: string;
    to: string;
  };
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const t = useTranslations("Jobs");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [, startTransition] = useTransition();

  const apply = (next = state) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status !== "ALL") params.set("status", next.status);
    if (next.clientId) params.set("clientId", next.clientId);
    if (next.assigneeId) params.set("assigneeId", next.assigneeId);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/jobs?${qs}` : "/jobs"));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        placeholder={t("searchPlaceholder")}
        value={state.q}
        onChange={(e) => setState({ ...state, q: e.target.value })}
        onBlur={() => apply()}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        className="max-w-sm"
      />
      <select
        value={state.status}
        onChange={(e) => {
          const next = { ...state, status: e.target.value as (typeof STATUSES)[number] };
          setState(next);
          apply(next);
        }}
        className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "ALL" ? t("filters.all") : t(`status.${s}`)}
          </option>
        ))}
      </select>
      <select
        value={state.clientId}
        onChange={(e) => {
          const next = { ...state, clientId: e.target.value };
          setState(next);
          apply(next);
        }}
        className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm max-w-48"
      >
        <option value="">{t("filters.client")}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={state.assigneeId}
        onChange={(e) => {
          const next = { ...state, assigneeId: e.target.value };
          setState(next);
          apply(next);
        }}
        className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
      >
        <option value="">{t("filters.assignee")}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 text-xs text-neutral-600">
        {t("filters.from")}
        <Input
          type="date"
          value={state.from}
          onChange={(e) => setState({ ...state, from: e.target.value })}
          onBlur={() => apply()}
          className="h-9 w-36"
        />
        {t("filters.to")}
        <Input
          type="date"
          value={state.to}
          onChange={(e) => setState({ ...state, to: e.target.value })}
          onBlur={() => apply()}
          className="h-9 w-36"
        />
      </div>
      {(state.q || state.status !== "ALL" || state.clientId || state.assigneeId || state.from || state.to) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const cleared = { q: "", status: "ALL" as const, clientId: "", assigneeId: "", from: "", to: "" };
            setState(cleared);
            apply(cleared);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
