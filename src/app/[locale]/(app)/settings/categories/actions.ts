"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export type CategoryState = { error?: string };

export async function createCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const user = await requireOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  try {
    const c = await prisma.itemCategory.create({ data: { name: parsed.data.name } });
    await writeAudit({
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
  const user = await requireOwner();
  const existing = await prisma.itemCategory.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.itemCategory.update({ where: { id }, data: { archivedAt: new Date() } });
  await writeAudit({
    actorId: user.id,
    entity: "ItemCategory",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/categories");
}
