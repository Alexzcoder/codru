"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateMemberScopes,
  type UpdateMemberScopesState,
} from "../../../workspace-actions";
import type { FEATURES, FeatureKey } from "@/lib/features";

export function MemberScopes({
  workspaceId,
  member,
  definitions,
  initialScopes,
  workspaceFlags,
}: {
  workspaceId: string;
  member: { id: string; name: string | null; email: string };
  definitions: typeof FEATURES;
  initialScopes: FeatureKey[];
  workspaceFlags: Record<FeatureKey, boolean>;
}) {
  const action = updateMemberScopes.bind(null, workspaceId, member.id);
  const [state, formAction, pending] = useActionState<
    UpdateMemberScopesState,
    FormData
  >(action, {});

  // Empty array = see everything (default). Pre-check every feature so the UI
  // shows the effective state; the action treats "all on" as "empty array".
  const everythingOn = initialScopes.length === 0;

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.name ?? member.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
        <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {everythingOn ? "Full access" : "Restricted"}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {(Object.keys(definitions) as FeatureKey[]).map((k) => {
          const wsOn = workspaceFlags[k];
          const checked = everythingOn ? wsOn : initialScopes.includes(k);
          return (
            <li key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`scope_${k}`}
                id={`${member.id}-scope-${k}`}
                defaultChecked={checked}
                disabled={!wsOn}
                className="h-4 w-4"
              />
              <label
                htmlFor={`${member.id}-scope-${k}`}
                className={wsOn ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground line-through"}
                title={wsOn ? undefined : "Workspace has this feature off"}
              >
                {definitions[k].label}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save scopes"}
        </Button>
        {state.saved && <span className="text-xs text-green-700">Saved.</span>}
        {state.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tick everything for full access. Tick a subset to limit what this
        member sees in the sidebar (e.g. Event Officers see only Events).
      </p>
    </form>
  );
}
