import Decimal from "decimal.js";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { recomputeInvoiceStatus, computeOutstanding } from "./payment-status";

// Fast path used by the "Mark paid" buttons on invoice detail pages.
// Creates a CASH payment for whatever's outstanding and allocates it to
// the invoice, then recomputes status. The full /payments/new form exists
// for real bank transfers, split allocations, multi-currency conversion, etc.
export async function quickMarkInvoicePaid(actorId: string, documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, workspaceId: true, clientId: true, currency: true, status: true, type: true },
  });
  if (!doc) return;
  if (doc.type !== "ADVANCE_INVOICE" && doc.type !== "FINAL_INVOICE") return;
  if (doc.status === "UNSENT" || doc.status === "PAID") return;

  const { outstanding } = await computeOutstanding(documentId);
  const amt = new Decimal(outstanding);
  if (amt.lte(0)) {
    // Already fully allocated — just recompute in case status drifted.
    await recomputeInvoiceStatus(documentId);
    return;
  }

  const payment = await prisma.payment.create({
    data: {
      workspaceId: doc.workspaceId,
      clientId: doc.clientId,
      date: new Date(),
      method: "CASH",
      amount: amt.toFixed(2),
      currency: doc.currency,
      notes: "Quick mark-paid shortcut",
      loggedById: actorId,
      allocations: {
        create: [{ documentId, amount: amt.toFixed(2) }],
      },
    },
  });

  await writeAudit({
    workspaceId: doc.workspaceId,
    actorId,
    entity: "Payment",
    entityId: payment.id,
    action: "create",
    after: { amount: amt.toFixed(2), documentId } as unknown as Record<string, unknown>,
  });

  await recomputeInvoiceStatus(documentId);
}
