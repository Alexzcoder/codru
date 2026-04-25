"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { calculateDocument } from "@/lib/line-items";
import { clientDisplayName } from "@/lib/client-display";
import { draftClientEmail, type EmailDraftResult } from "@/lib/ai/email-draft";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";
import { sendDocumentEmail } from "./send-document";
import { revalidatePath } from "next/cache";

export type ComposerData = {
  document: {
    id: string;
    type: "QUOTE" | "ADVANCE_INVOICE" | "FINAL_INVOICE" | "CREDIT_NOTE";
    number: string | null;
    locale: "cs" | "en";
    totalGross: string;
    currency: string;
    dueDate: string | null;
    validUntil: string | null;
    companyProfileId: string;
    detailHref: string;
  };
  client: {
    displayName: string;
    email: string | null;
  };
  identities: Array<{
    id: string;
    fromAddress: string;
    displayName: string | null;
    isDefault: boolean;
    companyProfileId: string;
  }>;
  defaultIdentityId: string | null;
};

const detailPath = (
  type: ComposerData["document"]["type"],
  id: string,
): string => {
  switch (type) {
    case "QUOTE":
      return `/quotes/${id}`;
    case "ADVANCE_INVOICE":
      return `/advance-invoices/${id}`;
    case "FINAL_INVOICE":
      return `/final-invoices/${id}`;
    case "CREDIT_NOTE":
      return `/credit-notes/${id}`;
  }
};

export async function loadEmailComposerData(
  documentId: string,
): Promise<ComposerData | null> {
  await requireUser();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { client: true, lineItems: true },
  });
  if (!doc || doc.deletedAt) return null;

  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
  });

  // Pull every active identity in the system so the user can pick from any
  // of "their" company profiles' senders. (Single-tenant for now — every
  // logged-in user sees the full set.)
  const identities = await prisma.emailIdentity.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Default sender preference: this doc's company profile's default
  // identity, then any default at all, then the first active.
  const docCompanyDefault = identities.find(
    (i) => i.companyProfileId === doc.companyProfileId && i.isDefault,
  );
  const docCompanyAny = identities.find(
    (i) => i.companyProfileId === doc.companyProfileId,
  );
  const fallback = identities[0] ?? null;
  const defaultIdentity = docCompanyDefault ?? docCompanyAny ?? fallback;

  return {
    document: {
      id: doc.id,
      type: doc.type as ComposerData["document"]["type"],
      number: doc.number,
      locale: (doc.locale as "cs" | "en") ?? "cs",
      totalGross: totals.totalGross,
      currency: doc.currency,
      dueDate: doc.dueDate?.toISOString().slice(0, 10) ?? null,
      validUntil: doc.validUntilDate?.toISOString().slice(0, 10) ?? null,
      companyProfileId: doc.companyProfileId,
      detailHref: detailPath(doc.type as ComposerData["document"]["type"], doc.id),
    },
    client: {
      displayName: clientDisplayName(doc.client),
      email: doc.client.email,
    },
    identities: identities.map((i) => ({
      id: i.id,
      fromAddress: i.fromAddress,
      displayName: i.displayName,
      isDefault: i.isDefault,
      companyProfileId: i.companyProfileId,
    })),
    defaultIdentityId: defaultIdentity?.id ?? null,
  };
}

export type DraftEmailResult =
  | { ok: true; subject: string; body: string; cost: number; tokens: { in: number; out: number } }
  | { ok: false; reason: "rate-limit" | "no-key" | "error"; message: string };

export async function draftEmailWithClaude(args: {
  documentId: string;
  language: "cs" | "en";
  customerNote: string | null;
}): Promise<DraftEmailResult> {
  const user = await requireUser();
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no-key", message: "ANTHROPIC_API_KEY is not set." };
  }
  const cap = await checkDailyCap(user.id);
  if (!cap.ok) {
    return {
      ok: false,
      reason: "rate-limit",
      message: `Daily AI call limit reached (${cap.callsToday}/${cap.cap}).`,
    };
  }

  const doc = await prisma.document.findUnique({
    where: { id: args.documentId },
    include: {
      client: true,
      lineItems: true,
      companyProfile: true,
    },
  });
  if (!doc || doc.deletedAt) {
    return { ok: false, reason: "error", message: "Document not found." };
  }

  const totals = calculateDocument({
    lines: doc.lineItems.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      taxRatePercent: l.taxRatePercent.toString(),
      taxMode: l.taxMode,
      lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
      lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
    })),
    documentDiscountPercent: doc.documentDiscountPercent?.toString() ?? null,
    documentDiscountAmount: doc.documentDiscountAmount?.toString() ?? null,
    reverseCharge: doc.reverseCharge,
  });

  const t0 = Date.now();
  let result: EmailDraftResult;
  try {
    result = await draftClientEmail({
      language: args.language,
      documentType: doc.type as
        | "QUOTE"
        | "ADVANCE_INVOICE"
        | "FINAL_INVOICE"
        | "CREDIT_NOTE",
      documentNumber: doc.number,
      totalGross: totals.totalGross,
      currency: doc.currency,
      clientDisplayName: clientDisplayName(doc.client),
      companyDisplayName: doc.companyProfile.name,
      senderName: user.name,
      dueDate: doc.dueDate?.toISOString().slice(0, 10) ?? null,
      validUntil: doc.validUntilDate?.toISOString().slice(0, 10) ?? null,
      customerNote: args.customerNote,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await logAiCall({
      userId: user.id,
      feature: "email-draft",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0,
      },
      durationMs: Date.now() - t0,
      ok: false,
      errorMessage: msg,
    });
    return { ok: false, reason: "error", message: msg };
  }

  await logAiCall({
    userId: user.id,
    feature: "email-draft",
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      estimatedCostUsd: result.estimatedCostUsd,
    },
    durationMs: result.durationMs,
    ok: true,
  });

  return {
    ok: true,
    subject: result.subject,
    body: result.body,
    cost: result.estimatedCostUsd,
    tokens: { in: result.inputTokens, out: result.outputTokens },
  };
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendEmailFromComposer(args: {
  documentId: string;
  identityId: string;
  toAddress: string;
  ccAddress: string | null;
  subject: string;
  body: string;
  language: "cs" | "en";
  draftedByClaude: boolean;
}): Promise<SendEmailResult> {
  const user = await requireUser();
  if (!args.toAddress.trim()) return { ok: false, error: "Recipient is empty." };
  if (!args.subject.trim()) return { ok: false, error: "Subject is empty." };
  if (!args.body.trim()) return { ok: false, error: "Body is empty." };

  const r = await sendDocumentEmail({
    identityId: args.identityId,
    documentId: args.documentId,
    toAddress: args.toAddress.trim(),
    ccAddress: args.ccAddress?.trim() || null,
    subject: args.subject.trim(),
    body: args.body,
    language: args.language,
    draftedByClaude: args.draftedByClaude,
    sentById: user.id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  // Refresh the document's detail page so the new EmailLog appears.
  const doc = await prisma.document.findUnique({
    where: { id: args.documentId },
    select: { type: true, id: true },
  });
  if (doc) {
    revalidatePath(detailPath(doc.type as ComposerData["document"]["type"], doc.id));
  }
  return { ok: true };
}
