"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addExistingMemberToWorkspace } from "../../../workspace-actions";

type Candidate = {
  id: string;
  name: string | null;
  email: string;
  // Other workspace this user is already in — purely for context display.
  fromWorkspaceName: string;
};

export function AddExistingMember({
  workspaceId,
  candidates,
}: {
  workspaceId: string;
  candidates: Candidate[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No teammates from your other workspaces yet. Invite by email instead.
      </p>
    );
  }

  function handleAdd(c: Candidate) {
    setBusyId(c.id);
    setMessage(null);
    startTransition(async () => {
      const res = await addExistingMemberToWorkspace(workspaceId, c.id);
      setBusyId(null);
      if (res.added) {
        setMessage({ kind: "ok", text: `Added ${res.added}.` });
      } else {
        setMessage({
          kind: "err",
          text:
            res.error === "alreadyMember"
              ? "Already a member here."
              : res.error === "notEligible"
                ? "User isn't in any workspace you own."
                : res.error === "notOwner"
                  ? "Owner-only action."
                  : "Could not add member.",
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name ?? c.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.email} · already in {c.fromWorkspaceName}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending && busyId === c.id}
              onClick={() => handleAdd(c)}
            >
              {pending && busyId === c.id ? "Adding…" : "Add"}
            </Button>
          </li>
        ))}
      </ul>
      {message && (
        <p
          className={`text-xs ${message.kind === "ok" ? "text-green-700" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Adds the user as MEMBER. They&apos;ll see this workspace next time they
        switch in the header.
      </p>
    </div>
  );
}
