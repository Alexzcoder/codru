"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { DocumentTemplate } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { DocumentTemplateState } from "./actions";

type Initial = Partial<DocumentTemplate>;

export function DocumentTemplateForm({
  initial,
  companyProfiles,
  action,
}: {
  initial?: Initial;
  companyProfiles: { id: string; name: string }[];
  action: (
    prev: DocumentTemplateState,
    formData: FormData,
  ) => Promise<DocumentTemplateState>;
}) {
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<DocumentTemplateState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type">Document type</Label>
          <select
            id="type"
            name="type"
            defaultValue={initial?.type ?? "QUOTE"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            <option value="QUOTE">Quote</option>
            <option value="ADVANCE_INVOICE">Advance invoice</option>
            <option value="FINAL_INVOICE">Final invoice</option>
            <option value="CREDIT_NOTE">Credit note</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyProfileId">Company profile</Label>
          <select
            id="companyProfileId"
            name="companyProfileId"
            defaultValue={initial?.companyProfileId ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {companyProfiles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accentColor">Accent color</Label>
        <Input
          id="accentColor"
          name="accentColor"
          type="color"
          defaultValue={initial?.accentColor ?? "#1d4ed8"}
          className="h-10 w-24 p-1"
        />
      </div>

      <fieldset className="space-y-2 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Visibility</legend>
        <Toggle name="showLogo" label="Show company logo" initial={initial?.showLogo ?? true} />
        <Toggle
          name="showSignature"
          label="Show signature image"
          initial={initial?.showSignature ?? true}
        />
        <Toggle
          name="showQrPlatba"
          label="Show QR platba (invoices)"
          initial={initial?.showQrPlatba ?? true}
        />
        <Toggle
          name="showReverseChargeNote"
          label="Show reverse-charge note when applicable"
          initial={initial?.showReverseChargeNote ?? true}
        />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="customHeaderText">Custom header text (optional)</Label>
        <Input
          id="customHeaderText"
          name="customHeaderText"
          defaultValue={initial?.customHeaderText ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customFooterText">Custom footer text (optional)</Label>
        <Input
          id="customFooterText"
          name="customFooterText"
          defaultValue={initial?.customFooterText ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initial?.isDefault ?? false}
        />
        Default template for this type
      </label>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tSet("save")}
        </Button>
        <Link href="/settings/document-templates">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={initial} />
      {label}
    </label>
  );
}
