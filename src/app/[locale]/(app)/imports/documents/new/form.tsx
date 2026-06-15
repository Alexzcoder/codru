"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CreateSessionState } from "../actions";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const fileInputCls = `${inputCls} cursor-pointer file:cursor-pointer`;

const MAX_FILES = 25;

export function NewSessionForm({
  action,
}: {
  action: (
    prev: CreateSessionState,
    formData: FormData,
  ) => Promise<CreateSessionState>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [costCap, setCostCap] = useState("5");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const totalMb = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
  const tooMany = files.length > MAX_FILES;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError("Pick at least one PDF.");
      return;
    }
    if (tooMany) {
      setError(`Max ${MAX_FILES} PDFs per session.`);
      return;
    }
    setBusy(true);
    setUploaded(0);
    try {
      // Upload each PDF straight to Blob storage from the browser — never
      // through a server action body (which capped out and crashed past ~5).
      const blobs: { url: string; filename: string; size: number }[] = [];
      for (const file of files) {
        const result = await upload(`imports/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/import-upload",
          contentType: "application/pdf",
        });
        blobs.push({ url: result.url, filename: file.name, size: file.size });
        setUploaded((n) => n + 1);
      }

      const fd = new FormData();
      fd.set("blobs", JSON.stringify(blobs));
      fd.set("costCapUsd", costCap);
      const res = await action({}, fd); // redirects on success
      if (res?.error) {
        setError(res.error);
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please retry.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">PDFs</Label>
        <input
          id="file"
          type="file"
          name="file"
          accept="application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setError(null);
          }}
          className={fileInputCls}
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {files.length} {files.length === 1 ? "file" : "files"} selected,{" "}
            {totalMb.toFixed(1)} MB total. Estimated cost ~$
            {(files.length * 0.06).toFixed(2)} on Sonnet.
            {tooMany && (
              <span className="text-red-600"> · Max {MAX_FILES} per session.</span>
            )}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="costCapUsd">Cost cap (USD)</Label>
        <input
          id="costCapUsd"
          name="costCapUsd"
          type="number"
          min={0.5}
          max={50}
          step={0.5}
          value={costCap}
          onChange={(e) => setCostCap(e.target.value)}
          disabled={busy}
          className={`${inputCls} w-32`}
        />
        <p className="text-[11px] text-muted-foreground">
          Parsing stops once the running total crosses this. Default $5.
        </p>
      </div>

      <Button type="submit" disabled={busy || files.length === 0 || tooMany}>
        {busy
          ? files.length
            ? `Uploading ${uploaded}/${files.length}…`
            : "Uploading…"
          : "Upload & start"}
      </Button>

      {busy && (
        <p className="text-xs text-muted-foreground">
          Uploading your PDFs… you&apos;ll be taken to the review page, where they
          parse one by one.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
