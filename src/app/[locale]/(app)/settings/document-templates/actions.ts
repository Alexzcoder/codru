"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["QUOTE", "ADVANCE_INVOICE", "FINAL_INVOICE", "CREDIT_NOTE"]),
  companyProfileId: z.string().optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1d4ed8"),
  showLogo: z.coerce.boolean().optional(),
  showSignature: z.coerce.boolean().optional(),
  showQrPlatba: z.coerce.boolean().optional(),
  showReverseChargeNote: z.coerce.boolean().optional(),
  customHeaderText: z.string().trim().max(500).optional().or(z.literal("")),
  customFooterText: z.string().trim().max(500).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
});

export type DocumentTemplateState = { error?: string };

function toPayload(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    type: d.type,
    companyProfileId: d.companyProfileId || null,
    accentColor: d.accentColor,
    showLogo: d.showLogo ?? false,
    showSignature: d.showSignature ?? false,
    showQrPlatba: d.showQrPlatba ?? false,
    showReverseChargeNote: d.showReverseChargeNote ?? false,
    customHeaderText: d.customHeaderText || null,
    customFooterText: d.customFooterText || null,
  };
}

export async function createDocumentTemplate(
  _prev: DocumentTemplateState,
  formData: FormData,
): Promise<DocumentTemplateState> {
  const user = await requireOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const makeDefault = parsed.data.isDefault ?? false;
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.documentTemplate.updateMany({
        where: { type: parsed.data.type, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.documentTemplate.create({
      data: { ...toPayload(parsed.data), isDefault: makeDefault },
    });
  });

  await writeAudit({
    actorId: user.id,
    entity: "DocumentTemplate",
    entityId: created.id,
    action: "create",
    after: created as unknown as Record<string, unknown>,
  });

  redirect("/settings/document-templates");
}

export async function updateDocumentTemplate(
  id: string,
  _prev: DocumentTemplateState,
  formData: FormData,
): Promise<DocumentTemplateState> {
  const user = await requireOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const before = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  const makeDefault = parsed.data.isDefault ?? false;
  const after = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.documentTemplate.updateMany({
        where: {
          type: parsed.data.type,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }
    return tx.documentTemplate.update({
      where: { id },
      data: { ...toPayload(parsed.data), isDefault: makeDefault },
    });
  });

  await writeAudit({
    actorId: user.id,
    entity: "DocumentTemplate",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  revalidatePath("/settings/document-templates");
  redirect("/settings/document-templates");
}

export async function archiveDocumentTemplate(id: string) {
  const user = await requireOwner();
  await prisma.documentTemplate.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });
  await writeAudit({
    actorId: user.id,
    entity: "DocumentTemplate",
    entityId: id,
    action: "delete",
  });
  revalidatePath("/settings/document-templates");
}
