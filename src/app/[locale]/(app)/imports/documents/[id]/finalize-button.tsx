"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { finalizeImportSession } from "../actions";

export function FinalizeButton({
  sessionId,
  disabled,
}: {
  sessionId: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          await finalizeImportSession(sessionId);
        })
      }
    >
      {pending ? "Finalizing…" : "Finalize session"}
    </Button>
  );
}
