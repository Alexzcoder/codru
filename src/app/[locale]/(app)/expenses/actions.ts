"use server";

import Decimal from "decimal.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { saveReceiptUpload, deleteUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const expenseSchema = z.object({
  date: z.string().min(1),
  categoryId: z.string().min(1),
  supplier: z.string().optional(),
  description: z.string().trim().min(1).max(1000),
  netAmount: z.string(),
  vatRatePercent: z.string(),
  vatAmount: z.string().optional(),
  currency: z.enum(["CZK", "EUR", "USD"]),
  reverseCharge: z.coerce.boolean().optional(),
  paymentMethod: z.enum(["BANK", "CASH"]),
  jobId: z.string().optional(),
  taxDeductible: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

export type ExpenseState = { error?: string };

function computeAmounts(raw: z.infer<typeof expenseSchema>) {
  const net = new Decimal(raw.netAmount || "0");
  const rate = new Decimal(raw.vatRatePercent || "0");
  const reverseCharge = raw.reverseCharge ?? false;

  // Auto-compute VAT amount if not provided (user can override).
  const autoVat = reverseCharge
    ? new Decimal(0)
    : net.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = raw.vatAmount && raw.vatAmount !== "" ? new Decimal(raw.vatAmount) : autoVat;
  const total = net.plus(vat);

  return {
    net: net.toFixed(2),
    vat: vat.toFixed(2),
    total: total.toFixed(2),
  };
}

export async function createExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const amounts = computeAmounts(d);

  let receiptPath: string | null = null;
  const file = formData.get("receipt") as File | null;
  if (file && file.size > 0) {
    try {
      receiptPath = await saveReceiptUpload({ file });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "uploadFailed" };
    }
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date(d.date),
      categoryId: d.categoryId,
      supplier: d.supplier || null,
      description: d.description,
      netAmount: amounts.net,
      vatRatePercent: d.vatRatePercent,
      vatAmount: amounts.vat,
      totalAmount: amounts.total,
      currency: d.currency,
      reverseCharge: d.reverseCharge ?? false,
      paymentMethod: d.paymentMethod,
      jobId: d.jobId || null,
      taxDeductible: d.taxDeductible ?? true,
      notes: d.notes || null,
      receiptPath,
      createdById: user.id,
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "Expense",
    entityId: expense.id,
    action: "create",
    after: expense as unknown as Record<string, unknown>,
  });

  revalidatePath("/expenses");
  if (expense.jobId) revalidatePath(`/jobs/${expense.jobId}`);
  redirect(`/expenses/${expense.id}`);
}

export async function updateExpense(
  id: string,
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;
  const amounts = computeAmounts(d);

  const before = await prisma.expense.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  let receiptPath: string | null | undefined;
  const file = formData.get("receipt") as File | null;
  if (file && file.size > 0) {
    try {
      receiptPath = await saveReceiptUpload({ file });
      if (before.receiptPath) await deleteUpload(before.receiptPath);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "uploadFailed" };
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      date: new Date(d.date),
      categoryId: d.categoryId,
      supplier: d.supplier || null,
      description: d.description,
      netAmount: amounts.net,
      vatRatePercent: d.vatRatePercent,
      vatAmount: amounts.vat,
      totalAmount: amounts.total,
      currency: d.currency,
      reverseCharge: d.reverseCharge ?? false,
      paymentMethod: d.paymentMethod,
      jobId: d.jobId || null,
      taxDeductible: d.taxDeductible ?? true,
      notes: d.notes || null,
      ...(receiptPath !== undefined && { receiptPath }),
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "Expense",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  if (before.jobId) revalidatePath(`/jobs/${before.jobId}`);
  if (updated.jobId && updated.jobId !== before.jobId)
    revalidatePath(`/jobs/${updated.jobId}`);
  redirect(`/expenses/${id}`);
}

export async function deleteExpense(id: string) {
  const user = await requireUser();
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.expense.delete({ where: { id } });
  if (existing.receiptPath) await deleteUpload(existing.receiptPath);
  await writeAudit({
    actorId: user.id,
    entity: "Expense",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });
  revalidatePath("/expenses");
  if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
  redirect("/expenses");
}
