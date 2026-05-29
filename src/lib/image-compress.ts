"use client";

// Client-side image downscale + re-encode, so phone photos (often 5–12 MB)
// become ~0.3–1 MB before they ever hit a Server Action. This is what makes
// "the picture is too big to upload" go away on mobile, and it keeps payloads
// well under the body-size ceiling configured in next.config.ts.
//
// Only raster images the browser can decode are touched. PDFs and formats a
// canvas can't decode (e.g. HEIC/HEIF on most browsers) are returned
// unchanged — the server still accepts them, just without shrinking.

const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CompressOptions = {
  /** Longest-edge cap in pixels. Photos beyond this are scaled down. */
  maxEdge?: number;
  /** JPEG/WebP quality, 0–1. */
  quality?: number;
  /** Only bother compressing files larger than this many bytes. */
  minBytes?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 2400,
  quality: 0.82,
  minBytes: 600 * 1024, // leave small images alone
};

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return img;
  } finally {
    // Revoke after decode; the bitmap/image keeps the pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Compress a single file. Returns the original File untouched when it isn't a
 * compressible image, is already small, or anything goes wrong (so uploads
 * never break because of compression).
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };
  if (!COMPRESSIBLE.has(file.type)) return file;
  if (file.size <= opts.minBytes) return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await loadBitmap(file);
    const w = "width" in bitmap ? bitmap.width : 0;
    const h = "height" in bitmap ? bitmap.height : 0;
    if (!w || !h) return file;

    const scale = Math.min(1, opts.maxEdge / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    // PNGs may carry transparency; keep them PNG. Everything else → JPEG.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, opts.quality),
    );
    if (!blob || blob.size >= file.size) return file; // no win → keep original

    const ext = outType === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: file.lastModified,
    });
  } catch {
    return file; // never let compression block an upload
  }
}

/** Compress every file in a list, preserving order. */
export async function compressImages(
  files: File[],
  options: CompressOptions = {},
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}

/**
 * Build a FileList-compatible object from Files, suitable for assigning to an
 * <input type="file">.files before form submission.
 */
export function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt.files;
}
