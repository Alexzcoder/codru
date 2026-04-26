"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { switchWorkspace } from "@/app/[locale]/(app)/workspace-actions";
import { Link } from "@/i18n/navigation";

export type WorkspaceOption = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
};

export function WorkspaceSwitcher({
  active,
  options,
}: {
  active: WorkspaceOption;
  options: WorkspaceOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const pick = (id: string) => {
    if (id === active.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchWorkspace(id);
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent ${pending ? "opacity-60" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[140px] truncate">{active.name}</span>
        <ChevronsUpDown size={12} className="opacity-60" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <ul role="listbox" className="divide-y divide-border">
              {options.map((o) => {
                const isActive = o.id === active.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => pick(o.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60 ${
                        isActive ? "bg-secondary/40" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {o.role === "OWNER" ? "Owner" : "Member"}
                      </span>
                      {isActive && <Check size={14} className="text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border bg-secondary/30">
              <Link
                href="/settings/workspaces"
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <Plus size={12} /> Manage / create workspace
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
