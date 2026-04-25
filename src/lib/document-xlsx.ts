import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";
import { clientDisplayName } from "./client-display";
import type { DocumentType } from "@prisma/client";

export async function buildDocumentsWorkbook(opts: {
  type: DocumentType;
  q?: string | null;
  sheetName: string;
}): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { type, q, sheetName } = opts;

  const where = {
    type,
    deletedAt: null,
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
    include: { client: true, lineItems: true },
    orderBy: { issueDate: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { header: "Number", key: "number", width: 16 },
    { header: "Issue date", key: "issueDate", width: 12 },
    { header: "Due date", key: "dueDate", width: 12 },
    { header: "Client", key: "client", width: 32 },
    { header: "Net", key: "net", width: 14 },
    { header: "VAT", key: "vat", width: 14 },
    { header: "Gross", key: "gross", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Status", key: "status", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const d of docs) {
    const totals = calculateDocument({
      lines: d.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
      })),
      documentDiscountPercent: d.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: d.documentDiscountAmount?.toString() ?? null,
      reverseCharge: d.reverseCharge,
    });
    ws.addRow({
      number: d.number ?? "",
      issueDate: d.issueDate.toISOString().slice(0, 10),
      dueDate: d.dueDate?.toISOString().slice(0, 10) ?? "",
      client: clientDisplayName(d.client),
      net: Number(totals.subtotalNet),
      vat: Number(totals.totalGross) - Number(totals.subtotalNet),
      gross: Number(totals.totalGross),
      currency: d.currency,
      status: d.status,
    });
  }
  ["E", "F", "G"].forEach((c) => {
    ws.getColumn(c).numFmt = "#,##0.00";
  });

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return { buffer, filename: `${sheetName.toLowerCase().replace(/\s+/g, "-")}-${stamp}.xlsx` };
}
