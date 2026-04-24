"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Client, CustomFieldDef } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ClientState } from "./actions";

type Initial = Partial<Client> & { id?: string };

export function ClientForm({
  initial,
  customFieldDefs,
  customFieldValues,
  action,
}: {
  initial?: Initial;
  customFieldDefs: CustomFieldDef[];
  customFieldValues: Record<string, string>;
  action: (prev: ClientState, formData: FormData) => Promise<ClientState>;
}) {
  const t = useTranslations("Clients");
  const tSet = useTranslations("Settings");
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(
    (initial?.type as "INDIVIDUAL" | "COMPANY") ?? "COMPANY",
  );
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    customFieldValues,
  );
  const [state, formAction, pending] = useActionState<ClientState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFields)}
      />
      {(state.duplicateIcoId || state.duplicateEmailId) && (
        <input type="hidden" name="duplicateAck" value="1" />
      )}

      <fieldset className="flex gap-2 text-sm">
        {(["COMPANY", "INDIVIDUAL"] as const).map((v) => (
          <label
            key={v}
            className={`cursor-pointer rounded-md border px-3 py-1.5 ${type === v ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
          >
            <input
              type="radio"
              name="type"
              value={v}
              className="hidden"
              defaultChecked={type === v}
              onChange={() => setType(v)}
            />
            {t(`type.${v}`)}
          </label>
        ))}
      </fieldset>

      {type === "COMPANY" ? (
        <Field
          name="companyName"
          label={t("form.companyName")}
          defaultValue={initial?.companyName ?? ""}
          required
        />
      ) : (
        <Field
          name="fullName"
          label={t("form.fullName")}
          defaultValue={initial?.fullName ?? ""}
          required
        />
      )}

      {type === "COMPANY" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="ico"
              label={t("form.ico")}
              defaultValue={initial?.ico ?? ""}
              error={
                state.error === "icoInvalid" ? t("form.icoInvalid") : undefined
              }
            />
            <Field
              name="dic"
              label={t("form.dic")}
              defaultValue={initial?.dic ?? ""}
              error={
                state.error === "dicInvalid" ? t("form.dicInvalid") : undefined
              }
              placeholder="CZ12345678"
            />
          </div>
          {state.error === "icoInvalid" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="icoOverride" defaultChecked />
              {t("form.icoOverride")}
            </label>
          )}
        </>
      )}

      {state.duplicateIcoId && (
        <DuplicateWarning
          id={state.duplicateIcoId}
          name={state.duplicateName ?? ""}
          field="IČO"
        />
      )}
      {state.duplicateEmailId && (
        <DuplicateWarning
          id={state.duplicateEmailId}
          name={state.duplicateName ?? ""}
          field="email"
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field name="email" label={t("form.email")} defaultValue={initial?.email ?? ""} type="email" />
        <Field name="phone" label={t("form.phone")} defaultValue={initial?.phone ?? ""} />
      </div>

      <Field
        name="addressStreet"
        label={t("form.street")}
        defaultValue={initial?.addressStreet ?? ""}
      />
      <div className="grid grid-cols-[1fr_140px_100px] gap-3">
        <Field name="addressCity" label={t("form.city")} defaultValue={initial?.addressCity ?? ""} />
        <Field name="addressZip" label={t("form.zip")} defaultValue={initial?.addressZip ?? ""} />
        <Field
          name="addressCountry"
          label={t("form.country")}
          defaultValue={initial?.addressCountry ?? "CZ"}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="status">{t("form.status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "POTENTIAL"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {(["POTENTIAL", "ACTIVE", "PAST", "FAILED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultLanguage">{t("form.language")}</Label>
          <select
            id="defaultLanguage"
            name="defaultLanguage"
            defaultValue={initial?.defaultLanguage ?? "cs"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredCurrency">{t("form.currency")}</Label>
          <select
            id="preferredCurrency"
            name="preferredCurrency"
            defaultValue={initial?.preferredCurrency ?? "CZK"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {customFieldDefs.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium">{t("detail.customFields")}</p>
          <div className="mt-3 space-y-3">
            {customFieldDefs.map((def) => (
              <div key={def.id} className="grid grid-cols-[160px_1fr] items-center gap-3">
                <Label>{def.label}</Label>
                <Input
                  type={
                    def.fieldType === "NUMBER"
                      ? "number"
                      : def.fieldType === "DATE"
                        ? "date"
                        : "text"
                  }
                  value={customFields[def.id] ?? ""}
                  onChange={(e) =>
                    setCustomFields({ ...customFields, [def.id]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tSet("save")}
        </Button>
        <Link href="/clients">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
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
  placeholder,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
  error?: string;
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
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DuplicateWarning({
  id,
  name,
  field,
}: {
  id: string;
  name: string;
  field: string;
}) {
  const t = useTranslations("Clients.form");
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <p className="font-medium text-amber-900">
        {t("duplicate", { field })}
      </p>
      <Link
        href={`/clients/${id}`}
        className="mt-1 inline-block underline"
        target="_blank"
      >
        {name}
      </Link>
      <p className="mt-2 text-xs text-amber-800">
        Click Save again to proceed anyway.
      </p>
    </div>
  );
}
