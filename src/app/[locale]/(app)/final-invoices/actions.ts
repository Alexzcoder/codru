"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { transitionToSent } from "@/lib/documents";
import { sanitizeUnitName } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const lineSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().optional().or(z.literal("")),
  quantity: z.string(),
  unit: z.string().trim().min(1).max(50).transform((s) => sanitizeUnitName(s)),
  unitPrice: z.string(),
  taxRatePercent: z.string(),
  taxMode: z.enum(["NET", "GROSS"]),
  lineDiscountPercent: z.string().optional(),
  lineDiscountAmount: z.string().optional(),
});

const finalSchema = z.object({
  clientId: z.string().min(1),
  jobId: z.string().min(1), // PRD §12.1 — required
  sourceQuoteId: z.string().optional().or(z.literal("")),
  companyProfileId: z.string().min(1),
  documentTemplateId: z.string().min(1),
  currency: z.enum(["CZK", "EUR", "USD"]),
  locale: z.enum(["cs", "en"]),
  issueDate: z.string().min(1),
  taxPointDate: z.string().optional(),
  dueDate: z.string().min(1),
  reverseCharge: z.coerce.boolean().optional(),
  documentDiscountPercent: z.string().optional(),
  documentDiscountAmount: z.string().optional(),
  title: z.string().trim().max(200).optional(),
  notesInternal: z.string().optional(),
  notesToClient: z.string().optional(),
  linesJson: z.string(),
  // CSV of deducted advance IDs (rendered as hidden lines in linesJson already;
  // but we track the raw list too so we can flip their status on markPaid).
  deductedAdvanceIds: z.string().optional(),
});

export type FinalInvoiceState = { error?: string };

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
    lineDiscountPercent: l.lineDiscountPercent || null,
    lineDiscountAmount: l.lineDiscountAmount || null,
  }));
}

function parseLines(raw: string) {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr)) throw new Error("Invalid lines");
  return z.array(lineSchema).min(1).parse(arr);
}

function parseAdvanceIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// Store the list of deducted advance IDs on notesInternal? No — misuse. Instead
// we persist them in a JSON sidecar stored in the document's notesInternal …
// but cleaner: add a dedicated column later. For M10 I keep it in a small JSON
// blob inside notesInternal? No. I'll store them on the document via a
// prefixed key in notesInternal… scratch that. Simplest: create a tiny
// DocumentMeta JSON field? Too much churn. I'll put the CSV in a dedicated
// field via `notesInternal` metadata header. Actually simplest: just re-infer
// from negative lines on the document whenever we need it. That works because
// a negative line always belongs to an advance-deduction pattern we can parse.
//
// Decision: on markPaid, we look at the document's linked advances by scanning
// the document notesInternal? No. Let's store deducted IDs in a dedicated
// field: use the existing sourceQuoteId for the primary source quote, and
// rely on the Document.notesInternal to carry the CSV of deducted IDs
// prefixed with "[deducted:IDs]". Hacky. I'll add a proper field instead —
// migrations are cheap. But I haven't done that — let me add a small table.
//
// Simpler: reuse the "deductions" concept with a dedicated join table.
// Actually I'm going to use a compact JSON column already reserved for this
// type of metadata — but none exists. Adding a new column via the existing
// notesInternal is wrong. I'll update the schema.
//
// To keep this focused: use Document.creditReason (unused for final invoices)
// as a free-form text? No, that's also wrong semantically.
//
// Final plan: add a proper many-to-many table AdvanceDeduction. This is the
// correct schema. Let me do it now in the same commit.
//
// → Migration happens outside this file. For now, functions read/write the
// join table prisma.advanceDeduction.

export async function createFinalInvoice(
  _prev: FinalInvoiceState,
  formData: FormData,
): Promise<FinalInvoiceState> {
  const user = await requireUser();
  const parsed = finalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }
  const advanceIds = parseAdvanceIds(d.deductedAdvanceIds);

  if (d.reverseCharge) {
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client?.ico) return { error: "reverseChargeRequiresIco" };
  }

  const created = await prisma.document.create({
    data: {
      type: "FINAL_INVOICE",
      status: "UNSENT",
      clientId: d.clientId,
      jobId: d.jobId,
      sourceQuoteId: d.sourceQuoteId || null,
      companyProfileId: d.companyProfileId,
      documentTemplateId: d.documentTemplateId,
      createdById: user.id,
      currency: d.currency,
      locale: d.locale,
      issueDate: new Date(d.issueDate),
      taxPointDate: d.taxPointDate ? new Date(d.taxPointDate) : new Date(d.issueDate),
      dueDate: new Date(d.dueDate),
      reverseCharge: d.reverseCharge ?? false,
      documentDiscountPercent: d.documentDiscountPercent || null,
      documentDiscountAmount: d.documentDiscountAmount || null,
      title: d.title || null,
      notesInternal: d.notesInternal || null,
      notesToClient: d.notesToClient || null,
      lineItems: { create: buildLinePayload(lines) },
      advanceDeductions: advanceIds.length
        ? { create: advanceIds.map((advanceId) => ({ advanceId })) }
        : undefined,
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: created.id,
    action: "create",
    after: { type: "FINAL_INVOICE" } as unknown as Record<string, unknown>,
  });

  revalidatePath("/final-invoices");
  redirect(`/final-invoices/${created.id}`);
}

