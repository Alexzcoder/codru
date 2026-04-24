"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(200),
});

export type AcceptState = { error?: string };

export async function acceptInvite(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "password") return { error: "passwordTooShort" };
    return { error: "invalidInput" };
  }
  const { token, name, password } = parsed.data;

  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return { error: "invalidOrExpired" };
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return { error: "invalidOrExpired" };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: invite.email,
        passwordHash,
        name,
        role: "USER",
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return u;
  });

  await writeAudit({
    actorId: user.id,
    entity: "User",
    entityId: user.id,
    action: "create",
    after: { email: user.email, role: user.role } as unknown as Record<string, unknown>,
  });

  await signIn("credentials", {
    email: invite.email,
    password,
    redirect: false,
  });

  redirect("/dashboard");
}
