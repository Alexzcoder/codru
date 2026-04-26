"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createWorkspace,
  type CreateWorkspaceState,
} from "../../workspace-actions";

export function CreateWorkspaceInline() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(createWorkspace, {});

  useEffect(() => {
    if (state.created) router.push("/dashboard");
  }, [state.created, router]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input
        name="name"
        placeholder="Workspace name"
        required
        maxLength={80}
        className="max-w-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
      {state.error && (
        <span className="text-sm text-red-600" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
