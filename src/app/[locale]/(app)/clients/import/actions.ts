"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ImportClientsState = {
  ok?: boolean;
  inserted?: number;
  skipped?: number;
  jobsInserted?: number;
  errors?: string[];
  preview?: PreviewRow[];
  dryRun?: boolean;
};

export type PreviewRow = {
  rowNo: number;
  status: "would_create" | "would_skip" | "error";
  client: string;        // display name
  ico: string | null;
  email: string | null;
  job: string | null;    // job title or null
  reason: string | null; // why skipped / error
};

type Row = Record<string, string>;

const REQUIRED_FIELD_HINT = "Each row must have either 'companyName' or 'fullName'.";

function pickString(row: Row, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function inferType(row: Row): "INDIVIDUAL" | "COMPANY" {
  const explicit = pickString(row, "type", "Type")?.toUpperCase();
  if (explicit === "COMPANY" || explicit === "INDIVIDUAL") return explicit;
  return pickString(row, "companyName", "company") ? "COMPANY" : "INDIVIDUAL";
}

async function parseCsv(text: string): Promise<Row[]> {
  // Tiny CSV parser that handles quoted fields with embedded commas/newlines.
  const out: Row[] = [];
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
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
    if (c === '"') {
      inQ = true;
    } else if (c === ",") {
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
  if (rows.length === 0) return out;
  const headers = rows[0].map((h) => h.trim());
  for (let r = 1; r < rows.length; r++) {
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = (rows[r][idx] ?? "").toString();
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
    const values = row.values as (string | number | null | undefined)[];
    // exceljs rows are 1-indexed and `values` has a leading null at [0].
    if (rowIndex === 1) {
      values.slice(1).forEach((v, i) => {
        headers[i] = String(v ?? "").trim();
      });
      return;
    }
    const obj: Row = {};
    headers.forEach((h, i) => {
      const cell = values[i + 1];
      obj[h] = cell == null ? "" : String(cell);
    });
    rows.push(obj);
  });
  return rows;
}

export async function importClients(
  _prev: ImportClientsState,
  formData: FormData,
): Promise<ImportClientsState> {
  const { user, workspace } = await requireWorkspace();
  const file = formData.get("file");
  const dryRun = formData.get("dryRun") === "on";
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
  const preview: PreviewRow[] = [];
  let inserted = 0;
  let skipped = 0;
  let jobsInserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2; // +1 for 1-index, +1 for header
    const companyName = pickString(row, "companyName", "Company name", "company", "Firma");
    const fullName = pickString(row, "fullName", "Full name", "name", "Jméno");
    const jobTitle = pickString(row, "jobTitle", "Job", "Zakázka", "Job title");

    if (!companyName && !fullName) {
      errors.push(`Row ${rowNo}: ${REQUIRED_FIELD_HINT}`);
      preview.push({
        rowNo,
        status: "error",
        client: "—",
        ico: null,
        email: null,
        job: jobTitle,
        reason: REQUIRED_FIELD_HINT,
      });
      skipped++;
      continue;
    }
    const type = inferType(row);
    const ico = pickString(row, "ico", "IČO");
    const email = pickString(row, "email", "Email", "E-mail")?.toLowerCase();
    const displayName = (companyName ?? fullName ?? "—") as string;

    // Dedup by IČO (companies) or email (individuals). Skip silently — caller
    // can re-export to verify.
    if (ico) {
      const dup = await prisma.client.findFirst({ where: { workspaceId: workspace.id, ico, deletedAt: null } });
      if (dup) {
        preview.push({
          rowNo,
          status: "would_skip",
          client: displayName,
          ico,
          email: email ?? null,
          job: jobTitle,
          reason: "Already exists (same IČO)",
        });
        skipped++;
        continue;
      }
    } else if (email) {
      const dup = await prisma.client.findFirst({ where: { workspaceId: workspace.id, email, deletedAt: null } });
      if (dup) {
        preview.push({
          rowNo,
          status: "would_skip",
          client: displayName,
          ico: null,
          email,
          job: jobTitle,
          reason: "Already exists (same email)",
        });
        skipped++;
        continue;
      }
    }

    // Dry-run path: record what we WOULD do and continue without writing.
    if (dryRun) {
      preview.push({
        rowNo,
        status: "would_create",
        client: displayName,
        ico,
        email: email ?? null,
        job: jobTitle,
        reason: null,
      });
      inserted++;
      if (jobTitle) jobsInserted++;
      continue;
    }

    try {
      const created = await prisma.client.create({
        data: {
          workspaceId: workspace.id,
          type,
          status: "POTENTIAL",
          companyName: type === "COMPANY" ? companyName : null,
          fullName: type === "INDIVIDUAL" ? fullName ?? companyName! : null,
          ico,
          dic: pickString(row, "dic", "DIČ"),
          email: email ?? null,
          phone: pickString(row, "phone", "Phone", "Telefon"),
          addressStreet: pickString(row, "street", "addressStreet", "Ulice"),
          addressCity: pickString(row, "city", "addressCity", "Město"),
          addressZip: pickString(row, "zip", "addressZip", "PSČ"),
          addressCountry: pickString(row, "country", "addressCountry", "Země") ?? "CZ",
          defaultLanguage:
            (pickString(row, "defaultLanguage", "language") === "en" ? "en" : "cs"),
          preferredCurrency:
            pickString(row, "preferredCurrency", "currency") ?? "CZK",
          notes: pickString(row, "notes", "Poznámky"),
        },
      });
      inserted++;
      await writeAudit({
        workspaceId: workspace.id,
        actorId: user.id,
        entity: "Client",
        entityId: created.id,
        action: "create",
        after: { source: "import" } as unknown as Record<string, unknown>,
      });

      // Optional job creation — only if a jobTitle column was filled. We
      // copy the client's address as the site address by default; the user
      // can override via siteStreet / siteCity / siteZip columns.
      if (jobTitle) {
        try {
          const job = await prisma.job.create({
            data: {
              workspaceId: workspace.id,
              clientId: created.id,
              title: jobTitle,
              status: jobStatusFrom(pickString(row, "jobStatus", "Job status", "Stav")),
              siteStreet: pickString(row, "siteStreet", "Site street") ?? created.addressStreet,
              siteCity: pickString(row, "siteCity", "Site city") ?? created.addressCity,
              siteZip: pickString(row, "siteZip", "Site ZIP") ?? created.addressZip,
              siteCountry: pickString(row, "siteCountry", "Site country") ?? created.addressCountry,
              notes: pickString(row, "jobNotes", "Job notes"),
            },
          });
          jobsInserted++;
          await writeAudit({
            workspaceId: workspace.id,
            actorId: user.id,
            entity: "Job",
            entityId: job.id,
            action: "create",
            after: { source: "import" } as unknown as Record<string, unknown>,
          });
        } catch (e) {
          errors.push(`Row ${rowNo} (job): ${e instanceof Error ? e.message : "create failed"}`);
        }
      }

      preview.push({
        rowNo,
        status: "would_create",
        client: displayName,
        ico,
        email: email ?? null,
        job: jobTitle,
        reason: null,
      });
    } catch (e) {
      errors.push(`Row ${rowNo}: ${e instanceof Error ? e.message : "create failed"}`);
      preview.push({
        rowNo,
        status: "error",
        client: displayName,
        ico,
        email: email ?? null,
        job: jobTitle,
        reason: e instanceof Error ? e.message : "create failed",
      });
      skipped++;
    }
  }

  if (!dryRun) revalidatePath("/clients");
  return {
    ok: true,
    inserted,
    skipped,
    jobsInserted,
    errors: errors.slice(0, 20),
    preview: preview.slice(0, 200),
    dryRun,
  };
}

function jobStatusFrom(s: string | null) {
  const allowed = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
  if (!s) return "SCHEDULED" as const;
  const normalized = s.toUpperCase().replace(/\s+/g, "_");
  // Tolerate the user typing "DONE" — map to COMPLETED.
  const mapped = normalized === "DONE" ? "COMPLETED" : normalized;
  return (allowed as readonly string[]).includes(mapped)
    ? (mapped as (typeof allowed)[number])
    : ("SCHEDULED" as const);
}
