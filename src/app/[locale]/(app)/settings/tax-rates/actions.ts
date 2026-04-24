"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const createSchema = z.object({
  label: z.string().trim().min(1).max(50),
  percent: z.coerce.number().min(0).max(100),
  isDefault: z.coerce.boolean().optional(),
});

export type TaxRateState = { error?: string };

export async function createTaxRate(
  _prev: TaxRateState,
  formData: FormData,
): Promise<TaxRateState> {
  const user = await requireOwner();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const makeDefault = parsed.data.isDefault ?? false;
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.taxRate.updateMany({
          data: { isDefault: false },
          where: { isDefault: true },
        });
      }
      return tx.taxRate.create({
        data: {
          label: parsed.data.label,
          percent: parsed.data.percent,
          isDefault: makeDefault,
        },
      });
    });
    await writeAudit({
      actorId: user.id,
      entity: "TaxRate",
      entityId: created.id,
      action: "create",
      after: created as unknown as Record<string, unknown>,
    });
  } catch {
    return { error: "duplicate" };
  }

  revalidatePath("/settings/tax-rates");
  return {};
}

export async function archiveTaxRate(id: string) {
  const user = await requireOwner();
  const existing = await prisma.taxRate.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.taxRate.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });

  await writeAudit({
    actorId: user.id,
    entity: "TaxRate",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });

  revalidatePath("/settings/tax-rates");
}

export async function setDefaultTaxRate(id: string) {
  await requireOwner();
  await prisma.$transaction([
    prisma.taxRate.updateMany({ data: { isDefault: false }, where: { isDefault: true } }),
    prisma.taxRate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/settings/tax-rates");
}