export async function updateFinalInvoice(
  id: string,
  _prev: FinalInvoiceState,
  formData: FormData,
): Promise<FinalInvoiceState> {
  const user = await requireUser();
  const parsed = finalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }
  const advanceIds = parseAdvanceIds(d.deductedAdvanceIds);

  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };
  if (d.reverseCharge) {
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client?.ico) return { error: "reverseChargeRequiresIco" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentLineItem.deleteMany({ where: { documentId: id } });
    await tx.advanceDeduction.deleteMany({ where: { finalInvoiceId: id } });
    await tx.document.update({
      where: { id },
      data: {
        clientId: d.clientId,
        jobId: d.jobId,
        sourceQuoteId: d.sourceQuoteId || null,
        companyProfileId: d.companyProfileId,
        documentTemplateId: d.documentTemplateId,
        currency: d.currency,
        locale: d.locale,
        issueDate: new Date(d.issueDate),
        taxPointDate: d.taxPointDate ? new Date(d.taxPointDate) : new Date(d.issueDate),
        dueDate: new Date(d.dueDate),
        reverseCharge: d.reverseCharge ?? false,
        documentDiscountPercent: d.documentDiscountPercent || null,
        documentDiscountAmount: d.documentDiscountAmount || null,
        notesInternal: d.notesInternal || null,
        notesToClient: d.notesToClient || null,
        lineItems: { create: buildLinePayload(lines) },
        advanceDeductions: advanceIds.length
          ? { create: advanceIds.map((advanceId) => ({ advanceId })) }
          : undefined,
      },
    });
  });

  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath("/final-invoices");
  revalidatePath(`/final-invoices/${id}`);
  redirect(`/final-invoices/${id}`);
}

export async function markFinalSent(id: string) {
  const user = await requireUser();
  await transitionToSent(user.id, id);
  revalidatePath("/final-invoices");
  revalidatePath(`/final-invoices/${id}`);
}

// Mark-paid shortcut: creates a CASH payment for the outstanding amount,
// allocates to this invoice, then flips deducted advances to PAID as well.
// Full "Log payment" flow with split allocation lives at /payments/new.
export async function markFinalPaid(id: string) {
  const user = await requireUser();
  const { quickMarkInvoicePaid } = await import("@/lib/quick-pay");
  await quickMarkInvoicePaid(user.id, id);

  // Preserve M10 §12.2 cascade: deducted advances also flip to PAID.
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { advanceDeductions: true },
  });
  const advanceIds = doc?.advanceDeductions.map((d) => d.advanceId) ?? [];
  if (advanceIds.length) {
    await prisma.document.updateMany({
      where: {
        id: { in: advanceIds },
        status: { in: ["SENT", "PAID_PENDING_COMPLETION", "OVERDUE", "PARTIALLY_PAID"] },
      },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  revalidatePath("/final-invoices");
  revalidatePath(`/final-invoices/${id}`);
  revalidatePath("/advance-invoices");
}

export async function cancelFinal(id: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { paymentAllocations: true },
  });
  if (!doc || doc.type !== "FINAL_INVOICE") return;
  if (doc.status === "UNSENT" || doc.status === "CANCELLED") return;
  if (doc.paymentAllocations.length > 0) {
    throw new Error("Cannot cancel a paid invoice — issue a credit note instead.");
  }
  await prisma.document.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    after: { status: "CANCELLED" } as unknown as Record<string, unknown>,
  });
  revalidatePath("/final-invoices");
  revalidatePath(`/final-invoices/${id}`);
}

export async function deleteFinalDraft(id: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return;
  if (doc.status !== "UNSENT") return;
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "delete",
    before: doc as unknown as Record<string, unknown>,
  });
  revalidatePath("/final-invoices");
  redirect("/final-invoices");
}

export async function autoOverdueFinal(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "FINAL_INVOICE") return;
  if (doc.status !== "SENT") return;
  if (!doc.dueDate) return;
  if (doc.dueDate.getTime() >= Date.now()) return;
  await prisma.document.update({ where: { id }, data: { status: "OVERDUE" } });
}
