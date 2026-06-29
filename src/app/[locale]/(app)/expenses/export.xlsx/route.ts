import { requireWorkspace } from "@/lib/session";
import { buildExpensesWorkbook } from "@/lib/expenses-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());

  const { buffer } = await buildExpensesWorkbook({
    workspaceId: workspace.id,
    from: sp.from,
    to: sp.to,
    q: sp.q,
    categoryId: sp.categoryId,
    jobId: sp.jobId,
  });

  const stamp = [sp.from, sp.to].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="expenses-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
