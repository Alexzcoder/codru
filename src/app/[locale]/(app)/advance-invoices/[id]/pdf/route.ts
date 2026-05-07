import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { renderDocumentPdf, latestSnapshotPath } from "@/lib/documents";
import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const url = new URL(req.url);
  const disp = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  const doc = await prisma.document.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!doc || doc.type !== "ADVANCE_INVOICE" || doc.deletedAt) notFound();

  if (doc.status !== "UNSENT") {
    const relPath = await latestSnapshotPath(doc.id);
    if (relPath) {
      const absolute = path.join(process.cwd(), "public", relPath);
      const buffer = await fs.readFile(absolute);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `${disp}; filename="${doc.number ?? "advance-invoice"}.pdf"`,
          "cache-control": "no-store",
        },
      });
    }
  }

  const buffer = await renderDocumentPdf(doc);
  const fallback = `zalohova-faktura-koncept-${doc.issueDate.toISOString().slice(0, 10)}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disp}; filename="${doc.number ?? fallback}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
