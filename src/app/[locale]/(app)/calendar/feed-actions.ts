"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";

function newToken(): string {
  return crypto.randomBytes(24).toString("hex"); // 48 hex chars
}

// Return the workspace's ICS feed token, creating one on first use.
export async function ensureCalendarFeedToken(): Promise<{ token: string }> {
  const { workspace } = await requireWorkspace();
  const existing = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    select: { icsToken: true },
  });
  if (existing?.icsToken) return { token: existing.icsToken };

  const token = newToken();
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { icsToken: token },
  });
  return { token };
}

// Rotate the token — old subscription URLs stop working immediately.
export async function rotateCalendarFeedToken(): Promise<{ token: string }> {
  const { workspace } = await requireWorkspace();
  const token = newToken();
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { icsToken: token },
  });
  return { token };
}
