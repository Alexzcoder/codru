"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(200),
});

export type ResetState = { error?: string };

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "passwordTooShort" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return { error: "invalidOrExpired" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // User-level action — audit row needs a workspace; fall back to first
  // membership and skip the audit if the user has none.
  const membership = await prisma.membership.findFirst({
    where: { userId: record.userId, workspace: { deletedAt: null } },
    orderBy: [{ joinedAt: "asc" }],
    select: { workspaceId: true },
  });
  if (membership) {
    await writeAudit({
      workspaceId: membership.workspaceId,
      actorId: record.userId,
      entity: "User",
      entityId: record.userId,
      action: "reset-password",
    });
  }

  redirect("/login");
}
