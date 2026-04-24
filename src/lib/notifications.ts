import type { NotificationTrigger } from "@prisma/client";
import { prisma } from "./prisma";
import { sendNotificationEmail } from "./email";

// PRD §18.2: priority triggers get email by default.
// User can per-trigger toggle email delivery via notificationPrefs.
const PRIORITY_TRIGGERS: NotificationTrigger[] = [
  "INVOICE_OVERDUE",
  "PAYMENT_RECEIVED",
  // "NEW_INQUIRY" — PRD §18 Phase 2, not built yet
];

type Prefs = Record<string, boolean | undefined>;

// Translate trigger → the pref key users can toggle in their profile.
const TRIGGER_TO_PREF: Record<NotificationTrigger, string> = {
  INVOICE_OVERDUE: "overdue",
  JOB_TOMORROW: "jobTomorrow",
  QUOTE_EXPIRING: "quoteExpiring",
  NEW_POTENTIAL_CLIENT: "newPotential",
  PAYMENT_RECEIVED: "payment",
  RECURRING_UPCOMING: "recurringUpcoming",
};

export type NotificationSpec = {
  trigger: NotificationTrigger;
  entityType?: string;
  entityId?: string;
  message: string;
  href?: string;
  dedupKey: string; // unique per user+entity+time
  // Scope the notification: "all" = every active user, or a specific userId.
  scope?: "all" | string;
};

// Create notifications and fan out to users. Dedups on (userId, dedupKey).
// Returns the number actually inserted.
export async function createNotification(spec: NotificationSpec): Promise<number> {
  const users =
    spec.scope === "all" || !spec.scope
      ? await prisma.user.findMany({
          where: { deactivatedAt: null },
          select: { id: true, email: true, notificationPrefs: true, name: true },
        })
      : await prisma.user
          .findUnique({
            where: { id: spec.scope },
            select: { id: true, email: true, notificationPrefs: true, name: true },
          })
          .then((u) => (u ? [u] : []));

  let inserted = 0;
  for (const user of users) {
    // Upsert-by-unique to dedup cleanly.
    const result = await prisma.notification.upsert({
      where: {
        userId_dedupKey: {
          userId: user.id,
          dedupKey: spec.dedupKey,
        },
      },
      create: {
        userId: user.id,
        trigger: spec.trigger,
        entityType: spec.entityType,
        entityId: spec.entityId,
        message: spec.message,
        href: spec.href,
        dedupKey: spec.dedupKey,
      },
      update: {}, // existing → keep
    });

    // If this row was just created (createdAt within the last 2s), consider it new.
    const brandNew = Date.now() - result.createdAt.getTime() < 2000;
    if (brandNew) inserted++;

    if (!brandNew) continue;

    // Email for priority triggers when the user has them enabled.
    const prefs = (user.notificationPrefs ?? {}) as Prefs;
    const prefKey = TRIGGER_TO_PREF[spec.trigger];
    const emailOn = prefs[prefKey] ?? PRIORITY_TRIGGERS.includes(spec.trigger);
    if (emailOn && PRIORITY_TRIGGERS.includes(spec.trigger)) {
      // Fire and forget — email failures shouldn't break the action path.
      sendNotificationEmail({
        to: user.email,
        subject: spec.message,
        body: spec.message + (spec.href ? `\n\nOpen: ${process.env.APP_URL ?? ""}${spec.href}` : ""),
      }).catch((err) => {
        console.error("Notification email failed:", err);
      });
    }
  }

  return inserted;
}

// ─── Scan-based implicit triggers — time-driven events that aren't written
// as side effects elsewhere. Called from the authenticated layout, throttled.
let lastScanAt = 0;
const SCAN_THROTTLE_MS = 5 * 60 * 1000;

export async function scanImplicitTriggers(opts: { force?: boolean } = {}): Promise<void> {
  const now = Date.now();
  if (!opts.force && now - lastScanAt < SCAN_THROTTLE_MS) return;
  lastScanAt = now;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const in3daysEnd = new Date(today);
  in3daysEnd.setDate(in3daysEnd.getDate() + 4);

  // 1. Invoices that have transitioned to OVERDUE but still don't have a notif.
  //    Driver: autoOverdue actions set status. We issue a notif when an OVERDUE
  //    invoice is first observed by the scan (dedup by doc id).
  const overdueInvoices = await prisma.document.findMany({
    where: {
      type: { in: ["ADVANCE_INVOICE", "FINAL_INVOICE"] },
      status: "OVERDUE",
      deletedAt: null,
    },
    select: { id: true, number: true, type: true, dueDate: true },
  });
  for (const inv of overdueInvoices) {
    const href =
      inv.type === "ADVANCE_INVOICE"
        ? `/advance-invoices/${inv.id}`
        : `/final-invoices/${inv.id}`;
    await createNotification({
      trigger: "INVOICE_OVERDUE",
      entityType: "Document",
      entityId: inv.id,
      message: `Invoice ${inv.number ?? inv.id.slice(-6)} is overdue`,
      href,
      dedupKey: `INVOICE_OVERDUE:${inv.id}`,
      scope: "all",
    });
  }

  // 2. Jobs scheduled to start tomorrow (once per job per date).
  const tomorrowJobs = await prisma.job.findMany({
    where: {
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      scheduledStart: { gte: tomorrowStart, lt: tomorrowEnd },
    },
    include: {
      client: { select: { type: true, companyName: true, fullName: true, anonymizedAt: true } },
    },
  });
  const dateKey = tomorrowStart.toISOString().slice(0, 10);
  for (const j of tomorrowJobs) {
    const clientName =
      j.client.anonymizedAt
        ? "[anonymized]"
        : j.client.type === "COMPANY"
          ? j.client.companyName ?? "(unnamed)"
          : j.client.fullName ?? "(unnamed)";
    await createNotification({
      trigger: "JOB_TOMORROW",
      entityType: "Job",
      entityId: j.id,
      message: `Tomorrow: ${j.title} — ${clientName}`,
      href: `/jobs/${j.id}`,
      dedupKey: `JOB_TOMORROW:${j.id}:${dateKey}`,
      scope: "all",
    });
  }

  // 3. Quotes expiring within 3 days.
  const expiringQuotes = await prisma.document.findMany({
    where: {
      type: "QUOTE",
      status: "SENT",
      validUntilDate: { gte: today, lt: in3daysEnd },
      deletedAt: null,
    },
    select: { id: true, number: true, validUntilDate: true },
  });
  for (const q of expiringQuotes) {
    await createNotification({
      trigger: "QUOTE_EXPIRING",
      entityType: "Document",
      entityId: q.id,
      message: `Quote ${q.number ?? q.id.slice(-6)} expires ${q.validUntilDate?.toISOString().slice(0, 10)}`,
      href: `/quotes/${q.id}`,
      dedupKey: `QUOTE_EXPIRING:${q.id}`,
      scope: "all",
    });
  }
}
