"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { sanitizeUnitName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";

const schema = z.object({ name: z.string().min(1).max(50) });

export type UnitState = { error?: string };

export async function createUnit(
  _prev: UnitState,
  formData: FormData,
): Promise<UnitState> {
  const user = await requireOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  // Strip control chars / angle brackets / non-printable. Crashes downstream
  // (PDF, Excel, translation lookups) almost always trace back to one of
  // these slipping through.
  const name = sanitizeUnitName(parsed.data.name);
  if (name.length === 0) return { error: "invalidInput" };
  try {
    const u = await prisma.unit.create({ data: { name } });
    await writeAudit({
      actorId: user.id,
      entity: "Unit",
      entityId: u.id,
      action: "create",
      after: u as unknown as Record<string, unknown>,
    });
  } catch {
    return { error: "duplicate" };
  }
  revalidatePath("/settings/units");
  return {};
}

export async function archiveUnit(id: string) {
  const user = await requireOwner();
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.unit.update({ where: { id }, data: { archivedAt: new Date() } });
  await writeAudit({
    actorId: user.id,
    entity: "Unit",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/units");
}
