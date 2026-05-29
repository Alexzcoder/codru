"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { compressImages, filesToFileList } from "@/lib/image-compress";
import { uploadAttachment, type AttachmentState } from "../actions";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors cursor-pointer file:cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf";

export function AttachmentUploader({ jobId }: { jobId: string }) {
  const locale = useLocale();
  const cs = locale === "cs";
  const bound = uploadAttachment.bind(null, jobId);
  const [state, formAction, pending] = useActionState<AttachmentState, FormData>(
    bound,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<number>(0);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (!state.error && !pending) {
      ref.current?.reset();
      setPicked(0);
    }
  }, [state, pending]);

  // Downscale large photos in the browser before the form is submitted, then
  // write the smaller files back onto the input so the Server Action receives
  // them. Keeps phone photos under the upload ceiling.
  const onFiles = async (files: FileList | null) => {
    if (!files || !fileRef.current || files.length === 0) return;
    setCompressing(true);
    try {
      const compressed = await compressImages(Array.from(files));
      fileRef.current.files = filesToFileList(compressed);
      setPicked(compressed.length);
    } finally {
      setCompressing(false);
    }
  };

  return (
    <form
      ref={ref}
      action={formAction}
      className="space-y-3 rounded-xl border border-border bg-card shadow-sm p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(e.dataTransfer.files);
      }}
    >
      <label
        htmlFor={`file-${jobId}`}
        className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input bg-secondary/20 px-4 py-6 text-center text-sm cursor-pointer hover:bg-secondary/40 transition-colors"
      >
        <Upload size={18} className="text-muted-foreground" />
        <span className="font-medium">
          {cs
            ? "Vyberte fotografie nebo PDF (více najednou)"
            : "Pick photos or PDFs (multiple at once)"}
        </span>
        <span className="text-xs text-muted-foreground">
          {cs
            ? "Můžete označit více souborů (Ctrl/Cmd+klik) nebo je sem přetáhnout."
            : "Hold Ctrl/Cmd to select several, or drag and drop them here."}
        </span>
        {picked > 0 && (
          <span className="text-xs text-emerald-700 font-medium">
            {cs ? `Vybráno souborů: ${picked}` : `${picked} file(s) selected`}
          </span>
        )}
        <input
          id={`file-${jobId}`}
          ref={fileRef}
          type="file"
          name="file"
          multiple
          accept={ACCEPT}
          required
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            name="caption"
            placeholder={
              cs
                ? "Popisek (nepovinný, použije se na všechny soubory)"
                : "Caption (optional, applied to every file)"
            }
            className={inputCls}
          />
        </div>
        <Button type="submit" disabled={pending || compressing} size="sm">
          {compressing
            ? cs
              ? "Připravuji…"
              : "Preparing…"
            : pending
              ? cs
                ? "Nahrávám…"
                : "Uploading…"
              : cs
                ? "Nahrát"
                : "Upload"}
        </Button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.uploadedCount && state.uploadedCount > 0 && (
          <span className="text-xs text-green-700">
            {cs
              ? state.uploadedCount === 1
                ? "1 soubor nahrán"
                : `${state.uploadedCount} souborů nahráno`
              : state.uploadedCount === 1
                ? "1 file uploaded"
                : `${state.uploadedCount} files uploaded`}
          </span>
        )}
      </div>
    </form>
  );
}
