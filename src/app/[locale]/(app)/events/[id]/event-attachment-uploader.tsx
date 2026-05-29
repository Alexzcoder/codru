"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompressingFileInput } from "@/components/compressing-file-input";
import {
  uploadEventAttachment,
  type EventAttachmentState,
} from "./attachment-actions";

export function EventAttachmentUploader({ eventId }: { eventId: string }) {
  const bound = uploadEventAttachment.bind(null, eventId);
  const [state, formAction, pending] = useActionState<
    EventAttachmentState,
    FormData
  >(bound, {});
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
        <CompressingFileInput
          name="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none cursor-pointer file:cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
