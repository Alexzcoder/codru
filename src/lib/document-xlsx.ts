import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { calculateDocument } from "./line-items";
import { clientDisplayName } from "./client-display";
import type { DocumentType, DocumentStatus } from "@prisma/client";

// Czech payment-status labels for the "Stav úhrady" column.
const STAV: Record<DocumentStatus, string> = {
  UNSENT: "Koncept",
  SENT: "Neuhrazeno",
  ACCEPTED: "Přijato",
  REJECTED: "Zamítnuto",
  EXPIRED: "Vypršelo",
  PARTIALLY_PAID: "Částečně uhrazeno",
  PAID: "Uhrazeno",
  OVERDUE: "Po splatnosti",
  PAID_PENDING_COMPLETION: "Uhrazeno",
  APPLIED: "Použito",
  CANCELLED: "Stornováno",
};

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function buildDocumentsWorkbook(opts: {
  workspaceId: string;
  type: DocumentType;
  q?: string | null;
  /** Inclusive issue-date lower bound (YYYY-MM-DD). */
  from?: string | null;
  /** Inclusive issue-date upper bound (YYYY-MM-DD). */
  to?: string | null;
  sheetName: string;
  /** Document-kind label for the title, e.g. "vydaných faktur", "nabídek". */
  titleNoun: string;
}): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { workspaceId, type, q, sheetName, titleNoun } = opts;

  const issueDate: { gte?: Date; lt?: Date } = {};
  if (opts.from) issueDate.gte = new Date(`${opts.from}T00:00:00`);
  if (opts.to) {
    const end = new Date(`${opts.to}T00:00:00`);
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

  const [docs, profile] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { client: true, lineItems: true },
      orderBy: { issueDate: "asc" },
    }),
    prisma.companyProfile.findFirst({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { name: true, ico: true, dic: true },
    }),
  ]);

  // Period label for the title: explicit range, else min–max of results.
  const period =
    opts.from || opts.to
      ? `${opts.from ?? "…"} – ${opts.to ?? "…"}`
      : docs.length
        ? `${fmtDate(docs[0].issueDate)} – ${fmtDate(docs[docs.length - 1].issueDate)}`
        : "vše";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);

  const COLS = 11;
  ws.columns = [
    { key: "number", width: 16 },
    { key: "order", width: 16 },
    { key: "name", width: 30 },
    { key: "ico", width: 12 },
    { key: "dic", width: 14 },
    { key: "issued", width: 12 },
    { key: "due", width: 12 },
    { key: "net", width: 18 },
    { key: "vat", width: 14 },
    { key: "gross", width: 18 },
    { key: "status", width: 18 },
  ];

  // Title + supplier banner.
  ws.mergeCells(1, 1, 1, COLS);
  ws.getCell(1, 1).value = `Seznam ${titleNoun} – ${period}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, COLS);
  ws.getCell(2, 1).value = profile
    ? `Dodavatel: ${profile.name}${profile.ico ? `  •  IČ: ${profile.ico}` : ""}${profile.dic ? `  •  DIČ: ${profile.dic}` : ""}`
    : "";
  ws.getCell(2, 1).font = { color: { argb: "FF666666" } };

  const headerRowIdx = 4;
  const header = ws.getRow(headerRowIdx);
  header.values = [
    "Číslo dokladu",
    "Číslo objednávky",
    "Název / Jméno",
    "IČ",
    "DIČ",
    "Vystaveno",
    "Splatnost",
    "Celkem bez DPH (Kč)",
    "DPH (Kč)",
    "Celkem s DPH (Kč)",
    "Stav úhrady",
  ];
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  for (const d of docs) {
    const totals = calculateDocument({
      lines: d.lineItems.map((l) => ({
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        taxRatePercent: l.taxRatePercent.toString(),
        taxMode: l.taxMode,
        lineDiscountPercent: l.lineDiscountPercent?.toString() ?? null,
        lineDiscountAmount: l.lineDiscountAmount?.toString() ?? null,
        isAdvanceDeduction: l.isAdvanceDeduction,
      })),
      documentDiscountPercent: d.documentDiscountPercent?.toString() ?? null,
      documentDiscountAmount: d.documentDiscountAmount?.toString() ?? null,
      reverseCharge: d.reverseCharge,
    });
    const isCompany = d.client.type === "COMPANY";
    ws.addRow({
      number: d.number ?? "",
      order: "",
      name: clientDisplayName(d.client),
      ico: isCompany ? d.client.ico ?? "" : "",
      dic: isCompany ? d.client.dic ?? "" : "",
      issued: fmtDate(d.issueDate),
      due: fmtDate(d.dueDate ?? d.validUntilDate),
      net: Number(totals.totalNet),
      vat: Number(totals.totalTax),
      gross: Number(totals.totalGross),
      status: STAV[d.status] ?? d.status,
    });
  }
  // Money columns H,I,J
  ["H", "I", "J"].forEach((c) => {
    ws.getColumn(c).numFmt = "#,##0.00";
  });

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const stamp = [opts.from, opts.to].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${sheetName.toLowerCase().replace(/\s+/g, "-")}-${stamp}.xlsx`,
  };
}
