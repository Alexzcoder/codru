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
  ico: z.string().trim().max(20).optional().or(z.literal("")),
  dic: z.string().trim().max(20).optional().or(z.literal("")),
  addressStreet: z.string().trim().max(200).optional().or(z.literal("")),
  addressCity: z.string().trim().max(100).optional().or(z.literal("")),
  addressZip: z.string().trim().max(20).optional().or(z.literal("")),
  addressCountry: z.string().trim().max(2).default("CZ"),
  iban: z.string().trim().max(40).optional().or(z.literal("")),
  swift: z.string().trim().max(20).optional().or(z.literal("")),
  accountNumber: z.string().trim().max(40).optional().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#059669"),
  defaultHeaderText: z.string().trim().max(500).optional().or(z.literal("")),
  defaultFooterText: z.string().trim().max(500).optional().or(z.literal("")),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365).default(14),
  defaultWarrantyText: z.string().trim().max(1000).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
});

export type CompanyProfileState = { error?: string; saved?: boolean };

function toPayload(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    ico: d.ico || null,
    dic: d.dic || null,
    addressStreet: d.addressStreet || null,
    addressCity: d.addressCity || null,
    addressZip: d.addressZip || null,
    addressCountry: d.addressCountry || "CZ",
    iban: d.iban || null,
    swift: d.swift || null,
    accountNumber: d.accountNumber || null,
    brandColor: d.brandColor,
    defaultHeaderText: d.defaultHeaderText || null,
    defaultFooterText: d.defaultFooterText || null,
    defaultPaymentTermsDays: d.defaultPaymentTermsDays,
    defaultWarrantyText: d.defaultWarrantyText || null,
  };
}

async function handleLogo(logo: File | null | undefined, previousPath?: string | null) {
  if (!logo || logo.size === 0) return undefined;
  const newPath = await saveImageUpload({ file: logo, subdir: "logos" });
  if (previousPath) await deleteUpload(previousPath);
  return newPath;
}

export async function createCompanyProfile(
  _prev: CompanyProfileState,
  formData: FormData,
): Promise<CompanyProfileState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const payload = toPayload(parsed.data);
  const logoPath = await handleLogo(formData.get("logo") as File | null);
  const makeDefault =
    parsed.data.isDefault ||
    (await prisma.companyProfile.count({ where: { workspaceId: workspace.id } })) === 0;

  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.companyProfile.updateMany({
        data: { isDefault: false },
        where: { workspaceId: workspace.id, isDefault: true },
      });
    }
    return tx.companyProfile.create({
      data: {
        ...payload,
        workspaceId: workspace.id,
        logoPath: logoPath ?? null,
        isDefault: makeDefault,
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "CompanyProfile",
    entityId: created.id,
    action: "create",
    after: created as unknown as Record<string, unknown>,
  });

  redirect("/settings/company-profiles");
}

export async function updateCompanyProfile(
  id: string,
  _prev: CompanyProfileState,
  formData: FormData,
): Promise<CompanyProfileState> {
  const { user, workspace } = await requireWorkspaceOwner();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const existing = await prisma.companyProfile.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return { error: "notFound" };

  const payload = toPayload(parsed.data);
  const logoPath = await handleLogo(formData.get("logo") as File | null, existing.logoPath);
  const shouldBeDefault = parsed.data.isDefault ?? existing.isDefault;

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault && !existing.isDefault) {
      await tx.companyProfile.updateMany({
        data: { isDefault: false },
        where: { workspaceId: workspace.id, isDefault: true, NOT: { id } },
      });
    }
    return tx.companyProfile.update({
      where: { id },
      data: {
        ...payload,
        ...(logoPath !== undefined && { logoPath }),
        isDefault: shouldBeDefault,
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "CompanyProfile",
    entityId: id,
    action: "update",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  revalidatePath("/settings/company-profiles");
  return { saved: true };
}

export async function archiveCompanyProfile(id: string) {
  const { user, workspace } = await requireWorkspaceOwner();
  const existing = await prisma.companyProfile.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return;

  await prisma.companyProfile.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "CompanyProfile",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });

  revalidatePath("/settings/company-profiles");
}
