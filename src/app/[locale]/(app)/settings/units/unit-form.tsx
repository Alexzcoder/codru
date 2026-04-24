"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUnit, type UnitState } from "./actions";

export function UnitForm() {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<UnitState, FormData>(
    createUnit,
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
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" required placeholder="hour, m², piece…" />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {t("create")}
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
