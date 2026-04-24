"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { fireRule } from "@/lib/recurrence";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";

const baseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  customDays: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  daysInAdvance: z.coerce.number().int().min(0).max(60).default(0),
  autoGenerate: z.coerce.boolean().optional(),
});

const expenseKindSchema = baseSchema.extend({
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

const jobKindSchema = baseSchema.extend({
  title: z.string().trim().min(1).max(300),
  clientId: z.string().min(1),
  durationDays: z.coerce.number().int().min(0).max(90).default(0),
  startHour: z.coerce.number().int().min(0).max(23).default(9),
  durationHours: z.coerce.number().int().min(0).max(24).default(2),
  siteStreet: z.string().optional(),
  siteCity: z.string().optional(),
  siteZip: z.string().optional(),
  siteCountry: z.string().optional(),
  assignees: z.string().optional(),
  notes: z.string().optional(),
});

const invoiceKindSchema = baseSchema.extend({
  clientId: z.string().min(1),
  jobId: z.string().optional(),
  companyProfileId: z.string().min(1),
  documentTemplateId: z.string().min(1),
  currency: z.enum(["CZK", "EUR", "USD"]),
  locale: z.enum(["cs", "en"]),
  reverseCharge: z.coerce.boolean().optional(),
  documentDiscountPercent: z.string().optional(),
  documentDiscountAmount: z.string().optional(),
  notesInternal: z.string().optional(),
  notesToClient: z.string().optional(),
  dueInDays: z.coerce.number().int().min(0).max(180).default(14),
  linesJson: z.string(),
});

export type RuleState = { error?: string };

function toBaseRule(d: z.infer<typeof baseSchema>) {
  return {
    name: d.name,
    frequency: d.frequency,
    customDays: d.frequency === "CUSTOM" ? Number(d.customDays || "30") : null,
    startDate: new Date(d.startDate),
    endDate: d.endDate ? new Date(d.endDate) : null,
    daysInAdvance: d.daysInAdvance,
    autoGenerate: d.autoGenerate ?? true,
    nextRunAt: new Date(d.startDate),
  };
}

export async function createExpenseRule(
  _prev: RuleState,
  formData: FormData,
): Promise<RuleState> {
  const user = await requireUser();
  const parsed = expenseKindSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  const net = new Decimal(d.netAmount || "0");
  const rate = new Decimal(d.vatRatePercent || "0");
  const autoVat = (d.reverseCharge ?? false)
    ? new Decimal(0)
    : net.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = d.vatAmount ? new Decimal(d.vatAmount) : autoVat;

  const rule = await prisma.recurrenceRule.create({
    data: {
      ...toBaseRule(d),
      targetKind: "EXPENSE",
      createdById: user.id,
      payload: {
        kind: "EXPENSE",
        categoryId: d.categoryId,
        supplier: d.supplier || null,
        description: d.description,
        netAmount: net.toFixed(2),
        vatRatePercent: d.vatRatePercent,
        vatAmount: vat.toFixed(2),
        currency: d.currency,
        reverseCharge: d.reverseCharge ?? false,
        paymentMethod: d.paymentMethod,
        jobId: d.jobId || null,
        taxDeductible: d.taxDeductible ?? true,
        notes: d.notes || null,
      },
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: rule.id,
    action: "create",
    after: rule as unknown as Record<string, unknown>,
  });

  revalidatePath("/recurring");
  redirect(`/recurring/${rule.id}`);
}

export async function createJobRule(
  _prev: RuleState,
  formData: FormData,
): Promise<RuleState> {
  const user = await requireUser();
  const parsed = jobKindSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  const assigneeIds = (d.assignees ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const rule = await prisma.recurrenceRule.create({
    data: {
      ...toBaseRule(d),
      targetKind: "JOB",
      createdById: user.id,
      payload: {
        kind: "JOB",
        title: d.title,
        clientId: d.clientId,
        notes: d.notes || null,
        durationDays: d.durationDays,
        startHour: d.startHour,
        durationHours: d.durationHours,
        assigneeUserIds: assigneeIds,
        siteStreet: d.siteStreet || null,
        siteCity: d.siteCity || null,
        siteZip: d.siteZip || null,
        siteCountry: d.siteCountry || null,
      },
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: rule.id,
    action: "create",
    after: rule as unknown as Record<string, unknown>,
  });

  revalidatePath("/recurring");
  redirect(`/recurring/${rule.id}`);
}

export async function createInvoiceRule(
  _prev: RuleState,
  formData: FormData,
): Promise<RuleState> {
  const user = await requireUser();
  const parsed = invoiceKindSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let lines: unknown;
  try {
    lines = JSON.parse(d.linesJson);
  } catch {
    return { error: "invalidLines" };
  }
  if (!Array.isArray(lines) || lines.length === 0) return { error: "invalidLines" };

  const rule = await prisma.recurrenceRule.create({
    data: {
      ...toBaseRule(d),
      targetKind: "INVOICE",
      createdById: user.id,
      payload: {
        kind: "INVOICE",
        clientId: d.clientId,
        jobId: d.jobId || null,
        companyProfileId: d.companyProfileId,
        documentTemplateId: d.documentTemplateId,
        currency: d.currency,
        locale: d.locale,
        reverseCharge: d.reverseCharge ?? false,
        documentDiscountPercent: d.documentDiscountPercent || null,
        documentDiscountAmount: d.documentDiscountAmount || null,
        notesInternal: d.notesInternal || null,
        notesToClient: d.notesToClient || null,
        dueInDays: d.dueInDays,
        lines,
      },
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: rule.id,
    action: "create",
    after: rule as unknown as Record<string, unknown>,
  });

  revalidatePath("/recurring");
  redirect(`/recurring/${rule.id}`);
}

export async function pauseRule(id: string) {
  const user = await requireUser();
  await prisma.recurrenceRule.update({
    where: { id },
    data: { pausedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: id,
    action: "update",
    after: { pausedAt: new Date() } as unknown as Record<string, unknown>,
  });
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}

export async function resumeRule(id: string) {
  const user = await requireUser();
  await prisma.recurrenceRule.update({
    where: { id },
    data: { pausedAt: null },
  });
  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: id,
    action: "update",
    after: { pausedAt: null } as unknown as Record<string, unknown>,
  });
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}

export async function endRule(id: string) {
  const user = await requireUser();
  await prisma.recurrenceRule.update({
    where: { id },
    data: { endDate: new Date(), pausedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: id,
    action: "update",
    after: { endDate: new Date() } as unknown as Record<string, unknown>,
  });
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}

export async function deleteRule(id: string) {
  const user = await requireUser();
  await prisma.recurrenceRule.delete({ where: { id } });
  await writeAudit({
    actorId: user.id,
    entity: "RecurrenceRule",
    entityId: id,
    action: "delete",
  });
  revalidatePath("/recurring");
  redirect("/recurring");
}

export async function runNow(id: string) {
  await requireUser();
  try {
    await fireRule(id);
  } catch {
    // swallow; error stored on rule
  }
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}
