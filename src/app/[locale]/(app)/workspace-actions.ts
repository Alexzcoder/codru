"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { setActiveWorkspace } from "@/lib/active-workspace";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sanitizeFreeName } from "@/lib/sanitize";
import { FEATURES, type FeatureKey } from "@/lib/features";

/**
 * Switch the active workspace. Server action wired to the WorkspaceSwitcher
 * dropdown. Validates membership before flipping the cookie — a user can't
 * point the cookie at a workspace they don't belong to.
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!membership) return;
  await setActiveWorkspace(workspaceId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "workspace";

export type CreateWorkspaceState = { error?: string; created?: boolean };

const createSchema = z.object({ name: z.string().min(1).max(80) });

/**
 * Create a new workspace and make the current user its OWNER. The cookie is
 * flipped to the new workspace so the caller lands inside it.
 */
export async function createWorkspace(
  _prev: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const name = sanitizeFreeName(parsed.data.name, 80);
  if (!name) return { error: "invalidInput" };

  // Resolve a unique slug — append -2, -3 … if the base is taken.
  const base = slugify(name);
  let slug = base;
  let attempt = 1;
  // 5 attempts is plenty in practice; if it overflows we'll let the unique
  // constraint surface the error.
  while (attempt < 6) {
    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (!existing) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  const ws = await prisma.workspace.create({
    data: {
      name,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await setActiveWorkspace(ws.id);
  revalidatePath("/", "layout");
  return { created: true };
}

export type UpdateFeaturesState = { error?: string; saved?: boolean };

/**
 * OWNER-only: replace a workspace's featureFlags object. Unknown keys are
 * silently dropped to keep the JSON tidy — only flags listed in FEATURES are
 * persisted.
 */
export async function updateWorkspaceFeatures(
  workspaceId: string,
  _prev: UpdateFeaturesState,
  formData: FormData,
): Promise<UpdateFeaturesState> {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return { error: "notOwner" };
  }

  const flags: Record<string, boolean> = {};
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    flags[key] = formData.get(`feature_${key}`) === "on";
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { featureFlags: flags },
  });
  await writeAudit({
    workspaceId,
    actorId: user.id,
    entity: "Workspace",
    entityId: workspaceId,
    action: "update",
    after: { featureFlags: flags } as unknown as Record<string, unknown>,
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

export type UpdateMemberScopesState = { error?: string; saved?: boolean };

/**
 * OWNER-only: set the scope whitelist for a single MEMBER of a workspace.
 * Empty array = "see everything the workspace has on" (default). Non-empty
 * array = restrict to those keys (custom roles like "Event Officer" who only
 * sees the events tab). OWNERs ignore scopes entirely so we forbid editing
 * an OWNER's row.
 */
export async function updateMemberScopes(
  workspaceId: string,
  memberUserId: string,
  _prev: UpdateMemberScopesState,
  formData: FormData,
): Promise<UpdateMemberScopesState> {
  const user = await requireUser();
  const ownerMembership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!ownerMembership || ownerMembership.role !== "OWNER") {
    return { error: "notOwner" };
  }

  const target = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
  });
  if (!target) return { error: "notFound" };
  if (target.role === "OWNER") return { error: "cannotRestrictOwner" };

  const scopes: FeatureKey[] = [];
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    if (formData.get(`scope_${key}`) === "on") scopes.push(key);
  }

  // If every feature is checked, treat it as "no restriction" (empty array)
  // so toggling them all back on returns to default behavior cleanly.
  const allChecked = scopes.length === Object.keys(FEATURES).length;
  const persist = allChecked ? [] : scopes;

  await prisma.membership.update({
    where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    data: { scopes: persist },
  });
  await writeAudit({
    workspaceId,
    actorId: user.id,
    entity: "Membership",
    entityId: target.id,
    action: "update",
    after: { scopes: persist } as unknown as Record<string, unknown>,
  });

  revalidatePath("/", "layout");
  return { saved: true };
}
