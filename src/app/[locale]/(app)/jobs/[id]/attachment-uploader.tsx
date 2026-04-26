"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAttachment, type AttachmentState } from "../actions";

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
        <Input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
          required
        />
      </div>
      <div className="flex-1 min-w-[200px]">
        <Input name="caption" placeholder="Caption" />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        Upload
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
