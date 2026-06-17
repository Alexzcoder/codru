"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientDisplayName } from "@/lib/client-display";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().optional().or(z.literal("")),
  quantity: z.string().optional().or(z.literal("")),
  unit: z.string().optional().or(z.literal("")),
  completed: z.coerce.boolean().optional().default(false),
  notCompleted: z.coerce.boolean().optional().default(false),
  note: z.string().optional().or(z.literal("")),
});

const protocolSchema = z.object({
  clientId: z.string().optional().or(z.literal("")),
  jobId: z.string().optional().or(z.literal("")),
  sourceQuoteId: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  clientName: z.string().trim().min(1).max(300),
  clientPhone: z.string().optional().or(z.literal("")),
  clientEmail: z.string().optional().or(z.literal("")),
  siteAddress: z.string().optional().or(z.literal("")),
  zakazkaNumber: z.string().optional().or(z.literal("")),
  contractorName: z.string().optional().or(z.literal("")),
  leaderName: z.string().optional().or(z.literal("")),
  realizationDate: z.string().optional().or(z.literal("")),
  signedAt: z.string().optional().or(z.literal("")),
  vicepraceDone: z.coerce.boolean().optional().default(false),
  vicepraceDescription: z.string().optional().or(z.literal("")),
  vicepracePrice: z.string().optional().or(z.literal("")),
  vicepraceConsent: z.string().optional().or(z.literal("")),
  usedMaterials: z.string().optional().or(z.literal("")),
  wasteGenerated: z.string().optional().or(z.literal("")),
  wasteRemoved: z.string().optional().or(z.literal("")),
  photosBeforeTaken: z.coerce.boolean().optional().default(false),
  photosDuringTaken: z.coerce.boolean().optional().default(false),
  photosAfterTaken: z.coerce.boolean().optional().default(false),
  acceptance: z.enum([
    "PENDING",
    "ACCEPTED_NO_ISSUES",
    "ACCEPTED_WITH_RESERVATIONS",
    "NOT_ACCEPTED",
    "CLIENT_ABSENT",
  ]).default("PENDING"),
  clientReservations: z.string().optional().or(z.literal("")),
  contractorNote: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "COMPLETED"]).default("DRAFT"),
  itemsJson: z.string(),
});

export type ProtocolState = { error?: string };

function emptyToNull(s: string | undefined): string | null {
  if (!s || s === "") return null;
  return s;
}

function parseDate(s: string | undefined): Date | null {
  if (!s || s === "") return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseItems(raw: string) {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr)) throw new Error("Invalid items");
  return z.array(itemSchema).parse(arr);
}

// Create a blank handover protocol (no source quote).
export async function createBlankProtocol(): Promise<void> {
  const { user, workspace } = await requireWorkspace();
  const created = await prisma.handoverProtocol.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      clientName: "",
      status: "DRAFT",
      acceptance: "PENDING",
    },
  });
  revalidatePath("/handover-protocols");
  redirect(`/handover-protocols/${created.id}`);
}

// Generate a handover protocol from an existing quote — clones the quote's
// line items as protocol items and pre-fills client identity from the quote.
export async function createProtocolFromQuote(quoteId: string): Promise<void> {
  const { user, workspace } = await requireWorkspace();
  const quote = await prisma.document.findFirst({
    where: { id: quoteId, workspaceId: workspace.id, type: "QUOTE" },
    include: {
      client: true,
      job: true,
      lineItems: { orderBy: { position: "asc" } },
      companyProfile: true,
    },
  });
  if (!quote) throw new Error("Quote not found");

  const siteAddressParts = [
    quote.job?.siteStreet,
    quote.job?.siteCity,
    quote.job?.siteZip,
  ].filter((p): p is string => !!p);
  const siteAddress = siteAddressParts.length > 0
    ? siteAddressParts.join(", ")
    : [quote.client.addressStreet, quote.client.addressCity, quote.client.addressZip]
        .filter((p): p is string => !!p).join(", ") || null;

  const created = await prisma.handoverProtocol.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      clientId: quote.clientId,
      jobId: quote.jobId ?? null,
      sourceQuoteId: quote.id,
      clientName: clientDisplayName(quote.client),
      clientPhone: quote.client.phone,
      clientEmail: quote.client.email,
      siteAddress,
      zakazkaNumber: quote.number ?? null,
      contractorName: quote.companyProfile.name,
      status: "DRAFT",
      acceptance: "PENDING",
      items: {
        create: quote.lineItems.map((l, idx) => ({
          position: idx + 1,
          name: l.name,
          description: l.description,
          quantity: l.quantity.toString(),
          unit: l.unit,
        })),
      },
    },
  });

  revalidatePath("/handover-protocols");
  redirect(`/handover-protocols/${created.id}`);
}

