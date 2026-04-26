"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type ForgotState = { done?: boolean; devInviteLink?: string };

const TTL_HOURS = 1;

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { done: true }; // enumeration-safe: always say "done"

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Enumeration protection: respond identically whether user exists or not.
  if (!user || user.deactivatedAt) return { done: true };

  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;
  const result = await sendPasswordResetEmail({ to: user.email, resetUrl });

  // User-level action — audit row needs a workspace; fall back to first
  // membership and skip the audit if the user has none.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspace: { deletedAt: null } },
    orderBy: [{ joinedAt: "asc" }],
    select: { workspaceId: true },
  });
  if (membership) {
    await writeAudit({
      workspaceId: membership.workspaceId,
      actorId: user.id,
      entity: "User",
      entityId: user.id,
      action: "reset-password",
    });
  }

  return result.sent ? { done: true } : { done: true, devInviteLink: result.fallbackLink };
}
