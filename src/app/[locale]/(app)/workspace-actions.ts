"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { setActiveWorkspace } from "@/lib/active-workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sanitizeFreeName } from "@/lib/sanitize";

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
