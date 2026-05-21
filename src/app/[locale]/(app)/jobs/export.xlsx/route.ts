import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { clientDisplayName } from "@/lib/client-display";
import { pragueDateString } from "@/lib/format-datetime";
import type { JobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: JobStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const rawStatus = url.searchParams.get("status") ?? "all";
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const assigneeId = url.searchParams.get("assigneeId") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  const statusFilter = VALID_STATUSES.includes(rawStatus as JobStatus)
    ? (rawStatus as JobStatus)
    : undefined;
  const isActiveDefault = rawStatus === "active";

  const where = {
    workspaceId: workspace.id,
    ...(statusFilter
      ? { status: statusFilter }
      : isActiveDefault
        ? { status: { in: ["SCHEDULED", "IN_PROGRESS"] as JobStatus[] } }
        : {}),
    ...(clientId && { clientId }),
    ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
    ...(from && { scheduledStart: { gte: new Date(from) } }),
    ...(to && { scheduledStart: { lte: new Date(to) } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { client: { companyName: { contains: q, mode: "insensitive" as const } } },
        { client: { fullName: { contains: q, mode: "insensitive" as const } } },
      ],
    }),
  };

  const jobs = await prisma.job.findMany({
    where,
    include: {
      client: true,
      assignments: { include: { user: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Codru";
  wb.created = new Date();
  const ws = wb.addWorksheet("Jobs");
  ws.columns = [
    { header: "Title", key: "title", width: 32 },
    { header: "Client", key: "client", width: 28 },
    { header: "Status", key: "status", width: 14 },
    { header: "Scheduled start", key: "start", width: 12 },
    { header: "Scheduled end", key: "end", width: 12 },
    { header: "Site", key: "site", width: 32 },
    { header: "Assignees", key: "assignees", width: 24 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Created", key: "created", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const j of jobs) {
    const site = [j.siteStreet, j.siteCity, j.siteZip].filter(Boolean).join(", ");
    ws.addRow({
      title: j.title,
      client: clientDisplayName(j.client),
      status: j.status,
      start: j.scheduledStart ? pragueDateString(j.scheduledStart) : "",
      end: j.scheduledEnd ? pragueDateString(j.scheduledEnd) : "",
      site,
      assignees: j.assignments.map((a) => a.user.name).join(", "),
      notes: j.notes ?? "",
      created: pragueDateString(j.createdAt),
    });
  }

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="jobs-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
