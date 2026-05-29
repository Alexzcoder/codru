import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { renderDocumentPdf, latestSnapshotPath, transitionToSent } from "@/lib/documents";
import { readUpload } from "@/lib/uploads";

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

  let doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!doc || doc.deletedAt) {
    return { ok: false, error: "Document not found." };
  }

  // Finalize BEFORE rendering the attachment. Emailing a document IS the act of
  // issuing it, so it must go out as the numbered final — never a "KONCEPT"
  // draft. transitionToSent allocates the gapless number + freezes the snapshot
  // and is idempotent (no-op once past UNSENT). If it fails we abort rather than
  // mail a draft.
  if (doc.status === "UNSENT") {
    try {
      await transitionToSent(input.sentById, doc.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: `Could not finalize document before sending: ${msg}` };
    }
    const refreshed = await prisma.document.findUnique({
      where: { id: input.documentId },
      include: { lineItems: { orderBy: { position: "asc" } } },
    });
    if (!refreshed) return { ok: false, error: "Document not found after finalizing." };
    doc = refreshed;
  }

  // Attach the archived snapshot (the legal copy) when present; otherwise render
  // fresh from the now-numbered document. readUpload handles both Vercel Blob
  // URLs (prod) and local /uploads paths (dev).
  let pdfBuffer: Buffer;
  const snapshotRel = await latestSnapshotPath(doc.id);
  if (snapshotRel) {
    try {
      pdfBuffer = await readUpload(snapshotRel);
    } catch {
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
      workspaceId: doc.workspaceId,
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

  // Document was already finalized (numbered + snapshotted) above, before the
  // PDF was rendered, so the recipient received the numbered final document.
  return { ok: true, emailLogId: log.id };
}
