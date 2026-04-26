"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const schema = z.object({
  label: z.string().trim().min(1).max(100),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE"]),
});

export type CustomFieldState = { error?: string };

export async function createCustomField(
  _prev: CustomFieldState,
  formData: FormData,
): Promise<CustomFieldState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  try {
    const def = await prisma.customFieldDef.create({
      data: { ...parsed.data, workspaceId: workspace.id },
    });
    await writeAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      entity: "CustomFieldDef",
      entityId: def.id,
      action: "create",
      after: def as unknown as Record<string, unknown>,
    });
  } catch {
    return { error: "duplicate" };
  }
  revalidatePath("/settings/custom-fields");
  return {};
}

export async function archiveCustomField(id: string) {
  const { user, workspace } = await requireWorkspaceOwner();
  const existing = await prisma.customFieldDef.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return;
  await prisma.customFieldDef.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "CustomFieldDef",
    entityId: id,
    action: "delete",
  });
  revalidatePath("/settings/custom-fields");
}
