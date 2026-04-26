"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";

const schema = z.object({ name: z.string().min(1).max(100) });

export type CategoryState = { error?: string };

export async function createCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const name = sanitizeFreeName(parsed.data.name, 100);
  if (name.length === 0) return { error: "invalidInput" };
  try {
    const c = await prisma.itemCategory.create({ data: { name, workspaceId: workspace.id } });
    await writeAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      entity: "ItemCategory",
      entityId: c.id,
      action: "create",
      after: c as unknown as Record<string, unknown>,
    });
  } catch {
    return { error: "duplicate" };
  }
  revalidatePath("/settings/categories");
  return {};
}

export async function archiveCategory(id: string) {
  const { user, workspace } = await requireWorkspaceOwner();
  const existing = await prisma.itemCategory.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return;
  await prisma.itemCategory.update({ where: { id }, data: { archivedAt: new Date() } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ItemCategory",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/categories");
}
