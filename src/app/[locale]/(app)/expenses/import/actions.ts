"use server";

import Decimal from "decimal.js";
import { requireWorkspace } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/uploads";
import { scanReceiptWithClaude } from "@/lib/ai/receipt-scan";
import { checkDailyCap, logAiCall } from "@/lib/ai/audit";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ImportReceiptResult =
  | { ok: true; expenseId: string; supplier: string | null; total: string; date: string }
  | { ok: false; reason: "rate-limit" | "no-key" | "unsupported" | "error"; message: string };

type Media = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function mediaTypeFromUrl(url: string): Media | null {
  const ext = url.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null; // pdf / unknown — can't vision-scan a literal receipt here
}

// Czech VAT rates the app uses: 0 / 12 / 21. Map the old 15 -> 12; default 21.
function normRate(r: number | null): number {
  if (r === 0) return 0;
  if (r === 12 || r === 15) return 12;
  if (r === 21) return 21;
  return 21;
}

function computeAmounts(
  scan: { totalAmount: number | null; netAmount: number | null; vatAmount: number | null },
  rate: number,
): { net: string; vat: string; total: string } {
  const D = (x: number) => new Decimal(x);
  let total = scan.totalAmount != null ? D(scan.totalAmount) : null;
  let net = scan.netAmount != null ? D(scan.netAmount) : null;
  let vat = scan.vatAmount != null ? D(scan.vatAmount) : null;
  const factor = new Decimal(1).plus(new Decimal(rate).div(100));
  if (net == null && total != null) net = rate > 0 ? total.div(factor) : total;
  if (net == null) net = new Decimal(0);
  if (vat == null) vat = net.mul(rate).div(100);
  if (total == null) total = net.plus(vat);
  return {
    net: net.toDecimalPlaces(2).toFixed(2),
    vat: vat.toDecimalPlaces(2).toFixed(2),
    total: total.toDecimalPlaces(2).toFixed(2),
  };
}

async function defaultCategoryId(workspaceId: string): Promise<string> {
  const existing =
    (await prisma.expenseCategory.findFirst({
      where: { workspaceId, archivedAt: null, name: { in: ["Nezařazeno", "Ostatní", "Uncategorized"] } },
      select: { id: true },
    })) ??
    (await prisma.expenseCategory.findFirst({
      where: { workspaceId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  if (existing) return existing.id;
  const created = await prisma.expenseCategory.create({
    data: { workspaceId, name: "Nezařazeno" },
    select: { id: true },
  });
  return created.id;
}

/**
 * Scan ONE uploaded receipt image and create an Expense from it. Called once per
 * receipt from the bulk-import page (its own short request — no body limit, no
 * cumulative timeout). Idempotent on receiptPath.
 */
export async function importReceiptAsExpense(
  blobUrl: string,
  filename: string,
): Promise<ImportReceiptResult> {
  const { user, workspace } = await requireWorkspace();

  // Idempotency — don't create a second expense for the same uploaded file.
  const dup = await prisma.expense.findFirst({
    where: { workspaceId: workspace.id, receiptPath: blobUrl },
    select: { id: true, supplier: true, totalAmount: true, date: true },
  });
  if (dup) {
    return {
      ok: true,
      expenseId: dup.id,
      supplier: dup.supplier,
      total: dup.totalAmount.toString(),
      date: dup.date.toISOString().slice(0, 10),
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no-key", message: "ANTHROPIC_API_KEY is not set." };
  }
  const media = mediaTypeFromUrl(blobUrl);
  if (!media) {
    return { ok: false, reason: "unsupported", message: "Only image receipts (jpg/png/webp) can be auto-scanned." };
  }
  const cap = await checkDailyCap(user.id);
  if (!cap.ok) {
    return { ok: false, reason: "rate-limit", message: `Daily AI call limit reached (${cap.callsToday}/${cap.cap}).` };
  }

  const t0 = Date.now();
  let scan;
  try {
    const buf = await readUpload(blobUrl);
    scan = await scanReceiptWithClaude({ mediaType: media, base64: buf.toString("base64") });
    await logAiCall({
      userId: user.id,
      feature: "receipt-scan",
      usage: {
        inputTokens: scan.inputTokens,
        outputTokens: scan.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: scan.estimatedCostUsd,
      },
      durationMs: Date.now() - t0,
      ok: true,
    });
  } catch (e) {
    await logAiCall({
      userId: user.id,
      feature: "receipt-scan",
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 },
      durationMs: Date.now() - t0,
      ok: false,
      errorMessage: e instanceof Error ? e.message : "scan failed",
    });
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : "scan failed" };
  }

  const rate = normRate(scan.vatRatePercent);
  const amounts = computeAmounts(scan, rate);
  const categoryId = await defaultCategoryId(workspace.id);
  const date =
    scan.date && /^\d{4}-\d{2}-\d{2}$/.test(scan.date) ? new Date(scan.date) : new Date();

  const expense = await prisma.expense.create({
    data: {
      workspaceId: workspace.id,
      date,
      categoryId,
      supplier: scan.supplier || null,
      description: scan.description || filename || "Účtenka",
      netAmount: amounts.net,
      vatRatePercent: rate,
      vatAmount: amounts.vat,
      totalAmount: amounts.total,
      currency: "CZK",
      receiptPath: blobUrl,
      createdById: user.id,
      notes: "Automaticky naskenováno z účtenky – zkontrolujte částky a kategorii.",
    },
    select: { id: true },
  });

  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    entity: "Expense",
    entityId: expense.id,
    action: "create",
    after: { source: "receipt-import" } as unknown as Record<string, unknown>,
  });

  revalidatePath("/expenses");
  return {
    ok: true,
    expenseId: expense.id,
    supplier: scan.supplier,
    total: amounts.total,
    date: date.toISOString().slice(0, 10),
  };
}
