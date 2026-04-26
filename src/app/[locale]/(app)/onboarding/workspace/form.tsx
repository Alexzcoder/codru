"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspace,
  type CreateWorkspaceState,
} from "../../workspace-actions";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(createWorkspace, {});

  useEffect(() => {
    if (state.created) router.push("/dashboard");
  }, [state.created, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. VENIREX"
          required
          maxLength={80}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
