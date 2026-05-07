import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { renderDocumentPdf, latestSnapshotPath } from "@/lib/documents";
import { readUpload } from "@/lib/uploads";
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
  if (!doc || doc.type !== "CREDIT_NOTE" || doc.deletedAt) notFound();

  if (doc.status !== "UNSENT") {
    const relPath = await latestSnapshotPath(doc.id);
    if (relPath) {
      try {
        const buffer = await readUpload(relPath);
        return new Response(new Uint8Array(buffer), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `${disp}; filename="${doc.number ?? "credit-note"}.pdf"`,
            "cache-control": "no-store",
          },
        });
      } catch {
        // fall through to on-demand render
      }
    }
  }

  const buffer = await renderDocumentPdf(doc);
  const fallback = `opravny-doklad-koncept-${doc.issueDate.toISOString().slice(0, 10)}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disp}; filename="${doc.number ?? fallback}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
