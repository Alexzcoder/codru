"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

const STATUSES = ["ALL", "POTENTIAL", "ACTIVE", "PAST", "FAILED"] as const;

export function ClientListFilters({
  initialQ,
  initialStatus,
}: {
  initialQ: string;
  initialStatus: (typeof STATUSES)[number];
}) {
  const t = useTranslations("Clients");
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(initialStatus);
  const [, startTransition] = useTransition();

  const update = (nextQ: string, nextStatus: (typeof STATUSES)[number]) => {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/clients?${qs}` : "/clients"));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder={t("searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => update(q, status)}
        onKeyDown={(e) => e.key === "Enter" && update(q, status)}
        className="max-w-sm"
      />
      <select
        value={status}
        onChange={(e) => {
          const v = e.target.value as (typeof STATUSES)[number];
          setStatus(v);
          update(q, v);
        }}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "ALL" ? t("filterAll") : t(`status.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
