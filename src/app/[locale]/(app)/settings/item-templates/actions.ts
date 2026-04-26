"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const decimalString = (precision: number, scale: number) =>
  z.string().regex(new RegExp(`^-?\\d{1,${precision - scale}}(\\.\\d{1,${scale}})?$`), {
    message: "invalid-decimal",
  });

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  unitId: z.string().min(1),
  defaultQuantity: decimalString(12, 3),
  defaultMarkupPercent: z.string().optional().or(z.literal("")),
  defaultUnitPrice: decimalString(12, 2),
  defaultTaxRateId: z.string().min(1),
  defaultTaxMode: z.enum(["NET", "GROSS"]),
});

export type ItemTemplateState = { error?: string };

function optDecimal(v: string | undefined): string | null {
  if (!v) return null;
  return v;
}

function toPayload(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    description: d.description || null,
    categoryId: d.categoryId || null,
    unitId: d.unitId,
    defaultQuantity: d.defaultQuantity,
    defaultMarkupPercent: optDecimal(d.defaultMarkupPercent),
    defaultUnitPrice: d.defaultUnitPrice,
    defaultTaxRateId: d.defaultTaxRateId,
    defaultTaxMode: d.defaultTaxMode,
  };
}

export async function createItemTemplate(
  _prev: ItemTemplateState,
  formData: FormData,
): Promise<ItemTemplateState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const tmpl = await prisma.itemTemplate.create({ data: toPayload(parsed.data) });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ItemTemplate",
    entityId: tmpl.id,
    action: "create",
    after: tmpl as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/item-templates");
  redirect("/settings/item-templates");
}

export async function updateItemTemplate(
  id: string,
  _prev: ItemTemplateState,
  formData: FormData,
): Promise<ItemTemplateState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const before = await prisma.itemTemplate.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  const after = await prisma.itemTemplate.update({
    where: { id },
    data: toPayload(parsed.data),
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ItemTemplate",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/item-templates");
  redirect("/settings/item-templates");
}

export async function archiveItemTemplate(id: string) {
  const { user, workspace } = await requireWorkspaceOwner();
  const existing = await prisma.itemTemplate.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.itemTemplate.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "ItemTemplate",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/item-templates");
}
