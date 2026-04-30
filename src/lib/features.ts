// Per-workspace feature flags + per-member scope. Drives sidebar visibility
// and page-level guards.
//
// Two layers:
//   1. workspace.featureFlags — toggles whole sections on/off for the
//      workspace. Standard CRM sections default to ON; club extras default
//      to OFF. Disable a standard one (e.g. for the IE Public Speaking
//      demo) by setting its key to false.
//   2. membership.scopes — optional per-member restriction. Empty array =
//      member sees every section that's on for the workspace. Non-empty =
//      member sees only those keys (custom roles like "Event Officer").
//      OWNERs ignore this — they always see everything that's on.
//
// Add a new feature: list it in FEATURES, render the toggle on the workspace
// settings page, gate the sidebar entry and the page itself with hasFeature.

import type { Workspace, Membership } from "@prisma/client";

export const FEATURES = {
  // Standard CRM tabs — default ON. Set false on a workspace to hide them.
  clients:   { label: "Clients",   defaultOn: true,  group: "standard" },
  jobs:      { label: "Jobs",      defaultOn: true,  group: "standard" },
  calendar:  { label: "Calendar",  defaultOn: true,  group: "standard" },
  documents: { label: "Documents", defaultOn: true,  group: "standard" },
  money:     { label: "Money",     defaultOn: true,  group: "standard" },
  recurring: { label: "Recurring", defaultOn: true,  group: "standard" },
  // Club / demo extras — default OFF. Workspaces opt in.
  events:    { label: "Events",    defaultOn: false, group: "club" },
  scheduler: { label: "Scheduler", defaultOn: false, group: "club" },
  podcast:   { label: "Podcast",   defaultOn: false, group: "club" },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isWorkspaceFeatureOn(
  workspace: Pick<Workspace, "featureFlags"> | null | undefined,
  key: FeatureKey,
): boolean {
  const def = FEATURES[key]?.defaultOn ?? false;
  if (!workspace) return def;
  const flags = workspace.featureFlags as Record<string, unknown> | null;
  if (!flags || typeof flags !== "object") return def;
  const v = flags[key];
  if (typeof v === "boolean") return v;
  return def;
}

function readScopes(membership: Pick<Membership, "scopes"> | null | undefined): string[] | null {
  if (!membership) return null;
  const raw = membership.scopes as unknown;
  if (!Array.isArray(raw)) return null;
  const arr = raw.filter((x): x is string => typeof x === "string");
  return arr.length === 0 ? null : arr;
}

/**
 * Visible to *this user* in *this workspace*?
 *  workspace flag ON AND (OWNER OR scopes empty OR scopes includes key)
 */
export function hasFeature(
  workspace: Pick<Workspace, "featureFlags"> | null | undefined,
  key: FeatureKey,
  membership?: Pick<Membership, "role" | "scopes"> | null,
): boolean {
  if (!isWorkspaceFeatureOn(workspace, key)) return false;
  if (!membership) return true;
  if (membership.role === "OWNER") return true;
  const scopes = readScopes(membership);
  if (scopes === null) return true;
  return scopes.includes(key);
}

export function readFeatureFlags(
  workspace: Pick<Workspace, "featureFlags">,
): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    (Object.keys(FEATURES) as FeatureKey[]).map((k) => [
      k,
      isWorkspaceFeatureOn(workspace, k),
    ]),
  ) as Record<FeatureKey, boolean>;
}

export function readMemberScopes(
  membership: Pick<Membership, "scopes">,
): FeatureKey[] {
  const scopes = readScopes(membership);
  if (scopes === null) return [];
  return scopes.filter((s): s is FeatureKey => s in FEATURES);
}
