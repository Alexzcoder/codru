import JSZip from "jszip";
import { prisma } from "./prisma";
import {
  latestSnapshotPath,
  renderDocumentPdf,
  type DocumentWithLines,
} from "./documents";
import { readUpload } from "./uploads";
import type { DocumentType } from "@prisma/client";

// Bulk-download every document of a type as a ZIP of their PDFs. Used for
// "give me all the final-invoice PDFs for May" — the Excel export is only a
// summary; this packages the actual legal documents.
//
// For issued (numbered) documents we serve the frozen PDF snapshot — the exact
// archived copy the client received. Drafts (UNSENT, no snapshot) are rendered
// on the fly so a month's worth of work-in-progress is still downloadable.

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
  zipBaseName: string;
}): Promise<{ buffer: Buffer; filename: string; count: number }> {
  const { workspaceId, type, q, zipBaseName } = opts;

  // A month (YYYY-MM) is the common case ("all invoices for May") — expand it to
  // an inclusive day range. Otherwise use explicit from/to.
  let from = opts.from;
  let to = opts.to;
  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const [y, m] = opts.month.split("-").map(Number);
    // Last calendar day of the month. Use getDate() (not toISOString, which would
    // shift the day across the UTC boundary in a positive-offset timezone).
    const lastDay = new Date(y, m, 0).getDate();
    from = `${opts.month}-01`;
    to = `${opts.month}-${String(lastDay).padStart(2, "0")}`;
  }

  // Build the issue-date window. `to` is made exclusive of the next day so the
  // whole end day is included.
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

  const zip = new JSZip();
  const usedNames = new Set<string>();
  let count = 0;

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

    // Filename: the legal number, or a dated draft fallback; dedupe collisions.
    const base =
      doc.number ?? `koncept-${doc.issueDate.toISOString().slice(0, 10)}-${doc.id.slice(-6)}`;
    let name = `${sanitize(base)}.pdf`;
    let n = 2;
    while (usedNames.has(name)) name = `${sanitize(base)}-${n++}.pdf`;
    usedNames.add(name);

    zip.file(name, pdf);
    count++;
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const stamp = [from, to].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${zipBaseName}-${stamp}.zip`,
    count,
  };
}

function sanitize(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
