"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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
      <Link href={`/settings/workspaces/${workspaceId}`}>
        <Button type="button" variant="outline" size="sm">
          {isOwner ? "Manage" : "View"}
        </Button>
      </Link>
    </div>
  );
}
