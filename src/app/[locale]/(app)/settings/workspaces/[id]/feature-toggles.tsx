"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateWorkspaceFeatures, type UpdateFeaturesState } from "../../../workspace-actions";
import type { FEATURES, FeatureKey } from "@/lib/features";

export function FeatureToggles({
  workspaceId,
  definitions,
  initial,
}: {
  workspaceId: string;
  definitions: typeof FEATURES;
  initial: Record<FeatureKey, boolean>;
}) {
  const action = updateWorkspaceFeatures.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<
    UpdateFeaturesState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {(Object.keys(definitions) as FeatureKey[]).map((k) => (
          <li
            key={k}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-medium">{definitions[k].label}</span>
            <label className="cursor-pointer">
              <input
                type="checkbox"
                name={`feature_${k}`}
                defaultChecked={initial[k]}
                className="h-4 w-4"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.saved && (
          <span className="text-xs text-green-700">Saved.</span>
        )}
        {state.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
