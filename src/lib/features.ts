// Per-workspace feature flags. Drives sidebar visibility + page-level guards.
// Add a new feature: include it in FEATURES, render the toggle on the
// workspace-settings page, gate the sidebar entry and the page itself.
//
// Storage: Workspace.featureFlags is a free-form JSON object — we deliberately
// don't enum it so adding features doesn't need a schema migration. Extra keys
// the code doesn't know about are ignored.

import type { Workspace } from "@prisma/client";

export const FEATURES = {
  events: { label: "Events" },
  scheduler: { label: "Scheduler" },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function hasFeature(
  workspace: Pick<Workspace, "featureFlags"> | null | undefined,
  key: FeatureKey,
): boolean {
  if (!workspace) return false;
  const flags = workspace.featureFlags as Record<string, unknown> | null;
  if (!flags || typeof flags !== "object") return false;
  return flags[key] === true;
}

export function readFeatureFlags(
  workspace: Pick<Workspace, "featureFlags">,
): Record<FeatureKey, boolean> {
  const flags = (workspace.featureFlags ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    (Object.keys(FEATURES) as FeatureKey[]).map((k) => [k, flags[k] === true]),
  ) as Record<FeatureKey, boolean>;
}
