import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { renderDocumentPdf, latestSnapshotPath } from "@/lib/documents";
import fs from "node:fs/promises";
import path from "node:path";

export type SendDocumentEmailInput = {
  identityId: string;
  documentId: string;
  toAddress: string;
  ccAddress?: string | null;
  subject: string;
  body: string;
  language: "cs" | "en";
  draftedByClaude: boolean;
  sentById: string;
};

export type SendDocumentEmailResult =
  | { ok: true; emailLogId: string }
  | { ok: false; error: string };

export async function sendDocumentEmail(
  input: SendDocumentEmailInput,
): Promise<SendDocumentEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const identity = await prisma.emailIdentity.findUnique({
    where: { id: input.identityId },
  });
  if (!identity || identity.archivedAt) {
    return { ok: false, error: "Selected sender no longer available." };
  }

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!doc || doc.deletedAt) {
    return { ok: false, error: "Document not found." };
  }

  // Get the PDF buffer — use the latest snapshot if document is sent;
  // otherwise render fresh.
  let pdfBuffer: Buffer;
  if (doc.status !== "UNSENT") {
    const rel = await latestSnapshotPath(doc.id);
    if (rel) {
      pdfBuffer = await fs.readFile(path.join(process.cwd(), "public", rel));
    } else {
      pdfBuffer = await renderDocumentPdf(doc);
    }
  } else {
    pdfBuffer = await renderDocumentPdf(doc);
  }

  const fromHeader = identity.displayName
    ? `${identity.displayName} <${identity.fromAddress}>`
    : identity.fromAddress;

  const filename = `${doc.number ?? `${doc.type.toLowerCase()}-draft`}.pdf`;

  const resend = new Resend(apiKey);
  let resendMessageId: string | null = null;
  let status = "sent";
  let errorMessage: string | null = null;

  try {
    const result = await resend.emails.send({
      from: fromHeader,
      to: input.toAddress,
      cc: input.ccAddress ? [input.ccAddress] : undefined,
      replyTo: identity.fromAddress,
      subject: input.subject,
      text: input.body,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
    if (result.error) {
      status = "failed";
      errorMessage = result.error.message ?? String(result.error);
    } else {
      resendMessageId = result.data?.id ?? null;
    }
  } catch (e) {
    status = "failed";
    errorMessage = e instanceof Error ? e.message : "Unknown error";
  }

  const log = await prisma.emailLog.create({
    data: {
      identityId: identity.id,
      documentId: doc.id,
      sentById: input.sentById,
      toAddress: input.toAddress.toLowerCase(),
      ccAddress: input.ccAddress?.toLowerCase() ?? null,
      fromAddress: identity.fromAddress,
      fromDisplayName: identity.displayName,
      subject: input.subject,
      bodyText: input.body,
      language: input.language,
      draftedByClaude: input.draftedByClaude,
      resendMessageId,
      status,
      errorMessage,
    },
  });

  if (status === "failed") {
    return { ok: false, error: errorMessage ?? "Send failed." };
  }
  return { ok: true, emailLogId: log.id };
}
