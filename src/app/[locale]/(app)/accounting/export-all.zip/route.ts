import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { buildDocumentsWorkbook } from "@/lib/document-xlsx";
import { buildExpensesWorkbook } from "@/lib/expenses-xlsx";
import { collectDocumentPdfs } from "@/lib/document-pdf-zip";
import type { DocumentType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One bundle can mean dozens of live PDF renders — give it room.
export const maxDuration = 300;

// "Export all to accountant": a single ZIP for a timeframe holding the document
// ledgers (xlsx), every document PDF (archived snapshot preferred), the expense
// ledger, and all receipt files. Everything an účetní needs to close a period.

const DOC_KINDS: { type: DocumentType; folder: string; sheet: string; noun: string }[] = [
  { type: "FINAL_INVOICE", folder: "faktury", sheet: "Faktury", noun: "vydaných faktur" },
  { type: "ADVANCE_INVOICE", folder: "zalohove-faktury", sheet: "Zálohové faktury", noun: "zálohových faktur" },
  { type: "QUOTE", folder: "nabidky", sheet: "Nabídky", noun: "nabídek" },
  { type: "CREDIT_NOTE", folder: "opravne-doklady", sheet: "Opravné doklady", noun: "opravných daňových dokladů" },
];

function extOf(p: string): string {
  const m = p.split("?")[0].match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toLowerCase() : "bin";
}
function sanitize(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}

export async function GET(req: Request) {
  const { workspace } = await requireWorkspace();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const zip = new JSZip();

  // Document ledgers (xlsx) + PDFs, per kind.
  for (const k of DOC_KINDS) {
    const { buffer } = await buildDocumentsWorkbook({
      workspaceId: workspace.id,
      type: k.type,
      from,
      to,
      sheetName: k.sheet,
      titleNoun: k.noun,
    });
    zip.file(`${k.folder}/_seznam-${k.folder}.xlsx`, buffer);

    const pdfs = await collectDocumentPdfs({ workspaceId: workspace.id, type: k.type, from, to });
    for (const f of pdfs) zip.file(`${k.folder}/${f.name}`, f.buffer);
  }

  // Expense ledger (xlsx).
  const expenses = await buildExpensesWorkbook({ workspaceId: workspace.id, from, to });
  zip.file("naklady/_naklady.xlsx", expenses.buffer);

  // Receipt files.
  const date: { gte?: Date; lt?: Date } = {};
  if (from) date.gte = new Date(`${from}T00:00:00`);
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    date.lt = end;
  }
  const receipts = await prisma.expense.findMany({
    where: {
      workspaceId: workspace.id,
      receiptPath: { not: null },
      ...((date.gte || date.lt) && { date }),
    },
    orderBy: { date: "asc" },
    select: { date: true, supplier: true, totalAmount: true, receiptPath: true },
  });
  const usedReceipt = new Set<string>();
  for (const e of receipts) {
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
    while (usedReceipt.has(name)) name = `${d}_${vendor}_${total}Kc-${n++}.${ext}`;
    usedReceipt.add(name);
    zip.file(`uctenky/${name}`, bytes);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const stamp = [from, to].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="ucetnictvi-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}
