import { requireWorkspace } from "@/lib/session";
import { buildDocumentsWorkbook } from "@/lib/document-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const { buffer, filename } = await buildDocumentsWorkbook({
    workspaceId: workspace.id,
    type: "ADVANCE_INVOICE",
    q,
    sheetName: "Advance invoices",
  });
  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
