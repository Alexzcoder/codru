"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveImageUpload, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  calendarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  locale: z.enum(["cs", "en"]),
  notifyOverdue: z.coerce.boolean().optional(),
  notifyPayment: z.coerce.boolean().optional(),
  notifyInquiry: z.coerce.boolean().optional(),
});

export type ProfileState = { error?: string; saved?: boolean };

// Profile is global (per-User). The audit row needs a workspaceId; fall back
// to the user's first membership. Skip the audit row if the user has none.
async function firstWorkspaceId(userId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: [{ joinedAt: "asc" }],
    select: { workspaceId: true },
  });
  return m?.workspaceId ?? null;
}

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const d = parsed.data;
  let signaturePath: string | undefined;
  const sig = formData.get("signature") as File | null;
  if (sig && sig.size > 0) {
    signaturePath = await saveImageUpload({ file: sig, subdir: "signatures" });
    if (user.signatureImagePath) await deleteUpload(user.signatureImagePath);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      calendarColor: d.calendarColor,
      locale: d.locale,
      notificationPrefs: {
        overdue: !!d.notifyOverdue,
        payment: !!d.notifyPayment,
        inquiry: !!d.notifyInquiry,
      },
      ...(signaturePath && { signatureImagePath: signaturePath }),
    },
  });

  const workspaceId = await firstWorkspaceId(user.id);
  if (workspaceId) {
    await writeAudit({
      workspaceId,
      actorId: user.id,
      entity: "User",
      entityId: user.id,
      action: "update",
      before: user as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });
  }

  revalidatePath("/settings/profile");
  return { saved: true };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10),
});

export type PasswordState = { error?: string; saved?: boolean };

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "passwordTooShort" };

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: "wrongCurrent" };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  const workspaceId = await firstWorkspaceId(user.id);
  if (workspaceId) {
    await writeAudit({
      workspaceId,
      actorId: user.id,
      entity: "User",
      entityId: user.id,
      action: "reset-password",
    });
  }

  return { saved: true };
}
