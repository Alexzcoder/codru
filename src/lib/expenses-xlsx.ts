import ExcelJS from "exceljs";
import { prisma } from "./prisma";

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Expense ledger workbook: line-by-line with VAT split into 0/12/21 bands,
// plus per-category and VAT summaries. Shared by the expenses export route and
// the combined "export all to accountant" bundle.
export async function buildExpensesWorkbook(opts: {
  workspaceId: string;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  categoryId?: string | null;
  jobId?: string | null;
}): Promise<{ buffer: ArrayBuffer }> {
  const dateFilter: { gte?: Date; lt?: Date } = {};
  if (opts.from) dateFilter.gte = new Date(`${opts.from}T00:00:00`);
  if (opts.to) {
    const end = new Date(`${opts.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    dateFilter.lt = end;
  }

  const where = {
    workspaceId: opts.workspaceId,
    ...((dateFilter.gte || dateFilter.lt) && { date: dateFilter }),
    ...(opts.categoryId && { categoryId: opts.categoryId }),
    ...(opts.jobId && { jobId: opts.jobId }),
    ...(opts.q && {
      OR: [
        { description: { contains: opts.q, mode: "insensitive" as const } },
        { supplier: { contains: opts.q, mode: "insensitive" as const } },
      ],
    }),
  };

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const period =
    opts.from || opts.to
      ? `${opts.from ?? "…"} – ${opts.to ?? "…"}`
      : expenses.length
        ? `${fmtDate(expenses[0].date)} – ${fmtDate(expenses[expenses.length - 1].date)}`
        : "all";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();

  // ---- Sheet 1: line-by-line, VAT split into 0 / 12 / 21 bands ----
  const ws = wb.addWorksheet("Expenses");
  const COLS = 13;
  ws.columns = [
    { key: "n", width: 5 },
    { key: "date", width: 12 },
    { key: "vendor", width: 30 },
    { key: "desc", width: 46 },
    { key: "category", width: 22 },
    { key: "b0", width: 16 },
    { key: "b12", width: 16 },
    { key: "v12", width: 14 },
    { key: "b21", width: 16 },
    { key: "v21", width: 14 },
    { key: "total", width: 14 },
    { key: "file", width: 30 },
    { key: "notes", width: 30 },
  ];
  ws.mergeCells(1, 1, 1, COLS);
  ws.getCell(1, 1).value = `Receipts & Expenses — ${period}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  const head = ws.getRow(3);
  head.values = [
    "#", "Date", "Vendor", "Description / Items", "Category",
    "Base 0% VAT (CZK)", "Base 12% VAT (CZK)", "VAT 12% (CZK)",
    "Base 21% VAT (CZK)", "VAT 21% (CZK)", "Total (CZK)", "File reference", "Notes",
  ];
  head.font = { bold: true };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
  });

  const catTotals = new Map<string, { net: number; vat: number; gross: number }>();
  const vatBands = { b0: 0, b12: 0, v12: 0, b21: 0, v21: 0 };

  expenses.forEach((e, i) => {
    const net = Number(e.netAmount.toString());
    const vat = Number(e.vatAmount.toString());
    const total = Number(e.totalAmount.toString());
    const rate = Number(e.vatRatePercent.toString());
    const reverse = e.reverseCharge;

    let b0 = 0, b12 = 0, v12 = 0, b21 = 0, v21 = 0;
    if (reverse || rate === 0) b0 = net;
    else if (rate === 12) { b12 = net; v12 = vat; }
    else if (rate === 21) { b21 = net; v21 = vat; }
    else { b0 = net; } // unknown rate -> base only

    vatBands.b0 += b0; vatBands.b12 += b12; vatBands.v12 += v12; vatBands.b21 += b21; vatBands.v21 += v21;

    const cat = e.category?.name ?? "—";
    const ct = catTotals.get(cat) ?? { net: 0, vat: 0, gross: 0 };
    ct.net += net; ct.vat += vat; ct.gross += total;
    catTotals.set(cat, ct);

    ws.addRow({
      n: i + 1,
      date: fmtDate(e.date),
      vendor: e.supplier ?? "",
      desc: e.description,
      category: cat,
      b0: b0 || "",
      b12: b12 || "",
      v12: v12 || "",
      b21: b21 || "",
      v21: v21 || "",
      total,
      file: e.receiptPath ?? "",
      notes: e.notes ?? "",
    });
  });
  ["F", "G", "H", "I", "J", "K"].forEach((c) => {
    ws.getColumn(c).numFmt = "#,##0.00";
  });

  // ---- Sheet 2: Summary by Category ----
  const cs = wb.addWorksheet("Summary by Category");
  cs.columns = [
    { key: "category", width: 32 },
    { key: "net", width: 16 },
    { key: "vat", width: 14 },
    { key: "gross", width: 16 },
  ];
  cs.mergeCells(1, 1, 1, 4);
  cs.getCell(1, 1).value = "Summary by Category";
  cs.getCell(1, 1).font = { bold: true, size: 14 };
  const csHead = cs.getRow(3);
  csHead.values = ["Category", "Net Total (CZK)", "VAT (CZK)", "Gross Total (CZK)"];
  csHead.font = { bold: true };
  [...catTotals.entries()]
    .sort((a, b) => b[1].gross - a[1].gross)
    .forEach(([category, t]) =>
      cs.addRow({ category, net: t.net, vat: t.vat, gross: t.gross }),
    );
  ["B", "C", "D"].forEach((c) => (cs.getColumn(c).numFmt = "#,##0.00"));

  // ---- Sheet 3: VAT Summary ----
  const vs = wb.addWorksheet("VAT Summary");
  vs.columns = [
    { key: "rate", width: 14 },
    { key: "base", width: 18 },
    { key: "vat", width: 16 },
  ];
  vs.mergeCells(1, 1, 1, 3);
  vs.getCell(1, 1).value = "VAT Summary";
  vs.getCell(1, 1).font = { bold: true, size: 14 };
  const vsHead = vs.getRow(3);
  vsHead.values = ["VAT rate", "Tax base (CZK)", "VAT amount (CZK)"];
  vsHead.font = { bold: true };
  vs.addRow({ rate: "0% VAT", base: vatBands.b0, vat: 0 });
  vs.addRow({ rate: "12% VAT", base: vatBands.b12, vat: vatBands.v12 });
  vs.addRow({ rate: "21% VAT", base: vatBands.b21, vat: vatBands.v21 });
  const totalRow = vs.addRow({
    rate: "TOTAL",
    base: vatBands.b0 + vatBands.b12 + vatBands.b21,
    vat: vatBands.v12 + vatBands.v21,
  });
  totalRow.font = { bold: true };
  ["B", "C"].forEach((c) => (vs.getColumn(c).numFmt = "#,##0.00"));

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return { buffer };
}
