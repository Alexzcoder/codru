"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { generateToken } from "@/lib/tokens";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const INVITE_TTL_HOURS = 48;
const RESET_TTL_HOURS = 1;

export type InviteState = {
  error?: string;
  sent?: boolean;
  devInviteLink?: string;
};

export async function inviteUser(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { user: owner, workspace } = await requireWorkspaceOwner();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const { email } = parsed.data;

  // If the user already exists and is already a member of this workspace, refuse.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: existingUser.id } },
    });
    if (membership) return { error: "alreadyMember" };
  }

  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      workspaceId: workspace.id,
      email,
      tokenHash: hash,
      role: "MEMBER",
      createdById: owner.id,
      expiresAt,
    },
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const result = await sendInviteEmail({
    to: email,
    inviteUrl,
    inviterName: owner.name,
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: owner.id,
    entity: "Invite",
    entityId: invite.id,
    action: "invite",
    after: { email, expiresAt } as unknown as Record<string, unknown>,
  });

  revalidatePath("/settings/users");

  return result.sent ? { sent: true } : { sent: true, devInviteLink: result.fallbackLink };
}

export async function deactivateUser(id: string) {
  const { user: owner, workspace } = await requireWorkspaceOwner();
  if (owner.id === id) return; // cannot deactivate self
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.user.update({
    where: { id },
    data: { deactivatedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: owner.id,
    entity: "User",
    entityId: id,
    action: "deactivate",
    before: { deactivatedAt: existing.deactivatedAt } as unknown as Record<string, unknown>,
  });
  revalidatePath("/settings/users");
}

export async function reactivateUser(id: string) {
  const { user: owner, workspace } = await requireWorkspaceOwner();
  await prisma.user.update({
    where: { id },
    data: { deactivatedAt: null },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: owner.id,
    entity: "User",
    entityId: id,
    action: "reactivate",
  });
  revalidatePath("/settings/users");
}

export async function triggerPasswordResetFor(userId: string) {
  const { user: owner, workspace } = await requireWorkspaceOwner();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { devInviteLink: null };

  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;
  const result = await sendPasswordResetEmail({ to: user.email, resetUrl });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: owner.id,
    entity: "User",
    entityId: user.id,
    action: "reset-password",
  });

  return { devInviteLink: result.sent ? null : result.fallbackLink };
}
