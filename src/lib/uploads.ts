import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Storage strategy:
//   - In production (Vercel) the /public directory is read-only at runtime,
//     so writes have to go to Vercel Blob (or any external object store).
//   - In dev we keep writing to /public/uploads so files appear in /uploads
//     URLs without round-tripping to the cloud.
// We pick by env: BLOB_READ_WRITE_TOKEN present → Blob; otherwise → local fs.
// Returned `path`/URL works both as an `<img src>` and `<a href>` in either
// case (relative `/uploads/...` vs absolute `https://...vercel-storage.com/...`).

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 5 * 1024 * 1024; // 5MB for logos/signatures; job attachments (§5.2) use a different ceiling
const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// Exported so other libs (e.g. PDF snapshot writer) can persist bytes via
// the same Blob-or-FS strategy without duplicating the routing logic.
export async function saveBytes({
  key,
  buffer,
  contentType,
}: {
  key: string; // e.g. "jobs/<jobId>/<uuid>.jpg"
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  if (HAS_BLOB) {
    const { put } = await import("@vercel/blob");
    const result = await put(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return result.url;
  }
  const filepath = path.join(UPLOADS_DIR, key);
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, buffer);
  return `/uploads/${key}`;
}

/** Read an uploaded file's bytes. Works for both Blob URLs and local paths. */
export async function readUpload(storedPath: string): Promise<Buffer> {
  if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
    const res = await fetch(storedPath);
    if (!res.ok) throw new Error(`Failed to fetch upload: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const cleaned = storedPath.startsWith("/uploads/") ? storedPath.slice(1) : storedPath;
  const filepath = path.join(process.cwd(), "public", cleaned);
  return fs.readFile(filepath);
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function saveImageUpload({
  file,
  subdir,
}: {
  file: File;
  subdir: "logos" | "signatures" | "letterheads";
}): Promise<string> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 5 MB)");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());
  return saveBytes({
    key: `${subdir}/${crypto.randomUUID()}.${ext}`,
    buffer,
    contentType: file.type,
  });
}

export async function deleteUpload(stored: string | null | undefined) {
  if (!stored) return;
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    if (HAS_BLOB) {
      const { del } = await import("@vercel/blob");
      await del(stored).catch(() => {});
    }
    return;
  }
  if (!stored.startsWith("/uploads/")) return;
  const full = path.join(process.cwd(), "public", stored);
  await fs.unlink(full).catch(() => {});
}

// PRD §5.2: 25 MB per file, 50 files per job enforced in the action, 5 GB per
// account enforced by a separate accounting query (M14 adds the quota check UI).
const JOB_FILE_MAX = 25 * 1024 * 1024;

const JOB_ALLOWED: Record<string, { ext: string; kind: "IMAGE" | "PDF" | "OTHER" }> = {
  "image/png": { ext: "png", kind: "IMAGE" },
  "image/jpeg": { ext: "jpg", kind: "IMAGE" },
  "image/webp": { ext: "webp", kind: "IMAGE" },
  "image/heic": { ext: "heic", kind: "IMAGE" },
  "image/heif": { ext: "heif", kind: "IMAGE" },
  "application/pdf": { ext: "pdf", kind: "PDF" },
};

export async function saveReceiptUpload({ file }: { file: File }): Promise<string> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > JOB_FILE_MAX) throw new Error("File too large (max 25 MB)");

  const meta = JOB_ALLOWED[file.type];
  if (!meta) throw new Error(`Unsupported file type: ${file.type}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  return saveBytes({
    key: `expenses/${crypto.randomUUID()}.${meta.ext}`,
    buffer,
    contentType: file.type,
  });
}

export async function saveImportSessionPdf({
  file,
  sessionId,
  itemId,
}: {
  file: File;
  sessionId: string;
  itemId: string;
}): Promise<{ path: string; mimeType: string; sizeBytes: number }> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF too large (max 20 MB)");
  if (file.type !== "application/pdf") throw new Error("Only PDF files are accepted");

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveBytes({
    key: `import-sessions/${sessionId}/${itemId}.pdf`,
    buffer,
    contentType: file.type,
  });
  return { path: stored, mimeType: file.type, sizeBytes: file.size };
}

export async function saveJobAttachment({
  file,
  jobId,
}: {
  file: File;
  jobId: string;
}): Promise<{
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "IMAGE" | "PDF" | "OTHER";
}> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > JOB_FILE_MAX) throw new Error("File too large (max 25 MB)");

  const meta = JOB_ALLOWED[file.type];
  if (!meta) throw new Error(`Unsupported file type: ${file.type}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveBytes({
    key: `jobs/${jobId}/${crypto.randomUUID()}.${meta.ext}`,
    buffer,
    contentType: file.type,
  });
  return {
    path: stored,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    kind: meta.kind,
  };
}

export async function saveClientAttachment({
  file,
  clientId,
}: {
  file: File;
  clientId: string;
}): Promise<{
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "IMAGE" | "PDF" | "OTHER";
}> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > JOB_FILE_MAX) throw new Error("File too large (max 25 MB)");
  const meta = JOB_ALLOWED[file.type];
  if (!meta) throw new Error(`Unsupported file type: ${file.type}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveBytes({
    key: `clients/${clientId}/${crypto.randomUUID()}.${meta.ext}`,
    buffer,
    contentType: file.type,
  });
  return {
    path: stored,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    kind: meta.kind,
  };
}

export async function saveEventAttachment({
  file,
  eventId,
}: {
  file: File;
  eventId: string;
}): Promise<{
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "IMAGE" | "PDF" | "OTHER";
}> {
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > JOB_FILE_MAX) throw new Error("File too large (max 25 MB)");

  const meta = JOB_ALLOWED[file.type];
  if (!meta) throw new Error(`Unsupported file type: ${file.type}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveBytes({
    key: `events/${eventId}/${crypto.randomUUID()}.${meta.ext}`,
    buffer,
    contentType: file.type,
  });
  return {
    path: stored,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    kind: meta.kind,
  };
}
