import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function extOf(p: string): string {
  const clean = p.split("?")[0];
  const m = clean.match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toLowerCase() : "bin";
}
function sanitize(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());

  const date: { gte?: Date; lt?: Date } = {};
  if (sp.from) date.gte = new Date(`${sp.from}T00:00:00`);
  if (sp.to) {
    const end = new Date(`${sp.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    date.lt = end;
  }

  const expenses = await prisma.expense.findMany({
    where: {
      workspaceId: workspace.id,
      receiptPath: { not: null },
      ...((date.gte || date.lt) && { date }),
      ...(sp.categoryId && { categoryId: sp.categoryId }),
      ...(sp.jobId && { jobId: sp.jobId }),
    },
    orderBy: { date: "asc" },
    select: { date: true, supplier: true, totalAmount: true, receiptPath: true },
  });

  const zip = new JSZip();
  const used = new Set<string>();
  let count = 0;
  for (const e of expenses) {
    if (!e.receiptPath) continue;
    let bytes: Buffer;
    try {
      bytes = await readUpload(e.receiptPath);
    } catch {
      continue;
    }
    const d = e.date.toISOString().slice(0, 10);
    const vendor = sanitize(e.supplier ?? "uctenka");
    const total = Math.round(Number(e.totalAmount.toString()));
    const ext = extOf(e.receiptPath);
    let name = `${d}_${vendor}_${total}Kc.${ext}`;
    let n = 2;
    while (used.has(name)) name = `${d}_${vendor}_${total}Kc-${n++}.${ext}`;
    used.add(name);
    zip.file(name, bytes);
    count++;
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const stamp = [sp.from, sp.to].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="uctenky-${stamp}.zip"`,
      "cache-control": "no-store",
      "x-receipt-count": String(count),
    },
  });
}
