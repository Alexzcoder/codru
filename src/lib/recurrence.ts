import type {
  RecurrenceRule,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import type {
  AnyPayload,
  ExpensePayload,
  InvoicePayload,
  JobPayload,
} from "./recurrence-payloads";
import Decimal from "decimal.js";

// Throttle the on-page-load hook so we don't thrash the DB on every request.
// We track a static timestamp in module scope (per server instance).
let lastRunCheck = 0;
const RUN_THROTTLE_MS = 60_000;

export function advanceNextRun(rule: RecurrenceRule): Date {
  const base = new Date(rule.nextRunAt);
  const next = new Date(base);
  switch (rule.frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "CUSTOM":
      next.setDate(next.getDate() + (rule.customDays ?? 30));
      break;
  }
  return next;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function generateJobInstance(rule: RecurrenceRule, payload: JobPayload): Promise<void> {
  const runAt = new Date(rule.nextRunAt);
  const start = new Date(runAt);
  start.setHours(payload.startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + (payload.durationHours || 0));
  if (payload.durationDays > 0) end.setDate(end.getDate() + payload.durationDays);

  await prisma.job.create({
    data: {
      title: payload.title,
      clientId: payload.clientId,
      status: "SCHEDULED",
      siteStreet: payload.siteStreet,
      siteCity: payload.siteCity,
      siteZip: payload.siteZip,
      siteCountry: payload.siteCountry,
      scheduledStart: start,
      scheduledEnd: end,
      notes: payload.notes,
      recurrenceRuleId: rule.id,
      assignments: {
        create: payload.assigneeUserIds.map((userId) => ({ userId })),
      },
    },
  });
}

async function generateExpenseInstance(rule: RecurrenceRule, payload: ExpensePayload): Promise<void> {
  const net = new Decimal(payload.netAmount || "0");
  const vat = new Decimal(payload.vatAmount || "0");
  const total = net.plus(vat);

  await prisma.expense.create({
    data: {
      date: new Date(rule.nextRunAt),
      categoryId: payload.categoryId,
      supplier: payload.supplier,
      description: payload.description,
      netAmount: net.toFixed(2),
      vatRatePercent: payload.vatRatePercent,
      vatAmount: vat.toFixed(2),
      totalAmount: total.toFixed(2),
      currency: payload.currency,
      reverseCharge: payload.reverseCharge,
      paymentMethod: payload.paymentMethod,
      jobId: payload.jobId,
      taxDeductible: payload.taxDeductible,
      notes: payload.notes,
      createdById: rule.createdById,
      recurrenceRuleId: rule.id,
    },
  });
}

async function generateInvoiceInstance(rule: RecurrenceRule, payload: InvoicePayload): Promise<void> {
  // PRD §16.4: new invoice created UNSENT; number assigned only at Sent.
  const issue = new Date(rule.nextRunAt);
  const due = addDays(issue, payload.dueInDays || 14);

  await prisma.document.create({
    data: {
      type: "FINAL_INVOICE",
      status: "UNSENT",
      clientId: payload.clientId,
      jobId: payload.jobId,
      companyProfileId: payload.companyProfileId,
      documentTemplateId: payload.documentTemplateId,
      createdById: rule.createdById,
      currency: payload.currency,
      locale: payload.locale,
      issueDate: issue,
      taxPointDate: issue,
      dueDate: due,
      reverseCharge: payload.reverseCharge,
      documentDiscountPercent: payload.documentDiscountPercent,
      documentDiscountAmount: payload.documentDiscountAmount,
      notesInternal: payload.notesInternal,
      notesToClient: payload.notesToClient,
      recurrenceRuleId: rule.id,
      lineItems: {
        create: payload.lines.map((l, idx) => ({
          position: idx + 1,
          name: l.name,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          taxRatePercent: l.taxRatePercent,
          taxMode: l.taxMode,
          lineDiscountPercent: l.lineDiscountPercent,
          lineDiscountAmount: l.lineDiscountAmount,
        })),
      },
    },
  });
}

export async function fireRule(ruleId: string): Promise<void> {
  const rule = await prisma.recurrenceRule.findUnique({ where: { id: ruleId } });
  if (!rule) return;
  const payload = rule.payload as unknown as AnyPayload;
  try {
    if (payload.kind === "JOB") await generateJobInstance(rule, payload);
    else if (payload.kind === "EXPENSE") await generateExpenseInstance(rule, payload);
    else if (payload.kind === "INVOICE") await generateInvoiceInstance(rule, payload);

    await prisma.recurrenceRule.update({
      where: { id: rule.id },
      data: {
        nextRunAt: advanceNextRun(rule),
        lastRunAt: new Date(),
        lastError: null,
      },
    });
    const { createNotification } = await import("./notifications");
    await createNotification({
      trigger: "RECURRING_UPCOMING",
      entityType: "RecurrenceRule",
      entityId: rule.id,
      message: `Recurring ${rule.targetKind.toLowerCase()} generated: ${rule.name}`,
      href: `/recurring/${rule.id}`,
      dedupKey: `RECURRING_UPCOMING:${rule.id}:${rule.nextRunAt.toISOString().slice(0, 10)}`,
      scope: "all",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.recurrenceRule.update({
      where: { id: rule.id },
      data: { lastError: msg.slice(0, 1000) },
    });
    throw err;
  }
}

// Find rules that are due (respecting daysInAdvance + endDate + paused) and fire them.
// Called lazily from pages — throttled to at most once per RUN_THROTTLE_MS.
export async function runDueRecurrences(opts: { force?: boolean } = {}): Promise<void> {
  const now = Date.now();
  if (!opts.force && now - lastRunCheck < RUN_THROTTLE_MS) return;
  lastRunCheck = now;

  const nowDate = new Date(now);
  // "Due" = nextRunAt − daysInAdvance ≤ now, and within endDate if set,
  // and autoGenerate = true, and not paused. We express daysInAdvance with a
  // post-filter since it's a small field, not indexed.
  const rules = await prisma.recurrenceRule.findMany({
    where: {
      pausedAt: null,
      autoGenerate: true,
      nextRunAt: { lte: new Date(now + 365 * 24 * 60 * 60 * 1000) }, // bounded
      OR: [{ endDate: null }, { endDate: { gte: nowDate } }],
    },
  });

  for (const rule of rules) {
    const fireAt = addDays(rule.nextRunAt, -rule.daysInAdvance);
    if (fireAt.getTime() > now) continue;
    if (rule.endDate && rule.endDate < rule.nextRunAt) continue;
    try {
      await fireRule(rule.id);
    } catch (err) {
      console.error("Recurrence fire failed for", rule.id, err);
    }
  }
}

export function upcomingRuns(rule: RecurrenceRule, horizonDays: number): Date[] {
  if (rule.pausedAt || !rule.autoGenerate) return [];
  const end = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
  const out: Date[] = [];
  let cursor = new Date(rule.nextRunAt);
  // Copy rule for advance (we mutate cursor)
  const tmpRule: RecurrenceRule = { ...rule };
  while (cursor <= end) {
    if (rule.endDate && cursor > rule.endDate) break;
    out.push(new Date(cursor));
    tmpRule.nextRunAt = cursor;
    cursor = advanceNextRun(tmpRule);
    if (out.length >= 50) break; // safety
  }
  return out;
}

export type RuleWithPayload = RecurrenceRule & {
  payload: Prisma.JsonValue;
};
