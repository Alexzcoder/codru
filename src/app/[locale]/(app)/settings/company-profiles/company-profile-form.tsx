"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { CompanyProfile } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CompanyProfileState } from "./actions";
import { CountrySelect } from "@/components/country-select";

export function CompanyProfileForm({
  initial,
  action,
}: {
  initial?: CompanyProfile | null;
  action: (
    prev: CompanyProfileState,
    formData: FormData,
  ) => Promise<CompanyProfileState>;
}) {
  const t = useTranslations("Settings.fields");
  const tOuter = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<
    CompanyProfileState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field name="name" label={t("name")} defaultValue={initial?.name} required />

      <div className="grid grid-cols-2 gap-3">
        <Field name="ico" label={t("ico")} defaultValue={initial?.ico ?? ""} />
        <Field name="dic" label={t("dic")} defaultValue={initial?.dic ?? ""} />
      </div>

      <fieldset className="grid gap-3">
        <Field name="addressStreet" label={t("street")} defaultValue={initial?.addressStreet ?? ""} />
        <div className="grid grid-cols-[1fr_140px_180px] gap-3">
          <Field name="addressCity" label={t("city")} defaultValue={initial?.addressCity ?? ""} />
          <Field name="addressZip" label={t("zip")} defaultValue={initial?.addressZip ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="addressCountry">{t("country")}</Label>
            <CountrySelect name="addressCountry" defaultValue={initial?.addressCountry ?? "CZ"} />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-[1fr_160px_200px] gap-3">
        <Field name="iban" label={t("iban")} defaultValue={initial?.iban ?? ""} />
        <Field name="swift" label={t("swift")} defaultValue={initial?.swift ?? ""} />
        <Field
          name="accountNumber"
          label={t("accountNumber")}
          defaultValue={initial?.accountNumber ?? ""}
        />
      </fieldset>

      <div className="grid grid-cols-[140px_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="brandColor">{t("brandColor")}</Label>
          <Input
            id="brandColor"
            name="brandColor"
            type="color"
            defaultValue={initial?.brandColor ?? "#059669"}
            className="h-10 p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo">{t("logo")}</Label>
          <Input id="logo" name="logo" type="file" accept="image/*" className="cursor-pointer file:cursor-pointer" />
          {initial?.logoPath && (
            <p className="text-xs text-muted-foreground">Current: {initial.logoPath}</p>
          )}
        </div>
      </div>

      <Field
        name="defaultHeaderText"
        label={t("headerText")}
        defaultValue={initial?.defaultHeaderText ?? ""}
      />
      <Field
        name="defaultFooterText"
        label={t("footerText")}
        defaultValue={initial?.defaultFooterText ?? ""}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="defaultPaymentTermsDays"
          label={t("paymentTermsDays")}
          defaultValue={String(initial?.defaultPaymentTermsDays ?? 14)}
          type="number"
        />
        <Field
          name="defaultWarrantyText"
          label={t("warrantyText")}
          defaultValue={initial?.defaultWarrantyText ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initial?.isDefault ?? false}
        />
        {t("isDefault")}
      </label>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-green-700">{tOuter("saved")}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tOuter("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        type={type}
      />
    </div>
  );
}
