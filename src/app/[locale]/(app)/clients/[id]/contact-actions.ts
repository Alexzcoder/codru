"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const schema = z.object({
  clientId: z.string().min(1),
  type: z.enum(["PHONE", "EMAIL", "MEETING", "SITE_VISIT", "OTHER"]),
  notes: z.string().trim().min(1).max(5000),
  date: z.string().optional(),
});

export type ContactLogState = { error?: string; saved?: boolean };

export async function addContactLog(
  _prev: ContactLogState,
  formData: FormData,
): Promise<ContactLogState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const log = await prisma.contactLog.create({
    data: {
      clientId: parsed.data.clientId,
      type: parsed.data.type,
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      loggedById: user.id,
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "ContactLog",
    entityId: log.id,
    action: "create",
    after: log as unknown as Record<string, unknown>,
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { saved: true };
}
