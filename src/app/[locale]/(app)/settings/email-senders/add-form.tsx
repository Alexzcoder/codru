"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createEmailIdentity, type EmailIdentityState } from "./actions";

export function AddIdentityForm({ companyProfileId }: { companyProfileId: string }) {
  const [state, formAction, pending] = useActionState<EmailIdentityState, FormData>(
    createEmailIdentity,
    {},
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3 rounded-md bg-secondary/40 p-3 md:grid-cols-[1fr_1fr_auto_auto]">
      <input type="hidden" name="companyProfileId" value={companyProfileId} />
      <div className="space-y-1">
        <Label htmlFor={`from-${companyProfileId}`} className="text-xs">From address</Label>
        <Input
          id={`from-${companyProfileId}`}
          name="fromAddress"
          type="email"
          placeholder="info@sezonapece.cz"
          className="h-8"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`name-${companyProfileId}`} className="text-xs">Display name (optional)</Label>
        <Input
          id={`name-${companyProfileId}`}
          name="displayName"
          placeholder="Sezona Péče"
          className="h-8"
        />
      </div>
      <label className="flex items-end gap-1.5 text-xs">
        <input type="checkbox" name="isDefault" />
        Default
      </label>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>
          Add sender
        </Button>
      </div>
      {state.error && (
        <p className="md:col-span-4 text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
