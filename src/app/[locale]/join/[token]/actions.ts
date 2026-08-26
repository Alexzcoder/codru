"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { signIn, auth } from "@/auth";
import { setActiveWorkspace } from "@/lib/active-workspace";
import { redirect } from "next/navigation";

// Reusable join link — like a shared Notion page. Anyone with the link
// becomes a MEMBER of the linked workspace only; all data access stays
// scoped by that one Membership row, so other workspaces are untouchable.

async function findWorkspaceByToken(token: string) {
  if (!token) return null;
  return prisma.workspace.findFirst({
    where: { joinToken: token, deletedAt: null },
    select: { id: true, name: true },
  });
}

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
});

export type JoinState = { error?: string };

/** Signed-out path: create an account and join in one step. */
export async function joinViaLink(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "password") return { error: "passwordTooShort" };
    return { error: "invalidInput" };
  }
  const { token, name, email, password } = parsed.data;

  const workspace = await findWorkspaceByToken(token);
  if (!workspace) return { error: "invalidLink" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "accountExists" };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, passwordHash, name, role: "USER" },
    });
    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: u.id, role: "MEMBER" },
    });
    return u;
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "User",
    entityId: user.id,
    action: "create",
    after: { email, via: "joinLink" } as unknown as Record<string, unknown>,
  });

  await signIn("credentials", { email, password, redirect: false });
  await setActiveWorkspace(workspace.id);
  redirect("/dashboard");
}

/** Signed-in path: add a membership to the current account (no-op if member). */
export async function joinSignedIn(token: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deactivatedAt) redirect("/login");

  const workspace = await findWorkspaceByToken(token);
  if (!workspace) redirect("/dashboard");

  const existing = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
  });
  if (!existing) {
    const membership = await prisma.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "MEMBER" },
    });
    await writeAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      entity: "Membership",
      entityId: membership.id,
      action: "create",
      after: { via: "joinLink" } as unknown as Record<string, unknown>,
    });
  }
  await setActiveWorkspace(workspace.id);
  redirect("/dashboard");
}
