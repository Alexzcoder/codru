"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { isValidIco, isValidDic } from "@/lib/czech-validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const clientSchema = z
  .object({
    type: z.enum(["INDIVIDUAL", "COMPANY"]),
    status: z.enum(["POTENTIAL", "ACTIVE", "PAST", "FAILED"]),
    companyName: z.string().trim().max(200).optional().or(z.literal("")),
    fullName: z.string().trim().max(200).optional().or(z.literal("")),
    ico: z.string().trim().max(20).optional().or(z.literal("")),
    dic: z.string().trim().max(20).optional().or(z.literal("")),
    icoOverride: z.coerce.boolean().optional(),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    addressStreet: z.string().trim().max(200).optional().or(z.literal("")),
    addressCity: z.string().trim().max(100).optional().or(z.literal("")),
    addressZip: z.string().trim().max(20).optional().or(z.literal("")),
    addressCountry: z.string().trim().max(2).default("CZ"),
    notes: z.string().trim().max(5000).optional().or(z.literal("")),
    defaultLanguage: z.enum(["cs", "en"]).default("cs"),
    preferredCurrency: z.enum(["CZK", "EUR", "USD"]).default("CZK"),
    customFields: z.string().optional(),
    duplicateAck: z.coerce.boolean().optional(),
  })
  .refine((d) => (d.type === "COMPANY" ? !!d.companyName : true), {
    path: ["companyName"],
    message: "required",
  })
  .refine((d) => (d.type === "INDIVIDUAL" ? !!d.fullName : true), {
    path: ["fullName"],
    message: "required",
  });

export type ClientState = {
  error?: string;
  fieldError?: string;
  duplicateIcoId?: string;
  duplicateEmailId?: string;
  duplicateName?: string;
};

type DupField = "ico" | "email";

async function findDuplicate(
  field: DupField,
  value: string,
  excludeId?: string,
) {
  if (!value) return null;
  return prisma.client.findFirst({
    where: {
      [field]: value,
      deletedAt: null,
      anonymizedAt: null,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true, companyName: true, fullName: true, type: true, anonymizedAt: true },
  });
}

function toPayload(d: z.infer<typeof clientSchema>) {
  return {
    type: d.type,
    status: d.status,
    companyName: d.type === "COMPANY" ? (d.companyName || null) : null,
    fullName: d.type === "INDIVIDUAL" ? (d.fullName || null) : null,
    ico: d.ico || null,
    dic: d.dic || null,
    icoOverride: d.icoOverride ?? false,
    email: d.email || null,
    phone: d.phone || null,
    addressStreet: d.addressStreet || null,
    addressCity: d.addressCity || null,
    addressZip: d.addressZip || null,
    addressCountry: d.addressCountry || "CZ",
    notes: d.notes || null,
    defaultLanguage: d.defaultLanguage,
    preferredCurrency: d.preferredCurrency,
  };
}

async function saveCustomFields(
  clientId: string,
  raw: string | undefined,
) {
  if (!raw) return;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    return;
  }
  const entries = Object.entries(parsed);
  await prisma.$transaction(
    entries.map(([fieldDefId, value]) =>
      prisma.customFieldValue.upsert({
        where: { clientId_fieldDefId: { clientId, fieldDefId } },
        create: { clientId, fieldDefId, value },
        update: { value },
      }),
    ),
  );
}

export async function createClient(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: "invalidInput", fieldError: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;

  if (d.ico && !isValidIco(d.ico) && !d.icoOverride) {
    return { error: "icoInvalid", fieldError: "ico" };
  }
  if (d.dic && !isValidDic(d.dic)) {
    return { error: "dicInvalid", fieldError: "dic" };
  }

  if (!d.duplicateAck) {
    if (d.ico) {
      const dup = await findDuplicate("ico", d.ico);
      if (dup) {
        return { duplicateIcoId: dup.id, duplicateName: displayOf(dup) };
      }
    }
    if (d.email) {
      const dup = await findDuplicate("email", d.email);
      if (dup) {
        return { duplicateEmailId: dup.id, duplicateName: displayOf(dup) };
      }
    }
  }

  const client = await prisma.client.create({ data: toPayload(d) });
  await saveCustomFields(client.id, d.customFields);

  await writeAudit({
    actorId: user.id,
    entity: "Client",
    entityId: client.id,
    action: "create",
    after: client as unknown as Record<string, unknown>,
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  id: string,
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: "invalidInput", fieldError: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;

  if (d.ico && !isValidIco(d.ico) && !d.icoOverride) {
    return { error: "icoInvalid", fieldError: "ico" };
  }
  if (d.dic && !isValidDic(d.dic)) {
    return { error: "dicInvalid", fieldError: "dic" };
  }

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { error: "notFound" };

  if (!d.duplicateAck) {
    if (d.ico) {
      const dup = await findDuplicate("ico", d.ico, id);
      if (dup) return { duplicateIcoId: dup.id, duplicateName: displayOf(dup) };
    }
    if (d.email) {
      const dup = await findDuplicate("email", d.email, id);
      if (dup) return { duplicateEmailId: dup.id, duplicateName: displayOf(dup) };
    }
  }

  const updated = await prisma.client.update({ where: { id }, data: toPayload(d) });
  await saveCustomFields(id, d.customFields);

  await writeAudit({
    actorId: user.id,
    entity: "Client",
    entityId: id,
    action: "update",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string) {
  const user = await requireUser();
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) return;

  // Delete-protection gate for fiscal records will live in M11 once Documents ship.
  // For now: soft-delete always. When documents exist (M8+), this branch anonymizes instead.
  // TODO(M8): if any linked Document has status != draft, call anonymizeClient(id) instead.
  await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });

  await writeAudit({
    actorId: user.id,
    entity: "Client",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function anonymizeClient(id: string) {
  const user = await requireUser();
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.client.update({
    where: { id },
    data: {
      anonymizedAt: new Date(),
      companyName: "[anonymized]",
      fullName: null,
      email: null,
      phone: null,
      addressStreet: null,
      addressCity: null,
      addressZip: null,
      notes: null,
      ico: null,
      dic: null,
    },
  });

  await writeAudit({
    actorId: user.id,
    entity: "Client",
    entityId: id,
    action: "delete",
    before: existing as unknown as Record<string, unknown>,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

function displayOf(c: {
  type: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  fullName: string | null;
  anonymizedAt: Date | null;
}): string {
  if (c.anonymizedAt) return "[anonymized]";
  return c.type === "COMPANY" ? c.companyName ?? "(unnamed)" : c.fullName ?? "(unnamed)";
}

export async function createDemoClient() {
  const { generateDemoClient } = await import("@/lib/demo-data");
  const user = await requireUser();
  const data = generateDemoClient();
  const client = await prisma.client.create({ data });
  await writeAudit({
    actorId: user.id,
    entity: "Client",
    entityId: client.id,
    action: "create",
    after: client as unknown as Record<string, unknown>,
  });
  revalidatePath("/clients");
}
