"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveJobAttachment, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MAX_FILES_PER_JOB = 50;

const jobSchema = z.object({
  title: z.string().trim().min(1).max(300),
  clientId: z.string().min(1),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  siteStreet: z.string().trim().max(200).optional().or(z.literal("")),
  siteCity: z.string().trim().max(100).optional().or(z.literal("")),
  siteZip: z.string().trim().max(20).optional().or(z.literal("")),
  siteCountry: z.string().trim().max(2).optional().or(z.literal("")),
  scheduledStart: z.string().optional().or(z.literal("")),
  scheduledEnd: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  assignees: z.string().optional(), // comma-separated user ids
});

export type JobState = { error?: string };

function toPayload(d: z.infer<typeof jobSchema>) {
  return {
    title: d.title,
    clientId: d.clientId,
    status: d.status,
    siteStreet: d.siteStreet || null,
    siteCity: d.siteCity || null,
    siteZip: d.siteZip || null,
    siteCountry: d.siteCountry || null,
    scheduledStart: d.scheduledStart ? new Date(d.scheduledStart) : null,
    scheduledEnd: d.scheduledEnd ? new Date(d.scheduledEnd) : null,
    notes: d.notes || null,
  };
}

function parseAssignees(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function syncAssignees(jobId: string, userIds: string[]) {
  await prisma.$transaction([
    prisma.jobAssignment.deleteMany({
      where: { jobId, NOT: { userId: { in: userIds } } },
    }),
    ...userIds.map((userId) =>
      prisma.jobAssignment.upsert({
        where: { jobId_userId: { jobId, userId } },
        create: { jobId, userId },
        update: {},
      }),
    ),
  ]);
}

export async function createJob(
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const job = await prisma.job.create({ data: { ...toPayload(parsed.data), workspaceId: workspace.id } });
  const assignees = parseAssignees(parsed.data.assignees);
  if (assignees.length) await syncAssignees(job.id, assignees);

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Job",
    entityId: job.id,
    action: "create",
    after: job as unknown as Record<string, unknown>,
  });

  revalidatePath("/jobs");
  revalidatePath(`/clients/${job.clientId}`);
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(
  id: string,
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const existing = await prisma.job.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return { error: "notFound" };

  const updated = await prisma.job.update({
    where: { id },
    data: toPayload(parsed.data),
  });
  await syncAssignees(id, parseAssignees(parsed.data.assignees));

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Job",
    entityId: id,
    action: "update",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/clients/${updated.clientId}`);
  redirect(`/jobs/${id}`);
}

export async function setJobStatus(id: string, status: string) {
  const { user, workspace } = await requireWorkspace();
  const allowed = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) return;
  const before = await prisma.job.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!before) return;
  const after = await prisma.job.update({
    where: { id },
    data: { status: status as (typeof allowed)[number] },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Job",
    entityId: id,
    action: "update",
    before: { status: before.status } as unknown as Record<string, unknown>,
    after: { status: after.status } as unknown as Record<string, unknown>,
  });

  // PRD §11.2: when a job reaches COMPLETED, flip any linked PPC advance
  // invoices to PAID.
  if (after.status === "COMPLETED" && before.status !== "COMPLETED") {
    await flipPpcAdvancesToPaid(id);
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/advance-invoices");
}

async function flipPpcAdvancesToPaid(jobId: string) {
  const ppc = await prisma.document.findMany({
    where: {
      jobId,
      type: "ADVANCE_INVOICE",
      status: "PAID_PENDING_COMPLETION",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (ppc.length === 0) return;
  await prisma.document.updateMany({
    where: { id: { in: ppc.map((p) => p.id) } },
    data: { status: "PAID", completedAt: new Date() },
  });
}

export async function bulkSetJobStatus(ids: string[], status: string) {
  const { user, workspace } = await requireWorkspace();
  const allowed = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number]) || ids.length === 0) return;
  await prisma.job.updateMany({
    where: { id: { in: ids }, workspaceId: workspace.id },
    data: { status: status as (typeof allowed)[number] },
  });
  for (const id of ids) {
    await writeAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      entity: "Job",
      entityId: id,
      action: "update",
      after: { status } as unknown as Record<string, unknown>,
    });
  }
  if (status === "COMPLETED") {
    for (const id of ids) await flipPpcAdvancesToPaid(id);
  }
  revalidatePath("/jobs");
  revalidatePath("/advance-invoices");
}

export async function deleteJob(id: string) {
  const { user, workspace } = await requireWorkspace();
  const existing = await prisma.job.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return;
  // Attachments cascade; also delete files on disk.
  const attachments = await prisma.attachment.findMany({ where: { jobId: id } });
  await prisma.job.delete({ where: { id } });
  for (const a of attachments) await deleteUpload(a.path);
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Job",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/jobs");
  revalidatePath(`/clients/${existing.clientId}`);
  redirect("/jobs");
}

export type AttachmentState = {
  error?: string;
  uploadedCount?: number;
};

export async function uploadAttachment(
  jobId: string,
  _prev: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const { user, workspace } = await requireWorkspace();
  // The form input has `multiple`, so getAll picks up every selected file.
  // Stays compatible with single-file submits.
  const rawFiles = formData.getAll("file");
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  if (files.length === 0) return { error: "noFile" };

  // Verify job belongs to active workspace
  const job = await prisma.job.findFirst({ where: { id: jobId, workspaceId: workspace.id }, select: { id: true } });
  if (!job) return { error: "notFound" };

  const existing = await prisma.attachment.count({ where: { jobId, workspaceId: workspace.id } });
  if (existing + files.length > MAX_FILES_PER_JOB) {
    const remaining = Math.max(0, MAX_FILES_PER_JOB - existing);
    return {
      error:
        remaining === 0
          ? "tooManyFiles"
          : `Only ${remaining} more file${remaining === 1 ? "" : "s"} fits — picked ${files.length}.`,
    };
  }

  let uploaded = 0;
  const failures: string[] = [];
  for (const file of files) {
    try {
      const saved = await saveJobAttachment({ file, jobId });
      const att = await prisma.attachment.create({
        data: {
          workspaceId: workspace.id,
          jobId,
          filename: saved.filename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          kind: saved.kind,
          path: saved.path,
          caption,
          uploadedById: user.id,
        },
      });
      await writeAudit({
        workspaceId: workspace.id,
        actorId: user.id,
        entity: "Attachment",
        entityId: att.id,
        action: "create",
        after: { jobId, filename: att.filename } as unknown as Record<string, unknown>,
      });
      uploaded++;
    } catch (e) {
      failures.push(
        `${file.name}: ${e instanceof Error ? e.message : "uploadFailed"}`,
      );
    }
  }

  revalidatePath(`/jobs/${jobId}`);

  if (uploaded === 0) {
    return { error: failures[0] ?? "uploadFailed" };
  }
  if (failures.length > 0) {
    return {
      uploadedCount: uploaded,
      error: `${failures.length} file(s) failed: ${failures.slice(0, 3).join("; ")}`,
    };
  }
  return { uploadedCount: uploaded };
}

export async function createDemoJob() {
  const { generateDemoJob, generateDemoClient } = await import("@/lib/demo-data");
  const { user, workspace } = await requireWorkspace();

  // Pick a random existing non-deleted client, or create one if the DB is empty.
  let client = await prisma.client.findFirst({
    where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!client) {
    client = await prisma.client.create({ data: { ...generateDemoClient(), workspaceId: workspace.id } });
  }

  const job = await prisma.job.create({ data: { ...generateDemoJob(client.id), workspaceId: workspace.id } });

  // Assign the current user so the job has a team member badge.
  await prisma.jobAssignment.create({
    data: { jobId: job.id, userId: user.id },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Job",
    entityId: job.id,
    action: "create",
    after: job as unknown as Record<string, unknown>,
  });

  revalidatePath("/jobs");
  revalidatePath(`/clients/${client.id}`);
}

export async function deleteAttachment(id: string) {
  const { user, workspace } = await requireWorkspace();
  const att = await prisma.attachment.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!att) return;
  await prisma.attachment.delete({ where: { id } });
  await deleteUpload(att.path);
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Attachment",
    entityId: id,
    action: "delete",
    before: att as unknown as Record<string, unknown>,
  });
  revalidatePath(`/jobs/${att.jobId}`);
}
