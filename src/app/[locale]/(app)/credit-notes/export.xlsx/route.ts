import { requireWorkspace } from "@/lib/session";
import { buildDocumentsWorkbook } from "@/lib/document-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const { buffer, filename } = await buildDocumentsWorkbook({
    workspaceId: workspace.id,
    type: "CREDIT_NOTE",
    q: url.searchParams.get("q"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    sheetName: "Opravné doklady",
    titleNoun: "opravných dokladů",
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
