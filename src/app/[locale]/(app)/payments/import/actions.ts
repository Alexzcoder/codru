"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { recomputeInvoiceStatus } from "@/lib/payment-status";
import { revalidatePath } from "next/cache";

export type ImportPaymentsState = {
  ok?: boolean;
  inserted?: number;
  matched?: number;
  unmatched?: number;
  errors?: string[];
};

type Row = Record<string, string>;

// Czech bank statement files vary widely. We accept a generic CSV/XLSX with at
// minimum: date, amount, variable_symbol (or VS / KS), counterparty (optional).
// VS is Czech invoice-matching convention — it equals the invoice number's
// digits for our number series, so we use it to auto-allocate.
function pickString(row: Row, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(row: Row, ...keys: string[]): number | null {
  for (const k of keys) {
    const raw = row[k];
    if (raw == null || raw === "") continue;
    // Czech format may use comma as decimal separator and spaces as thousands.
    const cleaned = String(raw).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickDate(row: Row, ...keys: string[]): Date | null {
  for (const k of keys) {
    const raw = row[k];
    if (!raw) continue;
    const s = String(raw).trim();
    // Czech: dd.mm.yyyy
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

async function parseCsv(text: string): Promise<Row[]> {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  // Detect delimiter: ; is common in Czech bank exports, fall back to ,
  const delim = text.split("\n", 1)[0]?.includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQ = true;
    else if (c === delim) {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((v) => v !== "")) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) {
    cur.push(field);
    if (cur.some((v) => v !== "")) rows.push(cur);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Row[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h] = (rows[r][i] ?? "").toString();
    });
    out.push(row);
  }
  return out;
}

async function parseXlsx(buf: Uint8Array): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const headers: string[] = [];
  const rows: Row[] = [];
  sheet.eachRow((row, rowIndex) => {
    const values = row.values as (string | number | Date | null | undefined)[];
    if (rowIndex === 1) {
      values.slice(1).forEach((v, i) => {
        headers[i] = String(v ?? "").trim();
      });
      return;
    }
    const obj: Row = {};
    headers.forEach((h, i) => {
      const cell = values[i + 1];
      obj[h] = cell == null ? "" : cell instanceof Date ? cell.toISOString() : String(cell);
    });
    rows.push(obj);
  });
  return rows;
}

export async function importPayments(
  _prev: ImportPaymentsState,
  formData: FormData,
): Promise<ImportPaymentsState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: ["Pick a .csv or .xlsx file."] };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, errors: ["Max 10 MB."] };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Row[];
  try {
    if (file.name.toLowerCase().endsWith(".xlsx") || file.type.includes("spreadsheet")) {
      rows = await parseXlsx(new Uint8Array(buf));
    } else {
      rows = await parseCsv(buf.toString("utf-8"));
    }
  } catch (e) {
    return { ok: false, errors: [`Parse failed: ${e instanceof Error ? e.message : "unknown"}`] };
  }

  if (rows.length === 0) {
    return { ok: false, errors: ["File is empty or has no data rows."] };
  }

  const errors: string[] = [];
  let inserted = 0;
  let matched = 0;
  let unmatched = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;
    const amount = pickNumber(row, "amount", "Amount", "Částka", "částka", "Zauctovana_castka");
    const date =
      pickDate(row, "date", "Date", "Datum", "Datum_provedeni") ?? new Date();
    if (amount == null || amount <= 0) {
      // Outgoing rows (negative or zero) are skipped — we're tracking client receipts.
      continue;
    }
    const vs = pickString(
      row,
      "variableSymbol",
      "VariableSymbol",
      "VS",
      "Variabilni_symbol",
      "Variabilní symbol",
      "Variabilni",
    );
    const reference = pickString(row, "reference", "Reference", "Zprava_pro_prijemce", "note", "Poznámka");
    const counterparty = pickString(
      row,
      "counterparty",
      "Counterparty",
      "Nazev_protiuctu",
      "Protiuc",
      "Plátce",
    );

    // Try to match an open invoice by VS = number (gapless numbering uses
    // digits-only series). Fall back: leave unallocated (operator can edit later).
    let matchedDocId: string | null = null;
    let matchedClientId: string | null = null;
    if (vs) {
      const doc = await prisma.document.findFirst({
        where: {
          number: { contains: vs },
          type: { in: ["FINAL_INVOICE", "ADVANCE_INVOICE"] },
          deletedAt: null,
          status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        },
      });
      if (doc) {
        matchedDocId = doc.id;
        matchedClientId = doc.clientId;
      }
    }

    if (!matchedClientId) {
      unmatched++;
      errors.push(
        `Row ${rowNo}: VS=${vs ?? "(none)"} amount=${amount} — no matching open invoice. Skipped.`,
      );
      continue;
    }

    try {
      const payment = await prisma.payment.create({
        data: {
          clientId: matchedClientId,
          date,
          method: "BANK_TRANSFER",
          amount: amount.toFixed(2),
          currency: "CZK",
          reference: vs ? `VS ${vs}${counterparty ? ` · ${counterparty}` : ""}` : reference,
          notes: counterparty ?? null,
          loggedById: user.id,
          ...(matchedDocId
            ? {
                allocations: {
                  create: [
                    { documentId: matchedDocId, amount: amount.toFixed(2) },
                  ],
                },
              }
            : {}),
        },
      });
      inserted++;
      if (matchedDocId) {
        matched++;
        await recomputeInvoiceStatus(matchedDocId);
      }
      await writeAudit({
        actorId: user.id,
        entity: "Payment",
        entityId: payment.id,
        action: "create",
        after: { source: "bank-statement-import" } as unknown as Record<string, unknown>,
      });
    } catch (e) {
      errors.push(`Row ${rowNo}: ${e instanceof Error ? e.message : "create failed"}`);
    }
  }

  revalidatePath("/payments");
  revalidatePath("/final-invoices");
  revalidatePath("/advance-invoices");
  return {
    ok: true,
    inserted,
    matched,
    unmatched,
    errors: errors.slice(0, 20),
  };
}
