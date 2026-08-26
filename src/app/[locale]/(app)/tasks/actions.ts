"use server";

import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";

export async function createTeam(formData: FormData) {
  const { user, workspace } = await requireWorkspaceOwner();
  const name = sanitizeFreeName(String(formData.get("name") ?? ""), 60);
  if (!name) return;
  const team = await prisma.team.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name } },
    update: {},
    create: { workspaceId: workspace.id, name },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Team",
    entityId: team.id,
    action: "create",
    after: { name } as unknown as Record<string, unknown>,
  });
  revalidatePath("/tasks");
}

export async function deleteTeam(teamId: string) {
  const { user, workspace } = await requireWorkspaceOwner();
  const team = await prisma.team.findFirst({
    where: { id: teamId, workspaceId: workspace.id },
  });
  if (!team) return;
  await prisma.team.delete({ where: { id: teamId } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Team",
    entityId: teamId,
    action: "delete",
    before: { name: team.name } as unknown as Record<string, unknown>,
  });
  revalidatePath("/tasks");
}

export async function toggleTeamMember(teamId: string, userId: string) {
  const { workspace } = await requireWorkspaceOwner();
  const team = await prisma.team.findFirst({
    where: { id: teamId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!team) return;
  const member = await prisma.membership.findFirst({
    where: { workspaceId: workspace.id, userId },
    select: { id: true },
  });
  if (!member) return;
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing) {
    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
  } else {
    await prisma.teamMember.create({ data: { teamId, userId } });
  }
  revalidatePath("/tasks");
}
