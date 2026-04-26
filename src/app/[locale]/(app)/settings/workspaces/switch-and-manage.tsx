"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { switchWorkspace } from "../../workspace-actions";

export function SwitchAndManage({
  workspaceId,
  isActive,
  isOwner,
}: {
  workspaceId: string;
  isActive: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {!isActive && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await switchWorkspace(workspaceId);
            })
          }
        >
          {pending ? "Switching…" : "Switch to"}
        </Button>
      )}
      {isOwner && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {/* Delete + invite arrive next phase. */}
          Members coming soon
        </span>
      )}
    </div>
  );
}
