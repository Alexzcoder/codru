"use client";

import { useActionState, useRef, useEffect, useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  uploadClientAttachment,
  deleteClientAttachment,
  type ClientAttachmentState,
} from "./attachment-actions";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors cursor-pointer file:cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Attachment = {
  id: string;
  filename: string;
  path: string;
  kind: "IMAGE" | "PDF" | "OTHER";
  caption: string | null;
  sizeBytes: number;
  createdAt: string; // ISO
};

export function ClientAttachments({
  clientId,
  attachments,
}: {
  clientId: string;
  attachments: Attachment[];
}) {
  const bound = uploadClientAttachment.bind(null, clientId);
  const [state, formAction, pending] = useActionState<ClientAttachmentState, FormData>(
    bound,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.uploadedCount && !pending) ref.current?.reset();
  }, [state, pending]);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">Files</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Attach quotes, invoices, or other documents directly to this client.
        PDFs and images up to 25 MB.
      </p>

      <form
        ref={ref}
        action={formAction}
        className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
      >
        <div className="flex-1 min-w-[220px]">
          <input
            type="file"
            name="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
            required
            className={inputCls}
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            name="caption"
            placeholder='Caption (e.g. "Cenová nabídka — 2024 jaro")'
            className={inputCls.replace("cursor-pointer file:cursor-pointer", "")}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.uploadedCount && state.uploadedCount > 0 && (
          <span className="text-xs text-green-700">
            {state.uploadedCount === 1
              ? "1 file uploaded"
              : `${state.uploadedCount} files uploaded`}
          </span>
        )}
      </form>

      {attachments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {attachments.map((a) => (
            <AttachmentTile key={a.id} a={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentTile({ a }: { a: Attachment }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete "${a.filename}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteClientAttachment(a.id);
      if (res.error) setError(res.error);
    });
  }

  const sizeKb = Math.max(1, Math.round(a.sizeBytes / 1024));
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {a.kind === "IMAGE" ? (
        <a href={a.path} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.path}
            alt={a.filename}
            className="h-32 w-full object-cover"
          />
        </a>
      ) : (
        <a
          href={a.path}
          target="_blank"
          rel="noreferrer"
          className="flex h-32 items-center justify-center bg-secondary/40 text-3xl"
          title={a.filename}
        >
          📄
        </a>
      )}
      <div className="p-2 text-xs">
        <p className="truncate font-medium" title={a.filename}>
          {a.filename}
        </p>
        {a.caption && (
          <p className="truncate text-muted-foreground" title={a.caption}>
            {a.caption}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {sizeKb} KB · {new Date(a.createdAt).toISOString().slice(0, 10)}
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="mt-1 cursor-pointer text-[11px] text-red-600 hover:underline disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    </li>
  );
}
