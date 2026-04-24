"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomField, type CustomFieldState } from "./actions";

export function CustomFieldForm() {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<CustomFieldState, FormData>(
    createCustomField,
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
      className="flex items-end gap-3 rounded-xl border border-border bg-card shadow-sm p-3"
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" required />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="fieldType">Type</Label>
        <select
          id="fieldType"
          name="fieldType"
          defaultValue="TEXT"
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="TEXT">Text</option>
          <option value="NUMBER">Number</option>
          <option value="DATE">Date</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {t("create")}
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
