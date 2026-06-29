import JSZip from "jszip";
import { prisma } from "./prisma";
import {
  latestSnapshotPath,
  renderDocumentPdf,
  type DocumentWithLines,
} from "./documents";
import { readUpload } from "./uploads";
import type { DocumentType, DocumentStatus } from "@prisma/client";

const STATUS_VALUES = new Set<DocumentStatus>([
  "UNSENT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "PARTIALLY_PAID",
  "PAID", "OVERDUE", "PAID_PENDING_COMPLETION", "APPLIED", "CANCELLED",
]);

// Bulk-download every document of a type as a ZIP of their PDFs. Used for
// "give me all the final-invoice PDFs for May" — the Excel export is only a
// summary; this packages the actual legal documents.
//
// For issued (numbered) documents we serve the frozen PDF snapshot — the exact
// archived copy the client received. Drafts (UNSENT, no snapshot) are rendered
// on the fly so a month's worth of work-in-progress is still downloadable.

export type DocPdfQuery = {
  workspaceId: string;
  type: DocumentType;
  q?: string | null;
  /** Inclusive issue-date lower bound (YYYY-MM-DD). */
  from?: string | null;
  /** Inclusive issue-date upper bound (YYYY-MM-DD). */
  to?: string | null;
  /** Convenience: a whole month (YYYY-MM). Overrides from/to when set. */
  month?: string | null;
  /** Filter to a single document status (e.g. ACCEPTED, REJECTED, PAID). */
  status?: string | null;
};

// The PDFs for a query, deduped-named, archived-snapshot-preferred. Shared by
// the single-type ZIP and the combined "export all to accountant" bundle.
export async function collectDocumentPdfs(
  opts: DocPdfQuery,
): Promise<{ name: string; buffer: Buffer }[]> {
  const { workspaceId, type, q } = opts;
  const status =
    opts.status && STATUS_VALUES.has(opts.status as DocumentStatus)
      ? (opts.status as DocumentStatus)
      : null;

  let from = opts.from;
  let to = opts.to;
  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const [y, m] = opts.month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    from = `${opts.month}-01`;
    to = `${opts.month}-${String(lastDay).padStart(2, "0")}`;
  }

  const issueDate: { gte?: Date; lt?: Date } = {};
  if (from) issueDate.gte = new Date(`${from}T00:00:00`);
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    issueDate.lt = end;
  }

  const where = {
    workspaceId,
    type,
    deletedAt: null,
    ...(status && { status }),
    ...((issueDate.gte || issueDate.lt) && { issueDate }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { client: { companyName: { contains: q, mode: "insensitive" as const } } },
        { client: { fullName: { contains: q, mode: "insensitive" as const } } },
      ],
    }),
  };

  const docs = await prisma.document.findMany({
    where,
    include: { lineItems: { orderBy: { position: "asc" } } },
    orderBy: { issueDate: "asc" },
  });

  const out: { name: string; buffer: Buffer }[] = [];
  const usedNames = new Set<string>();

  for (const doc of docs) {
    let pdf: Buffer | null = null;
    // Prefer the archived snapshot for issued documents.
    if (doc.status !== "UNSENT") {
      const relPath = await latestSnapshotPath(doc.id);
      if (relPath) {
        try {
          pdf = await readUpload(relPath);
        } catch {
          pdf = null; // fall through to live render
        }
      }
    }
    if (!pdf) {
      try {
        pdf = await renderDocumentPdf(doc as DocumentWithLines);
      } catch {
        continue; // skip a doc we genuinely can't render rather than fail the whole zip
      }
    }

    const base =
      doc.number ?? `koncept-${doc.issueDate.toISOString().slice(0, 10)}-${doc.id.slice(-6)}`;
    let name = `${sanitize(base)}.pdf`;
    let n = 2;
    while (usedNames.has(name)) name = `${sanitize(base)}-${n++}.pdf`;
    usedNames.add(name);
    out.push({ name, buffer: pdf });
  }

  return out;
}

export async function buildDocumentsPdfZip(opts: {
  workspaceId: string;
  type: DocumentType;
  q?: string | null;
  /** Inclusive issue-date lower bound (YYYY-MM-DD). */
  from?: string | null;
  /** Inclusive issue-date upper bound (YYYY-MM-DD). */
  to?: string | null;
  /** Convenience: a whole month (YYYY-MM). Overrides from/to when set. */
  month?: string | null;
  /** Filter to a single document status (e.g. ACCEPTED, REJECTED, PAID). */
  status?: string | null;
  zipBaseName: string;
}): Promise<{ buffer: Buffer; filename: string; count: number }> {
  const { zipBaseName } = opts;
  const files = await collectDocumentPdfs(opts);

  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.buffer);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const stamp =
    [opts.status?.toLowerCase(), opts.from, opts.to].filter(Boolean).join("_") ||
    new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${zipBaseName}-${stamp}.zip`,
    count: files.length,
  };
}

function sanitize(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
