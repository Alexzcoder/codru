import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { clientDisplayName } from "@/lib/client-display";
import { pragueDateString } from "@/lib/format-datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { workspace } = await requireWorkspace();
  const rows = await prisma.client.findMany({
    where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();
  const ws = wb.addWorksheet("Clients");
  ws.columns = [
    { header: "Name", key: "displayName", width: 30 },
    { header: "Type", key: "type", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Company name", key: "companyName", width: 30 },
    { header: "Full name", key: "fullName", width: 26 },
    { header: "IČO", key: "ico", width: 12 },
    { header: "DIČ", key: "dic", width: 14 },
    { header: "Email", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Street", key: "street", width: 30 },
    { header: "City", key: "city", width: 20 },
    { header: "ZIP", key: "zip", width: 10 },
    { header: "Country", key: "country", width: 10 },
    { header: "Language", key: "language", width: 10 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Created", key: "created", width: 12 },
    { header: "ID", key: "id", width: 26 },
  ];
  ws.getRow(1).font = { bold: true };

  // IČO/DIČ/ZIP/phone are identifiers, not numbers — force text so Excel keeps
  // the leading zero (IČO 02995573 would otherwise import as 2995573).
  for (const key of ["ico", "dic", "zip", "phone"]) {
    ws.getColumn(key).numFmt = "@";
  }

  for (const c of rows) {
    ws.addRow({
      displayName: clientDisplayName(c),
      type: c.type,
      status: c.status,
      companyName: c.companyName ?? "",
      fullName: c.fullName ?? "",
      ico: c.ico ?? "",
      dic: c.dic ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      street: c.addressStreet ?? "",
      city: c.addressCity ?? "",
      zip: c.addressZip ?? "",
      country: c.addressCountry,
      language: c.defaultLanguage,
      currency: c.preferredCurrency,
      notes: c.notes ?? "",
      created: pragueDateString(c.createdAt),
      id: c.id,
    });
  }

  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="clients-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
