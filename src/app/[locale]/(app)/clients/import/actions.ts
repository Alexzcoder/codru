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

// Czech business-form suffixes that flag a row as a company even when only
// a generic "Name" column is provided. Match is case-insensitive and word-
// bounded so "Spolanová" doesn't trip "spol".
const COMPANY_SUFFIXES = [
  "s.r.o.",
  "sro",
  "a.s.",
  "as",
  "spol.",
  "k.s.",
  "v.o.s.",
  "z.s.",
  "z.ú.",
  "o.p.s.",
  "s.e.",
  "ltd",
  "ltd.",
  "llc",
  "inc.",
  "inc",
  "gmbh",
];

function looksLikeCompany(name: string): boolean {
  const lower = name.toLowerCase();
  return COMPANY_SUFFIXES.some((s) =>
    new RegExp(`(^|\\s|,)${s.replace(/\./g, "\\.")}(\\s|$|,)`).test(lower),
  );
}

function inferType(row: Row): "INDIVIDUAL" | "COMPANY" {
  const explicit = pickString(row, "type", "Type")?.toUpperCase();
  if (explicit === "COMPANY" || explicit === "INDIVIDUAL") return explicit;
  if (pickString(row, "companyName", "company")) return "COMPANY";
  // Combined "Name" column: detect company by suffix.
  const name = pickString(row, "Name", "name");
  if (name && looksLikeCompany(name)) return "COMPANY";
  return "INDIVIDUAL";
}

// Parse Czech-style combined address "<street>, <zip> <city>" or
// "<street>, <city>". ZIP is 5 digits, may include a space ("198 00").
// Anything we can't confidently parse stays in `street` so it's not lost.
type ParsedAddress = {
  street: string | null;
  city: string | null;
  zip: string | null;
};
function parseCombinedAddress(input: string): ParsedAddress {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return { street: null, city: null, zip: null };

  // Split on the LAST comma so multi-comma streets ("Park, vchod 2, ...") work.
  const lastComma = trimmed.lastIndexOf(",");
  if (lastComma < 0) return { street: trimmed, city: null, zip: null };

  const street = trimmed.slice(0, lastComma).trim();
  const tail = trimmed.slice(lastComma + 1).trim();

  // Try "<zip> <city>" with 5-digit zip (optional space at position 3).
  const m = tail.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  if (m) {
    return {
      street: street || null,
      zip: m[1].replace(/\s+/g, ""),
      city: m[2].trim() || null,
    };
  }
  // Try "<city> <zip>" (zip at end).
  const m2 = tail.match(/^(.+?)\s+(\d{3}\s?\d{2})$/);
  if (m2) {
    return {
      street: street || null,
      city: m2[1].trim() || null,
      zip: m2[2].replace(/\s+/g, ""),
    };
  }
  // No zip — tail is the city.
  return { street: street || null, city: tail || null, zip: null };
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
    // Combined "Name" column (Raynet-style export) routes to companyName or
    // fullName based on suffix detection; explicit columns still win.
    const explicitCompanyName = pickString(row, "companyName", "Company name", "company", "Firma");
    const explicitFullName = pickString(row, "fullName", "Full name", "Jméno");
    const combinedName = pickString(row, "Name", "name");
    let companyName = explicitCompanyName;
    let fullName = explicitFullName;
    if (!companyName && !fullName && combinedName) {
      if (looksLikeCompany(combinedName)) companyName = combinedName;
      else fullName = combinedName;
    }
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

    // Address: prefer explicit street/city/zip columns; fall back to parsing
    // a combined "Address" column (typical Raynet export shape).
    let addressStreet = pickString(row, "street", "addressStreet", "Ulice");
    let addressCity = pickString(row, "city", "addressCity", "Město");
    let addressZip = pickString(row, "zip", "addressZip", "PSČ");
    const combinedAddress = pickString(row, "address", "Address", "Adresa");
    if (combinedAddress && (!addressStreet || !addressCity)) {
      const parsed = parseCombinedAddress(combinedAddress);
      addressStreet = addressStreet ?? parsed.street;
      addressCity = addressCity ?? parsed.city;
      addressZip = addressZip ?? parsed.zip;
    }

    // Notes: append "Source: Raynet CRM" / "Notes: ..." in a stable shape so
    // re-imports don't duplicate.
    const sourceTag = pickString(row, "source", "Source", "Zdroj");
    const rawNotes = pickString(row, "notes", "Notes", "Poznámky");
    const notes = [
      rawNotes,
      sourceTag ? `[Source: ${sourceTag}]` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

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
          addressStreet,
          addressCity,
          addressZip,
          addressCountry: pickString(row, "country", "addressCountry", "Země") ?? "CZ",
          defaultLanguage:
            (pickString(row, "defaultLanguage", "language") === "en" ? "en" : "cs"),
          preferredCurrency:
            pickString(row, "preferredCurrency", "currency") ?? "CZK",
          notes,
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
