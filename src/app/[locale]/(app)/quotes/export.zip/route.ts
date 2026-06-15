import { requireWorkspace } from "@/lib/session";
import { buildDocumentsPdfZip } from "@/lib/document-pdf-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const { buffer, filename } = await buildDocumentsPdfZip({
    workspaceId: workspace.id,
    type: "QUOTE",
    q: url.searchParams.get("q"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    month: url.searchParams.get("month"),
    zipBaseName: "nabidky",
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
