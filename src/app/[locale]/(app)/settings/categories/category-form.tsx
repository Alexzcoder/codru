"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategory, type CategoryState } from "./actions";

export function CategoryForm() {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<CategoryState, FormData>(
    createCategory,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.error && !pending) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-end gap-3 rounded-md border border-neutral-200 bg-white p-3"
    >
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" required />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {t("create")}
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
