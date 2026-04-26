// Server-side helper: read a job's IMAGE attachments off disk and return them
// as base64 SitePhoto records, ready to seed the line-items editor's AI photo
// state. Capped at 4 to keep the page payload (and the Claude bill) small.

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { SitePhoto } from "@/components/price-suggester";

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;

function inferMediaType(mimeType: string, filename: string): SitePhoto["mediaType"] | null {
  const lower = (mimeType || "").toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "image/jpeg";
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("gif")) return "image/gif";
  // Fall back to the filename extension — phones sometimes give us octet-stream.
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

export async function loadJobSitePhotos(jobId: string): Promise<SitePhoto[]> {
  const attachments = await prisma.attachment.findMany({
    where: { jobId, kind: "IMAGE", sizeBytes: { lte: MAX_BYTES } },
    orderBy: { createdAt: "desc" },
    take: MAX_PHOTOS,
  });
  const out: SitePhoto[] = [];
  for (const a of attachments) {
    const mediaType = inferMediaType(a.mimeType, a.filename);
    if (!mediaType) continue;
    // Attachment.path is "/uploads/jobs/<id>/<file>" — resolve under public/.
    const rel = a.path.startsWith("/") ? a.path.slice(1) : a.path;
    const abs = path.join(process.cwd(), "public", rel);
    try {
      const buf = await fs.readFile(abs);
      out.push({
        name: a.filename,
        mediaType,
        base64: buf.toString("base64"),
        previewUrl: a.path,
      });
    } catch {
      // File missing — skip silently. The Files panel will surface the error.
    }
  }
  return out;
}
