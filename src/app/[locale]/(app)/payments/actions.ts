"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { recomputeInvoiceStatus } from "@/lib/payment-status";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const allocationSchema = z.object({
  documentId: z.string().min(1),
  amount: z.string(),
});

const paymentSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().min(1),
  method: z.enum(["BANK_TRANSFER", "CASH", "OTHER"]),
  amount: z.string(),
  currency: z.enum(["CZK", "EUR", "USD"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  allocationsJson: z.string(),
});

export type PaymentState = { error?: string };

function parseAllocations(raw: string): z.infer<typeof allocationSchema>[] {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr)) throw new Error("Invalid allocations");
  // Filter out zero-amount rows up front — no point storing them.
  return z
    .array(allocationSchema)
    .parse(arr)
    .filter((a) => Number.parseFloat(a.amount) > 0);
}

export async function createPayment(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let allocations: z.infer<typeof allocationSchema>[];
  try {
    allocations = parseAllocations(d.allocationsJson);
  } catch {
    return { error: "invalidAllocations" };
  }

  const payment = await prisma.payment.create({
    data: {
      workspaceId: workspace.id,
      clientId: d.clientId,
      date: new Date(d.date),
      method: d.method,
      amount: d.amount,
      currency: d.currency,
      reference: d.reference || null,
      notes: d.notes || null,
      loggedById: user.id,
      allocations: {
        create: allocations.map((a) => ({
          documentId: a.documentId,
          amount: a.amount,
        })),
      },
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Payment",
    entityId: payment.id,
    action: "create",
    after: payment as unknown as Record<string, unknown>,
  });

  // Recompute each touched invoice's status.
  for (const a of allocations) {
    await recomputeInvoiceStatus(a.documentId);
  }

  const { createNotification } = await import("@/lib/notifications");
  const client = await prisma.client.findFirst({
    where: { id: d.clientId, workspaceId: workspace.id },
    select: { companyName: true, fullName: true, anonymizedAt: true, type: true },
  });
  const clientName = client?.anonymizedAt
    ? "[anonymized]"
    : client?.type === "COMPANY"
      ? client.companyName ?? "(unnamed)"
      : client?.fullName ?? "(unnamed)";
  await createNotification({
    trigger: "PAYMENT_RECEIVED",
    entityType: "Payment",
    entityId: payment.id,
    message: `Payment received: ${d.amount} ${d.currency} from ${clientName}`,
    href: `/payments/${payment.id}`,
    dedupKey: `PAYMENT_RECEIVED:${payment.id}`,
    scope: "all",
  });

  revalidatePath("/payments");
  revalidatePath("/advance-invoices");
  revalidatePath("/final-invoices");
  redirect(`/payments/${payment.id}`);
}

export async function updatePayment(
  id: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const { user, workspace } = await requireWorkspace();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let allocations: z.infer<typeof allocationSchema>[];
  try {
    allocations = parseAllocations(d.allocationsJson);
  } catch {
    return { error: "invalidAllocations" };
  }

  const before = await prisma.payment.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { allocations: true },
  });
  if (!before) return { error: "notFound" };

  const previouslyTouched = before.allocations.map((a) => a.documentId);

  await prisma.$transaction(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
    await tx.payment.update({
      where: { id },
      data: {
        clientId: d.clientId,
        date: new Date(d.date),
        method: d.method,
        amount: d.amount,
        currency: d.currency,
        reference: d.reference || null,
        notes: d.notes || null,
        allocations: {
          create: allocations.map((a) => ({
            documentId: a.documentId,
            amount: a.amount,
          })),
        },
      },
    });
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Payment",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
  });

  // Recompute every invoice that was touched before OR after.
  const touched = new Set([...previouslyTouched, ...allocations.map((a) => a.documentId)]);
  for (const docId of touched) {
    await recomputeInvoiceStatus(docId);
  }

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);
  revalidatePath("/advance-invoices");
  revalidatePath("/final-invoices");
  redirect(`/payments/${id}`);
}

export async function deletePayment(id: string) {
  const { user, workspace } = await requireWorkspace();
  const payment = await prisma.payment.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { allocations: true },
  });
  if (!payment) return;
  const touched = payment.allocations.map((a) => a.documentId);
  await prisma.payment.delete({ where: { id } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Payment",
    entityId: id,
    action: "delete",
    before: payment as unknown as Record<string, unknown>,
  });
  for (const docId of touched) {
    await recomputeInvoiceStatus(docId);
  }
  revalidatePath("/payments");
  revalidatePath("/advance-invoices");
  revalidatePath("/final-invoices");
  redirect("/payments");
}
