import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Local-disk upload helper for dev. Will swap to S3-compatible storage at deploy
// time. Paths are stored relative to /public/uploads so the browser can fetch them
// directly without a route handler.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 5 * 1024 * 1024; // 5MB for logos/signatures; job attachments (§5.2) use a different ceiling

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

  const dir = path.join(UPLOADS_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });

  const name = `${crypto.randomUUID()}.${ext}`;
  const filepath = path.join(dir, name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/${subdir}/${name}`;
}

export async function deleteUpload(relPath: string | null | undefined) {
  if (!relPath || !relPath.startsWith("/uploads/")) return;
  const full = path.join(process.cwd(), "public", relPath);
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

  const dir = path.join(UPLOADS_DIR, "expenses");
  await fs.mkdir(dir, { recursive: true });

  const name = `${crypto.randomUUID()}.${meta.ext}`;
  const filepath = path.join(dir, name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/expenses/${name}`;
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

  const dir = path.join(UPLOADS_DIR, "jobs", jobId);
  await fs.mkdir(dir, { recursive: true });

  const name = `${crypto.randomUUID()}.${meta.ext}`;
  const filepath = path.join(dir, name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return {
    path: `/uploads/jobs/${jobId}/${name}`,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    kind: meta.kind,
  };
}