export async function updateProtocol(
  id: string,
  _prev: ProtocolState,
  formData: FormData,
): Promise<ProtocolState> {
  const { workspace } = await requireWorkspace();
  const existing = await prisma.handoverProtocol.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) return { error: "notFound" };

  const parsed = protocolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  const d = parsed.data;

  let items: z.infer<typeof itemSchema>[];
  try {
    items = parseItems(d.itemsJson);
  } catch {
    return { error: "invalidItems" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.handoverProtocol.update({
      where: { id },
      data: {
        clientId: emptyToNull(d.clientId),
        jobId: emptyToNull(d.jobId),
        sourceQuoteId: emptyToNull(d.sourceQuoteId),
        number: emptyToNull(d.number),
        clientName: d.clientName,
        clientPhone: emptyToNull(d.clientPhone),
        clientEmail: emptyToNull(d.clientEmail),
        siteAddress: emptyToNull(d.siteAddress),
        zakazkaNumber: emptyToNull(d.zakazkaNumber),
        contractorName: emptyToNull(d.contractorName),
        leaderName: emptyToNull(d.leaderName),
        realizationDate: parseDate(d.realizationDate),
        signedAt: parseDate(d.signedAt),
        vicepraceDone: d.vicepraceDone,
        vicepraceDescription: emptyToNull(d.vicepraceDescription),
        vicepracePrice: emptyToNull(d.vicepracePrice),
        vicepraceConsent: emptyToNull(d.vicepraceConsent),
        usedMaterials: emptyToNull(d.usedMaterials),
        wasteGenerated: emptyToNull(d.wasteGenerated),
        wasteRemoved: emptyToNull(d.wasteRemoved),
        photosBeforeTaken: d.photosBeforeTaken,
        photosDuringTaken: d.photosDuringTaken,
        photosAfterTaken: d.photosAfterTaken,
        acceptance: d.acceptance,
        clientReservations: emptyToNull(d.clientReservations),
        contractorNote: emptyToNull(d.contractorNote),
        status: d.status,
      },
    });

    // Wipe + recreate items. Simpler than diff'ing and fine at this scale —
    // protocols rarely have more than ~30 items.
    await tx.handoverProtocolItem.deleteMany({ where: { protocolId: id } });
    if (items.length > 0) {
      await tx.handoverProtocolItem.createMany({
        data: items.map((it, idx) => ({
          protocolId: id,
          position: idx + 1,
          name: it.name,
          description: emptyToNull(it.description),
          quantity: emptyToNull(it.quantity),
          unit: emptyToNull(it.unit),
          completed: it.completed,
          notCompleted: it.notCompleted,
          note: emptyToNull(it.note),
        })),
      });
    }
  });

  revalidatePath("/handover-protocols");
  revalidatePath(`/handover-protocols/${id}`);
  return {};
}

export async function deleteProtocol(id: string): Promise<void> {
  const { workspace } = await requireWorkspace();
  await prisma.handoverProtocol.deleteMany({
    where: { id, workspaceId: workspace.id },
  });
  revalidatePath("/handover-protocols");
  redirect("/handover-protocols");
}
