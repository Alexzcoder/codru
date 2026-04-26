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

const creditSchema = z.object({
  originalDocumentId: z.string().min(1),
  creditReason: z.string().trim().min(1).max(2000),
  companyProfileId: z.string().min(1),
  documentTemplateId: z.string().min(1),
  currency: z.enum(["CZK", "EUR", "USD"]),
  locale: z.enum(["cs", "en"]),
  issueDate: z.string().min(1),
  taxPointDate: z.string().optional(),
  reverseCharge: z.coerce.boolean().optional(),
  title: z.string().trim().max(200).optional(),
  notesInternal: z.string().optional(),
  notesToClient: z.string().optional(),
  linesJson: z.string(),
});

export type CreditNoteState = { error?: string };

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

export async function createCreditNote(
  _prev: CreditNoteState,
  formData: FormData,
): Promise<CreditNoteState> {
  const user = await requireUser();
  const parsed = creditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }

  const original = await prisma.document.findUnique({
    where: { id: d.originalDocumentId },
  });
  if (!original) return { error: "originalNotFound" };
  if (
    original.type !== "ADVANCE_INVOICE" &&
    original.type !== "FINAL_INVOICE"
  ) {
    return { error: "originalMustBeInvoice" };
  }
  if (original.status === "UNSENT") {
    // PRD §13 — credit note corrects a SENT invoice. Drafts should just be edited.
    return { error: "originalNotSent" };
  }

  const created = await prisma.document.create({
    data: {
      type: "CREDIT_NOTE",
      status: "UNSENT",
      clientId: original.clientId,
      jobId: original.jobId,
      originalDocumentId: original.id,
      creditReason: d.creditReason,
      companyProfileId: d.companyProfileId,
      documentTemplateId: d.documentTemplateId,
      createdById: user.id,
      currency: d.currency,
      locale: d.locale,
      issueDate: new Date(d.issueDate),
      taxPointDate: d.taxPointDate ? new Date(d.taxPointDate) : new Date(d.issueDate),
      reverseCharge: d.reverseCharge ?? false,
      title: d.title || null,
      notesInternal: d.notesInternal || null,
      notesToClient: d.notesToClient || null,
      lineItems: { create: buildLinePayload(lines) },
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: created.id,
    action: "create",
    after: {
      type: "CREDIT_NOTE",
      originalDocumentId: original.id,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/final-invoices/${original.id}`);
  revalidatePath(`/advance-invoices/${original.id}`);
  redirect(`/credit-notes/${created.id}`);
}

export async function updateCreditNote(
  id: string,
  _prev: CreditNoteState,
  formData: FormData,
): Promise<CreditNoteState> {
  const user = await requireUser();
  const parsed = creditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }

  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  await prisma.$transaction(async (tx) => {
    await tx.documentLineItem.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        creditReason: d.creditReason,
        companyProfileId: d.companyProfileId,
        documentTemplateId: d.documentTemplateId,
        currency: d.currency,
        locale: d.locale,
        issueDate: new Date(d.issueDate),
        taxPointDate: d.taxPointDate ? new Date(d.taxPointDate) : new Date(d.issueDate),
        reverseCharge: d.reverseCharge ?? false,
        notesInternal: d.notesInternal || null,
        notesToClient: d.notesToClient || null,
        lineItems: { create: buildLinePayload(lines) },
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

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  if (before.originalDocumentId) {
    revalidatePath(`/final-invoices/${before.originalDocumentId}`);
    revalidatePath(`/advance-invoices/${before.originalDocumentId}`);
  }
  redirect(`/credit-notes/${id}`);
}

export async function markCreditNoteSent(id: string) {
  const user = await requireUser();
  await transitionToSent(user.id, id);
  const doc = await prisma.document.findUnique({ where: { id } });
  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  if (doc?.originalDocumentId) {
    revalidatePath(`/final-invoices/${doc.originalDocumentId}`);
    revalidatePath(`/advance-invoices/${doc.originalDocumentId}`);
  }
}

export async function deleteCreditNoteDraft(id: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return;
  // PRD §13.3: "Cannot be deleted once sent; a second credit note corrects
  // a mistaken one." So delete only while UNSENT.
  if (doc.status !== "UNSENT") return;
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "delete",
    before: doc as unknown as Record<string, unknown>,
  });
  revalidatePath("/credit-notes");
  redirect("/credit-notes");
}
