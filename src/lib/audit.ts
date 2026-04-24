import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

type Diffable = Record<string, unknown> | null | undefined;

// PRD §23: every create/edit/delete on Client, Job, Document, CreditNote, Payment,
// Expense, RecurrenceRule records user + timestamp + change.
// We apply the same pattern to User / CompanyProfile / TaxRate / ItemCategory as well.
export async function writeAudit({
  actorId,
  entity,
  entityId,
  action,
  before,
  after,
}: {
  actorId: string | null;
  entity: string;
  entityId: string;
  action: "create" | "update" | "delete" | "invite" | "deactivate" | "reactivate" | "login" | "reset-password";
  before?: Diffable;
  after?: Diffable;
}) {
  await prisma.auditLog.create({
    data: {
      actorId,
      entity,
      entityId,
      action,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
