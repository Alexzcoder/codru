"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveImageUpload, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["QUOTE", "ADVANCE_INVOICE", "FINAL_INVOICE", "CREDIT_NOTE"]),
  companyProfileId: z.string().optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#059669"),
  showLogo: z.coerce.boolean().optional(),
  showSignature: z.coerce.boolean().optional(),
  showQrPlatba: z.coerce.boolean().optional(),
  showReverseChargeNote: z.coerce.boolean().optional(),
  customHeaderText: z.string().trim().max(500).optional().or(z.literal("")),
  customFooterText: z.string().trim().max(500).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
  removeLetterhead: z.coerce.boolean().optional(),
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

async function resolveLetterhead(
  formData: FormData,
  existing: string | null,
  removeFlag: boolean,
): Promise<string | null> {
  const file = formData.get("letterhead");
  if (file instanceof File && file.size > 0) {
    const saved = await saveImageUpload({ file, subdir: "letterheads" });
    if (existing) await deleteUpload(existing);
    return saved;
  }
  if (removeFlag && existing) {
    await deleteUpload(existing);
    return null;
  }
  return existing;
}

export async function createDocumentTemplate(
  _prev: DocumentTemplateState,
  formData: FormData,
): Promise<DocumentTemplateState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const letterheadImagePath = await resolveLetterhead(formData, null, false).catch(
    () => null,
  );

  const makeDefault = parsed.data.isDefault ?? false;
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.documentTemplate.updateMany({
        where: { type: parsed.data.type, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.documentTemplate.create({
      data: {
        ...toPayload(parsed.data),
        isDefault: makeDefault,
        letterheadImagePath,
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
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
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const before = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  const letterheadImagePath = await resolveLetterhead(
    formData,
    before.letterheadImagePath,
    parsed.data.removeLetterhead ?? false,
  ).catch(() => before.letterheadImagePath);

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
      data: {
        ...toPayload(parsed.data),
        isDefault: makeDefault,
        letterheadImagePath,
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
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
  const { user, workspace } = await requireWorkspaceOwner();
  await prisma.documentTemplate.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "DocumentTemplate",
    entityId: id,
    action: "delete",
  });
  revalidatePath("/settings/document-templates");
}
