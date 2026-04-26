import { auth } from "@/auth";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import type { User, Workspace, WorkspaceRole } from "@prisma/client";
import { getActiveWorkspace } from "./active-workspace";

// DEV_BYPASS: skip session check and use the first owner in the DB.
// Re-enable auth by removing this env var or setting it to "false".
const DEV_BYPASS = process.env.DEV_BYPASS === "true";

async function getDevUser(): Promise<User> {
  const user = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (!user) throw new Error("No owner in DB — register first at /register");
  return user;
}

export async function requireUser(): Promise<User> {
  if (DEV_BYPASS) return getDevUser();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.deactivatedAt) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<User> {
  if (DEV_BYPASS) return getDevUser();
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/dashboard");
  return user;
}

export type WorkspaceContext = {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
};

/**
 * Auth + active-workspace resolution. Use from every page/action that touches
 * workspace-scoped data. Redirects to /onboarding/workspace if the user has
 * no memberships yet.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await requireUser();
  const ctx = await getActiveWorkspace(user.id);
  if (!ctx) redirect("/onboarding/workspace");
  return { user, workspace: ctx.workspace, role: ctx.role };
}

/** OWNER-only actions on the active workspace (invite, remove, delete). */
export async function requireWorkspaceOwner(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ctx.role !== "OWNER") redirect("/dashboard");
  return ctx;
}
