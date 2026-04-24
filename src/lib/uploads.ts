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
  subdir: "logos" | "signatures";
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
