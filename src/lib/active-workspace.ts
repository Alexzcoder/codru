// M17 — active-workspace cookie helpers. The cookie holds the workspace the
// user is currently viewing; every server query reads this to scope rows.
//
// Cookie-based (not JWT) so:
//   - switching workspaces doesn't re-issue the session
//   - the JWT stays small + cacheable
//   - logout-and-login keeps the last picked workspace
//
// Validity is enforced server-side in getActiveWorkspace(): if the cookie
// points at a workspace the user no longer belongs to, we fall back to their
// first membership (alphabetical by workspace name).

"use server";

import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Workspace, Membership } from "@prisma/client";

const COOKIE = "cw_active_workspace";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type ActiveWorkspaceContext = {
  workspace: Workspace;
  role: "OWNER" | "MEMBER";
  membership: Membership;
};

/**
 * Resolve the active workspace for a given user. Reads the cookie, validates
 * membership, and falls back to the user's first membership if the cookie is
 * missing or invalid. Returns null only when the user has zero memberships
 * (caller should redirect to /onboarding/workspace).
 */
export async function getActiveWorkspace(
  userId: string,
): Promise<ActiveWorkspaceContext | null> {
  const jar = await cookies();
  const desiredId = jar.get(COOKIE)?.value;

  const memberships = await prisma.membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: [{ workspace: { name: "asc" } }],
  });
  if (memberships.length === 0) return null;

  const desired = desiredId
    ? memberships.find((m) => m.workspaceId === desiredId)
    : null;
  const picked = desired ?? memberships[0];
  return {
    workspace: picked.workspace,
    role: picked.role,
    membership: picked,
  };
}

export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearActiveWorkspace(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
