import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";

// Per-job profitability per PRD §15.2 and §17.2.
// Revenue = sum of gross on Final Invoices linked to the job (status != draft/deleted).
//   Advance invoices are excluded to avoid double-counting (their gross is
//   already deducted on the Final Invoice).
// Expenses = sum of total (gross) on Expense records linked to the job.
// Profit = revenue − expenses.

export type JobProfitability = {
  revenue: number;
  expenses: number;
  profit: number;
  currency: string; // best-effort; if multiple currencies exist we show CZK aggregate
};

export async function computeJobProfitability(jobId: string): Promise<JobProfitability> {
  const [invoices, expenses] = await Promise.all([
    prisma.document.findMany({
      where: {
        jobId,
        type: "FINAL_INVOICE",
        deletedAt: null,
        status: { not: "UNSENT" },
      },
      include: { lineItems: true },
    }),
    prisma.expense.findMany({
      where: { jobId },
    }),
  ]);

  let revenue = 0;
  for (const inv of invoices) {
    const totals = calculateDocument({
      lines: inv.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: inv.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: inv.documentDiscountAmount?.toString() ?? null,
      reverseCharge: inv.reverseCharge,
    });
    revenue += Number.parseFloat(totals.totalGross);
  }

  const expenseTotal = expenses.reduce(
    (s, e) => s + Number.parseFloat(e.totalAmount.toString()),
    0,
  );

  return {
    revenue,
    expenses: expenseTotal,
    profit: revenue - expenseTotal,
    currency: "CZK",
  };
}
