"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { revalidatePath } from "next/cache";

const schema = z.object({
  companyProfileId: z.string().min(1),
  fromAddress: z.string().trim().email(),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
});

export type EmailIdentityState = { error?: string };

export async function createEmailIdentity(
  _prev: EmailIdentityState,
  formData: FormData,
): Promise<EmailIdentityState> {
  const { workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const makeDefault = d.isDefault ?? false;

  // Verify CompanyProfile belongs to active workspace.
  const profile = await prisma.companyProfile.findFirst({
    where: { id: d.companyProfileId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!profile) return { error: "notFound" };

  await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.emailIdentity.updateMany({
        where: { companyProfileId: d.companyProfileId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.emailIdentity.create({
      data: {
        companyProfileId: d.companyProfileId,
        fromAddress: d.fromAddress.toLowerCase(),
        displayName: d.displayName || null,
        isDefault: makeDefault,
      },
    });
  });

  revalidatePath("/settings/email-senders");
  return {};
}

export async function setDefaultEmailIdentity(id: string) {
  const { workspace } = await requireWorkspaceOwner();
  const identity = await prisma.emailIdentity.findFirst({
    where: { id, companyProfile: { workspaceId: workspace.id } },
  });
  if (!identity) return;
  await prisma.$transaction([
    prisma.emailIdentity.updateMany({
      where: { companyProfileId: identity.companyProfileId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.emailIdentity.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/settings/email-senders");
}

export async function archiveEmailIdentity(id: string) {
  const { workspace } = await requireWorkspaceOwner();
  const identity = await prisma.emailIdentity.findFirst({
    where: { id, companyProfile: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!identity) return;
  await prisma.emailIdentity.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });
  revalidatePath("/settings/email-senders");
}
