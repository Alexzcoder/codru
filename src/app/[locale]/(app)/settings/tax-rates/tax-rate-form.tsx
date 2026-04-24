"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTaxRate, type TaxRateState } from "./actions";

export function TaxRateForm() {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<TaxRateState, FormData>(
    createTaxRate,
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card shadow-sm p-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="label">{t("fields.label")}</Label>
        <Input id="label" name="label" required placeholder="21 %" className="w-40" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="percent">{t("fields.percent")}</Label>
        <Input
          id="percent"
          name="percent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          required
          className="w-24"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" />
        {t("fields.isDefault")}
      </label>
      <Button type="submit" disabled={pending} size="sm">
        {t("create")}
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
