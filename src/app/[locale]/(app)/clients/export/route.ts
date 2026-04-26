import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { clientDisplayName } from "@/lib/client-display";

const HEADERS = [
  "id",
  "type",
  "status",
  "displayName",
  "companyName",
  "fullName",
  "ico",
  "dic",
  "email",
  "phone",
  "street",
  "city",
  "zip",
  "country",
  "defaultLanguage",
  "preferredCurrency",
  "notes",
  "createdAt",
];

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const { workspace } = await requireWorkspace();
  const rows = await prisma.client.findMany({
    where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const lines = [HEADERS.join(",")];
  for (const c of rows) {
    lines.push(
      [
        c.id,
        c.type,
        c.status,
        clientDisplayName(c),
        c.companyName,
        c.fullName,
        c.ico,
        c.dic,
        c.email,
        c.phone,
        c.addressStreet,
        c.addressCity,
        c.addressZip,
        c.addressCountry,
        c.defaultLanguage,
        c.preferredCurrency,
        c.notes,
        c.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
