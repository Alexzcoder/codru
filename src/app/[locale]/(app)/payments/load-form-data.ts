import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/client-display";
import { computeOutstanding } from "@/lib/payment-status";
import type { ClientChoice, OpenInvoice } from "./payment-form";

export async function loadPaymentFormData(workspaceId: string, opts?: { includePaymentId?: string }) {
  const [clients, openDocs] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, deletedAt: null, anonymizedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: {
        workspaceId,
        type: { in: ["ADVANCE_INVOICE", "FINAL_INVOICE"] },
        deletedAt: null,
        status: {
          in: [
            "SENT",
            "OVERDUE",
            "PARTIALLY_PAID",
            "PAID_PENDING_COMPLETION",
            // Include PAID in edit flows so the original allocations still render;
            // otherwise exclude when creating net-new.
            ...(opts?.includePaymentId ? (["PAID"] as const) : []),
          ],
        },
      },
      include: { paymentAllocations: true },
      orderBy: { issueDate: "asc" },
    }),
  ]);

  const clientChoices: ClientChoice[] = clients.map((c) => ({
    id: c.id,
    name: clientDisplayName(c),
    preferredCurrency: c.preferredCurrency,
  }));

  const openInvoices: OpenInvoice[] = [];
  for (const d of openDocs) {
    const summary = await computeOutstanding(d.id);
    // Keep the row even if fully paid so edits can surface it.
    openInvoices.push({
      id: d.id,
      type: d.type as "ADVANCE_INVOICE" | "FINAL_INVOICE",
      number: d.number,
      clientId: d.clientId,
      currency: d.currency,
      gross: summary.gross,
      allocated: summary.allocated,
      outstanding: summary.outstanding,
      dueDate: d.dueDate?.toISOString().slice(0, 10) ?? null,
    });
  }

  return { clientChoices, openInvoices };
}
