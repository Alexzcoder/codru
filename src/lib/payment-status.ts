import Decimal from "decimal.js";
import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";

// Recompute an invoice's status from the sum of its PaymentAllocations.
// Only applies to ADVANCE_INVOICE / FINAL_INVOICE (quotes don't have payments;
// credit notes flow differently). Called after any payment create/update/delete.
// PRD §14.3:
//   0 allocated → Unpaid (or Overdue if past due)
//   Partial → Partially paid
//   Full → Paid
// For advances with an incomplete job, Paid → Paid_Pending_Completion.
export async function recomputeInvoiceStatus(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      lineItems: true,
      paymentAllocations: true,
      job: true,
    },
  });
  if (!doc) return;
  if (doc.type !== "ADVANCE_INVOICE" && doc.type !== "FINAL_INVOICE") return;
  if (doc.status === "UNSENT") return; // Drafts don't have a status driven by payments

  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
  });

  const totalGross = new Decimal(totals.totalGross);
  const allocated = doc.paymentAllocations.reduce(
    (s, a) => s.plus(new Decimal(a.amount.toString())),
    new Decimal(0),
  );

  let next: "SENT" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" | "PAID_PENDING_COMPLETION";
  if (allocated.gte(totalGross) && !allocated.isZero()) {
    if (doc.type === "ADVANCE_INVOICE" && doc.job && doc.job.status !== "COMPLETED") {
      next = "PAID_PENDING_COMPLETION";
    } else {
      next = "PAID";
    }
  } else if (allocated.gt(0)) {
    next = "PARTIALLY_PAID";
  } else {
    // No payments — decide between SENT and OVERDUE based on due date.
    const overdue = doc.dueDate && doc.dueDate.getTime() < Date.now();
    next = overdue ? "OVERDUE" : "SENT";
  }

  if (doc.status !== next) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: next,
        paidAt: next === "PAID" ? new Date() : doc.paidAt,
      },
    });
  }
}

// When a job transitions to COMPLETED, flip any linked PAID_PENDING_COMPLETION
// advances to PAID. (jobs/actions.ts already had this wired; kept here so future
// triggers can reuse.)
export async function flipPpcAdvancesOnJobComplete(jobId: string) {
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

// The "outstanding" amount on an invoice = gross − sum(allocations).
// Used by the payment form to show remaining balance per invoice.
export async function computeOutstanding(
  documentId: string,
): Promise<{ gross: string; allocated: string; outstanding: string }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { lineItems: true, paymentAllocations: true },
  });
  if (!doc) return { gross: "0.00", allocated: "0.00", outstanding: "0.00" };
  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
  });
  const allocated = doc.paymentAllocations.reduce(
    (s, a) => s.plus(new Decimal(a.amount.toString())),
    new Decimal(0),
  );
  const gross = new Decimal(totals.totalGross);
  const outstanding = Decimal.max(gross.minus(allocated), new Decimal(0));
  return {
    gross: gross.toFixed(2),
    allocated: allocated.toFixed(2),
    outstanding: outstanding.toFixed(2),
  };
}
