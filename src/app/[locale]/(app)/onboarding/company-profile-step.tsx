"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { CompanyProfile } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveCompanyProfile, type OnboardingState } from "./actions";

export function CompanyProfileStep({
  initial,
}: {
  initial: CompanyProfile | null;
}) {
  const t = useTranslations("Onboarding");
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    saveCompanyProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-lg font-medium">{t("companyProfile")}</h2>
      <Field name="name" label="Name / Company" defaultValue={initial?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <Field name="ico" label="IČO" defaultValue={initial?.ico ?? ""} />
        <Field name="dic" label="DIČ" defaultValue={initial?.dic ?? ""} />
      </div>
      <Field name="addressStreet" label="Street" defaultValue={initial?.addressStreet ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field name="addressCity" label="City" defaultValue={initial?.addressCity ?? ""} />
        <Field name="addressZip" label="ZIP" defaultValue={initial?.addressZip ?? ""} />
      </div>
      <Field name="iban" label="IBAN" defaultValue={initial?.iban ?? ""} />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("next")}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
      />
    </div>
  );
}
