"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { transitionToSent } from "@/lib/documents";
import { calculateDocument } from "@/lib/line-items";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const lineSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().optional().or(z.literal("")),
  quantity: z.string(),
  unit: z.string().trim().min(1).max(50),
  unitPrice: z.string(),
  taxRatePercent: z.string(),
  taxMode: z.enum(["NET", "GROSS"]),
  lineDiscountPercent: z.string().optional(),
  lineDiscountAmount: z.string().optional(),
});

const advanceSchema = z.object({
  clientId: z.string().min(1),
  jobId: z.string().optional().or(z.literal("")),
  sourceQuoteId: z.string().optional().or(z.literal("")),
  companyProfileId: z.string().min(1),
  documentTemplateId: z.string().min(1),
  currency: z.enum(["CZK", "EUR", "USD"]),
  locale: z.enum(["cs", "en"]),
  issueDate: z.string().min(1),
  taxPointDate: z.string().optional(),
  dueDate: z.string().min(1),
  reverseCharge: z.coerce.boolean().optional(),
  advanceAmountMode: z.enum(["PERCENT", "FIXED"]).optional(),
  advanceAmountPercent: z.string().optional(),
  advanceAmountFixed: z.string().optional(),
  notesInternal: z.string().optional(),
  notesToClient: z.string().optional(),
  linesJson: z.string(),
});

export type AdvanceState = { error?: string };

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

export async function createAdvanceInvoice(
  _prev: AdvanceState,
  formData: FormData,
): Promise<AdvanceState> {
  const user = await requireUser();
  const parsed = advanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = parseLines(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }

  if (d.reverseCharge) {
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client?.ico) return { error: "reverseChargeRequiresIco" };
  }

  const created = await prisma.document.create({
    data: {
      type: "ADVANCE_INVOICE",
      status: "UNSENT",
      clientId: d.clientId,
      jobId: d.jobId || null,
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
      advanceAmountMode: d.advanceAmountMode ?? null,
      advanceAmountPercent: d.advanceAmountPercent || null,
      advanceAmountFixed: d.advanceAmountFixed || null,
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
    after: { type: "ADVANCE_INVOICE" } as unknown as Record<string, unknown>,
  });

  revalidatePath("/advance-invoices");
  redirect(`/advance-invoices/${created.id}`);
}

export async function updateAdvanceInvoice(
  id: string,
  _prev: AdvanceState,
  formData: FormData,
): Promise<AdvanceState> {
  const user = await requireUser();
  const parsed = advanceSchema.safeParse(Object.fromEntries(formData));
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
  if (d.reverseCharge) {
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client?.ico) return { error: "reverseChargeRequiresIco" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentLineItem.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        clientId: d.clientId,
        jobId: d.jobId || null,
        sourceQuoteId: d.sourceQuoteId || null,
        companyProfileId: d.companyProfileId,
        documentTemplateId: d.documentTemplateId,
        currency: d.currency,
        locale: d.locale,
        issueDate: new Date(d.issueDate),
        taxPointDate: d.taxPointDate ? new Date(d.taxPointDate) : new Date(d.issueDate),
        dueDate: new Date(d.dueDate),
        reverseCharge: d.reverseCharge ?? false,
        advanceAmountMode: d.advanceAmountMode ?? null,
        advanceAmountPercent: d.advanceAmountPercent || null,
        advanceAmountFixed: d.advanceAmountFixed || null,
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

  revalidatePath("/advance-invoices");
  revalidatePath(`/advance-invoices/${id}`);
  redirect(`/advance-invoices/${id}`);
}

export async function markAdvanceSent(id: string) {
  const user = await requireUser();
  await transitionToSent(user.id, id);
  revalidatePath("/advance-invoices");
  revalidatePath(`/advance-invoices/${id}`);
}

// Simplified for M9 — M12 will replace this with real payment allocation.
// PRD §11.2: when all linked Jobs reach Completed AND the advance is Paid,
// transition from PAID_PENDING_COMPLETION → PAID. We use PPC only when the
// linked job exists and isn't Completed at mark-paid time.
export async function markAdvancePaid(id: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { job: true },
  });
  if (!doc || doc.type !== "ADVANCE_INVOICE") return;
  if (doc.status !== "SENT" && doc.status !== "OVERDUE") return;

  const shouldWait = doc.job && doc.job.status !== "COMPLETED";
  await prisma.document.update({
    where: { id },
    data: {
      status: shouldWait ? "PAID_PENDING_COMPLETION" : "PAID",
      paidAt: new Date(),
    },
  });
  await writeAudit({
    actorId: user.id,
    entity: "Document",
    entityId: id,
    action: "update",
    after: {
      status: shouldWait ? "PAID_PENDING_COMPLETION" : "PAID",
    } as unknown as Record<string, unknown>,
  });
  revalidatePath("/advance-invoices");
  revalidatePath(`/advance-invoices/${id}`);
}

export async function deleteAdvanceDraft(id: string) {
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
  revalidatePath("/advance-invoices");
  redirect("/advance-invoices");
}

// Auto-overdue on detail page render
export async function autoOverdue(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADVANCE_INVOICE") return;
  if (doc.status !== "SENT") return;
  if (!doc.dueDate) return;
  if (doc.dueDate.getTime() >= Date.now()) return;
  await prisma.document.update({
    where: { id },
    data: { status: "OVERDUE" },
  });
}

// Compute the "Advance payment" default line from source quote + amount mode.
export async function computeAdvanceLine(params: {
  sourceQuoteId: string | null;
  amountMode: "PERCENT" | "FIXED" | null;
  amountPercent: string | null;
  amountFixed: string | null;
  currency: string;
  defaultName: string;
  taxRatePercent: string;
}): Promise<{ name: string; amount: string }> {
  let amount = "0.00";

  if (params.amountMode === "FIXED" && params.amountFixed) {
    amount = Number.parseFloat(params.amountFixed).toFixed(2);
  } else if (params.amountMode === "PERCENT" && params.sourceQuoteId && params.amountPercent) {
    const quote = await prisma.document.findUnique({
      where: { id: params.sourceQuoteId },
      include: { lineItems: true },
    });
    if (quote) {
      const totals = calculateDocument({
        lines: quote.lineItems.map((l) => ({
          quantity: l.quantity.toString(),
          unitPrice: l.unitPrice.toString(),
          taxRatePercent: l.taxRatePercent.toString(),
          taxMode: l.taxMode,
          lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
          lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
        })),
        documentDiscountPercent: quote.documentDiscountPercent?.toString() ?? null,
        documentDiscountAmount: quote.documentDiscountAmount?.toString() ?? null,
        reverseCharge: quote.reverseCharge,
      });
      amount = (
        (Number.parseFloat(totals.totalGross) * Number.parseFloat(params.amountPercent)) /
        100
      ).toFixed(2);
    }
  }

  return {
    name: `${params.defaultName} — ${amount} ${params.currency}`,
    amount,
  };
}
