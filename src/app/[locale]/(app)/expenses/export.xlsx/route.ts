import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());

  const where = {
    workspaceId: workspace.id,
    ...(sp.from && { date: { gte: new Date(sp.from) } }),
    ...(sp.to && { date: { lte: new Date(sp.to) } }),
    ...(sp.categoryId && { categoryId: sp.categoryId }),
    ...(sp.jobId && { jobId: sp.jobId }),
    ...(sp.q && {
      OR: [
        { description: { contains: sp.q, mode: "insensitive" as const } },
        { supplier: { contains: sp.q, mode: "insensitive" as const } },
      ],
    }),
  };

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true, job: { select: { title: true } } },
    orderBy: { date: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();
  const ws = wb.addWorksheet("Expenses");
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Category", key: "category", width: 22 },
    { header: "Supplier", key: "supplier", width: 28 },
    { header: "Description", key: "description", width: 40 },
    { header: "Job", key: "job", width: 28 },
    { header: "Net", key: "net", width: 14 },
    { header: "VAT", key: "vat", width: 14 },
    { header: "Total", key: "total", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const e of expenses) {
    ws.addRow({
      date: e.date.toISOString().slice(0, 10),
      category: e.category?.name ?? "",
      supplier: e.supplier ?? "",
      description: e.description,
      job: e.job?.title ?? "",
      net: Number(e.netAmount.toString()),
      vat: Number(e.vatAmount.toString()),
      total: Number(e.totalAmount.toString()),
      currency: e.currency,
    });
  }
  ["F", "G", "H"].forEach((col) => {
    ws.getColumn(col).numFmt = "#,##0.00";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
