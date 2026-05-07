"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { uploadAttachment, type AttachmentState } from "../actions";

// Native <input> + <input> for caption — base-ui's <Input> wrapper drops
// the `name` attribute on submit, which is what broke "photos don't appear".
// Also `multiple` so the user can pick a batch in one shot.
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors cursor-pointer file:cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AttachmentUploader({ jobId }: { jobId: string }) {
  const bound = uploadAttachment.bind(null, jobId);
  const [state, formAction, pending] = useActionState<AttachmentState, FormData>(
    bound,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.error && !pending) ref.current?.reset();
  }, [state, pending]);

  return (
    <form
      ref={ref}
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card shadow-sm p-3"
    >
      <div className="flex-1 min-w-[200px]">
        <input
          type="file"
          name="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
          required
          className={inputCls}
        />
      </div>
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          name="caption"
          placeholder="Caption (applied to every file in this upload)"
          className={inputCls}
        />
      </div>
      <Button type="submit" disabled={pending} size="sm">
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
  );
}
