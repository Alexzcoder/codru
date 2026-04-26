"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { transitionToSent } from "@/lib/documents";
import { sanitizeUnitName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const decimal = (precision: number, scale: number) =>
  z.string().regex(new RegExp(`^-?\\d{1,${precision - scale}}(\\.\\d{1,${scale}})?$`));

const lineSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().optional().or(z.literal("")),
  quantity: decimal(12, 3),
  unit: z.string().trim().min(1).max(50).transform((s) => sanitizeUnitName(s)),
  unitPrice: decimal(12, 2),
  taxRatePercent: decimal(5, 2),
  taxMode: z.enum(["NET", "GROSS"]),
  lineDiscountPercent: z.string().optional(),
  lineDiscountAmount: z.string().optional(),
});

const quoteSchema = z.object({
  clientId: z.string().min(1),
  jobId: z.string().optional().or(z.literal("")),
  companyProfileId: z.string().min(1),
  documentTemplateId: z.string().min(1),
  currency: z.enum(["CZK", "EUR", "USD"]),
  locale: z.enum(["cs", "en"]),
  issueDate: z.string().min(1),
  validUntilDate: z.string().min(1),
  reverseCharge: z.coerce.boolean().optional(),
  documentDiscountPercent: z.string().optional(),
  documentDiscountAmount: z.string().optional(),
  title: z.string().trim().max(200).optional(),
  notesInternal: z.string().optional(),
  notesToClient: z.string().optional(),
  linesJson: z.string(),
});

export type QuoteState = { error?: string };

function buildLinePayload(lines: z.infer<typeof lineSchema>[]) {
  return lines.map((l, idx) => ({
    position: idx + 1,
    name: l.name,
    description: l.description || null,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    taxRatePercent: l.taxRatePercent,
    taxMode: l.taxMode,
    lineDiscountPercent: l.lineDiscountPercent && l.lineDiscountPercent !== "" ? l.lineDiscountPercent : null,
    lineDiscountAmount: l.lineDiscountAmount && l.lineDiscountAmount !== "" ? l.lineDiscountAmount : null,
  }));
}

function parseLines(raw: string): z.infer<typeof lineSchema>[] {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr)) throw new Error("Invalid lines");
  const parsed = z.array(lineSchema).min(1).parse(arr);
  return parsed;
}

export async function createQuote(
  _prev: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }

  // Only allow reverse charge for B2B clients (have IČO).
  if (d.reverseCharge) {
    const client = await prisma.client.findFirst({ where: { id: d.clientId, workspaceId: workspace.id } });
    if (!client || !client.ico) return { error: "reverseChargeRequiresIco" };
  }

  const created = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      type: "QUOTE",
      status: "UNSENT",
      clientId: d.clientId,
      jobId: d.jobId || null,
      companyProfileId: d.companyProfileId,
      documentTemplateId: d.documentTemplateId,
      createdById: user.id,
      currency: d.currency,
      locale: d.locale,
      issueDate: new Date(d.issueDate),
      validUntilDate: new Date(d.validUntilDate),
      reverseCharge: d.reverseCharge ?? false,
      documentDiscountPercent: d.documentDiscountPercent || null,
      documentDiscountAmount: d.documentDiscountAmount || null,
      title: d.title || null,
      notesInternal: d.notesInternal || null,
      notesToClient: d.notesToClient || null,
      lineItems: { create: buildLinePayload(lines) },
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: created.id,
    action: "create",
    after: { type: "QUOTE", clientId: d.clientId } as unknown as Record<string, unknown>,
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${created.id}`);
}

export async function updateQuote(
  id: string,
  _prev: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }

  const before = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!before) return { error: "notFound" };
  if (d.reverseCharge) {
    const client = await prisma.client.findFirst({ where: { id: d.clientId, workspaceId: workspace.id } });
    if (!client || !client.ico) return { error: "reverseChargeRequiresIco" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentLineItem.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        clientId: d.clientId,
        jobId: d.jobId || null,
        companyProfileId: d.companyProfileId,
        documentTemplateId: d.documentTemplateId,
        currency: d.currency,
        locale: d.locale,
        issueDate: new Date(d.issueDate),
        validUntilDate: new Date(d.validUntilDate),
        reverseCharge: d.reverseCharge ?? false,
        documentDiscountPercent: d.documentDiscountPercent || null,
        documentDiscountAmount: d.documentDiscountAmount || null,
        title: d.title || null,
        notesInternal: d.notesInternal || null,
        notesToClient: d.notesToClient || null,
        lineItems: { create: buildLinePayload(lines) },
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function markQuoteSent(id: string) {
  const { user, workspace } = await requireWorkspace();
  // Verify ownership before transitioning.
  const doc = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id }, select: { id: true } });
  if (!doc) return;
  await transitionToSent(user.id, id);
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function markQuoteAccepted(id: string) {
  const { user, workspace } = await requireWorkspace();
  const doc = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!doc || doc.type !== "QUOTE") return;
  if (doc.status !== "SENT" && doc.status !== "EXPIRED") return;
  await prisma.document.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    after: { status: "ACCEPTED" } as unknown as Record<string, unknown>,
  });
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function markQuoteRejected(id: string) {
  const { user, workspace } = await requireWorkspace();
  const doc = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!doc || doc.type !== "QUOTE") return;
  await prisma.document.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    after: { status: "REJECTED" } as unknown as Record<string, unknown>,
  });
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function cancelQuote(id: string) {
  const { user, workspace } = await requireWorkspace();
  const doc = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!doc || doc.type !== "QUOTE") return;
  if (doc.status === "UNSENT" || doc.status === "CANCELLED") return;
  await prisma.document.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    after: { status: "CANCELLED" } as unknown as Record<string, unknown>,
  });
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function deleteQuoteDraft(id: string) {
  const { user, workspace } = await requireWorkspace();
  const doc = await prisma.document.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!doc) return;
  if (doc.status !== "UNSENT") return; // PRD §21.3 — once Sent, cannot be deleted
  await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "delete",
    before: doc as unknown as Record<string, unknown>,
  });
  revalidatePath("/quotes");
  redirect("/quotes");
}

// Auto-expire when validUntilDate has passed — called lazily by the detail page.
export async function autoExpireQuote(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "QUOTE" || doc.status !== "SENT") return;
  if (!doc.validUntilDate) return;
  if (doc.validUntilDate.getTime() >= Date.now()) return;
  await prisma.document.update({
    where: { id },
    data: { status: "EXPIRED", expiredAt: new Date() },
  });
}
