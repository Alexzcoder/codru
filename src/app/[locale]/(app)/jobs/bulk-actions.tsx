"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ClickableRow } from "@/components/clickable-row";
import { bulkSetJobStatus } from "./actions";
import type { JobStatus } from "@prisma/client";

type Row = {
  id: string;
  title: string;
  clientName: string;
  status: JobStatus;
  scheduledStart: string | null;
  assigneeColors: string[];
};

const STATUSES: JobStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function BulkActions({ jobs }: { jobs: Row[] }) {
  const t = useTranslations("Jobs");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === jobs.length) setSelected(new Set());
    else setSelected(new Set(jobs.map((j) => j.id)));
  };
  const applyStatus = (status: JobStatus) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkSetJobStatus(ids, status);
      setSelected(new Set());
    });
  };

  return (
    <div className="mt-6">
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-input bg-secondary px-3 py-2 text-sm">
          <span>{t("bulk.selected", { count: selected.size })}</span>
          <span className="ml-auto text-xs text-muted-foreground">{t("bulk.changeStatus")}:</span>
          {STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyStatus(s)}
            >
              {t(`status.${s}`)}
            </Button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === jobs.length && jobs.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Client</th>
              <th className="px-4 py-2 text-left">Start</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((j) => (
              <ClickableRow key={j.id} href={`/jobs/${j.id}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(j.id)}
                    onChange={() => toggle(j.id)}
                  />
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/jobs/${j.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {j.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{j.clientName}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {j.scheduledStart
                    ? j.scheduledStart.slice(0, 16).replace("T", " ")
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex -space-x-1">
                    {j.assigneeColors.map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full border-2 border-white"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={j.status} label={t(`status.${j.status}`)} />
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: JobStatus; label: string }) {
  const cls = {
    SCHEDULED: "bg-amber-100 text-amber-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-secondary text-secondary-foreground",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}
