"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { hasFeature } from "@/lib/features";
import { sanitizeFreeName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";

const episodeSchema = z.object({
  title: z.string().min(1).max(200),
  guestName: z.string().max(200).optional(),
  recordingDate: z.string().optional(),
  publishDate: z.string().optional(),
  audioUrl: z.string().max(500).optional(),
  showNotes: z.string().optional(),
  campus: z.enum(["MADRID", "SEGOVIA", "BOTH"]).optional(),
});

export type EpisodeState = { error?: string };

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createEpisode(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();

  const parsed = episodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const title = sanitizeFreeName(d.title, 200);
  if (!title) return { error: "invalidInput" };

  const ep = await prisma.podcastEpisode.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      title,
      guestName: d.guestName?.trim() || null,
      recordingDate: parseDateOrNull(d.recordingDate),
      publishDate: parseDateOrNull(d.publishDate),
      audioUrl: d.audioUrl?.trim() || null,
      showNotes: d.showNotes?.trim() || null,
      campus: d.campus ?? "BOTH",
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "PodcastEpisode",
    entityId: ep.id,
    action: "create",
    after: { title } as unknown as Record<string, unknown>,
  });

  revalidatePath("/podcast");
  redirect(`/podcast/${ep.id}`);
}

export async function updateEpisode(
  id: string,
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();

  const parsed = episodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const title = sanitizeFreeName(d.title, 200);
  if (!title) return { error: "invalidInput" };

  const before = await prisma.podcastEpisode.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!before) return { error: "notFound" };

  await prisma.podcastEpisode.update({
    where: { id },
    data: {
      title,
      guestName: d.guestName?.trim() || null,
      recordingDate: parseDateOrNull(d.recordingDate),
      publishDate: parseDateOrNull(d.publishDate),
      audioUrl: d.audioUrl?.trim() || null,
      showNotes: d.showNotes?.trim() || null,
      campus: d.campus ?? before.campus,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "PodcastEpisode",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath("/podcast");
  revalidatePath(`/podcast/${id}`);
  redirect(`/podcast/${id}`);
}

export async function deleteEpisode(id: string) {
  const { user, workspace } = await requireWorkspace();
  if (!hasFeature(workspace, "podcast")) notFound();
  const ep = await prisma.podcastEpisode.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!ep) return;
  await prisma.podcastEpisode.delete({ where: { id } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "PodcastEpisode",
    entityId: id,
    action: "delete",
    before: ep as unknown as Record<string, unknown>,
  });
  revalidatePath("/podcast");
  redirect("/podcast");
}
