"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  LineItemsEditor,
  type EditorLine,
  type TemplateOption,
  type TaxRateOption,
} from "../quotes/line-items-editor";
import type {
  CompanyOption,
  TemplateChoice,
} from "../quotes/quote-form";
import type { CreditNoteState } from "./actions";

export type OriginalInvoiceSummary = {
  id: string;
  number: string | null;
  clientName: string;
  currency: string;
  locale: "cs" | "en";
  reverseCharge: boolean;
  negatedLines: EditorLine[];
};

type Initial = {
  originalDocumentId?: string;
  creditReason?: string | null;
  companyProfileId?: string;
  documentTemplateId?: string;
  currency?: string;
  locale?: "cs" | "en";
  issueDate?: Date;
  taxPointDate?: Date | null;
  reverseCharge?: boolean;
  notesInternal?: string | null;
  notesToClient?: string | null;
  lines?: EditorLine[];
};

export function CreditNoteForm({
  initial,
  original,
  companyProfiles,
  documentTemplates,
  itemTemplates,
  taxRates,
  action,
  isDraft,
}: {
  initial?: Initial;
  original: OriginalInvoiceSummary;
  companyProfiles: CompanyOption[];
  documentTemplates: TemplateChoice[];
  itemTemplates: TemplateOption[];
  taxRates: TaxRateOption[];
  action: (prev: CreditNoteState, formData: FormData) => Promise<CreditNoteState>;
  isDraft: boolean;
}) {
  const t = useTranslations("CreditNotes");
  const tQ = useTranslations("Quotes");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<CreditNoteState, FormData>(
    action,
    {},
  );

  const today = initial?.issueDate ?? new Date();

  return (
    <form action={formAction} className="space-y-8">
      {!isDraft && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {tQ("actions.editWarning")}
        </div>
      )}

      <input type="hidden" name="originalDocumentId" value={original.id} />

      <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("fields.originalDocument")}
        </p>
        <p className="mt-1 font-medium">
          {original.number ?? "(draft)"} · {original.clientName}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="creditReason">{t("fields.creditReason")}</Label>
        <textarea
          id="creditReason"
          name="creditReason"
          defaultValue={initial?.creditReason ?? ""}
          placeholder={t("fields.creditReasonPlaceholder")}
          required
          className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="issueDate">{tQ("fields.issueDate")}</Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={toDateInput(today)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxPointDate">Tax point date</Label>
          <Input
            id="taxPointDate"
            name="taxPointDate"
            type="date"
            defaultValue={initial?.taxPointDate ? toDateInput(initial.taxPointDate) : toDateInput(today)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{tQ("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? original.currency}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">{tQ("fields.locale")}</Label>
          <select
            id="locale"
            name="locale"
            defaultValue={initial?.locale ?? original.locale}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyProfileId">{tQ("fields.companyProfile")}</Label>
          <select
            id="companyProfileId"
            name="companyProfileId"
            defaultValue={initial?.companyProfileId ?? companyProfiles[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            {companyProfiles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentTemplateId">{tQ("fields.template")}</Label>
          <select
            id="documentTemplateId"
            name="documentTemplateId"
            defaultValue={initial?.documentTemplateId ?? documentTemplates[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            {documentTemplates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="reverseCharge"
          defaultChecked={initial?.reverseCharge ?? original.reverseCharge}
        />
        {tQ("fields.reverseCharge")} (from original)
      </label>

      <div>
        <h3 className="text-sm font-medium">{tQ("lineItems.title")}</h3>
        <p className="text-xs text-muted-foreground mb-2">{t("linesHint")}</p>
        <LineItemsEditor
          initialLines={initial?.lines ?? original.negatedLines}
          templates={itemTemplates}
          taxRates={taxRates}
          currency={initial?.currency ?? original.currency}
          documentDiscountPercent=""
          documentDiscountAmount=""
          reverseCharge={initial?.reverseCharge ?? original.reverseCharge}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notesToClient">{tQ("fields.notesToClient")}</Label>
          <textarea
            id="notesToClient"
            name="notesToClient"
            defaultValue={initial?.notesToClient ?? ""}
            className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notesInternal">{tQ("fields.notesInternal")}</Label>
          <textarea
            id="notesInternal"
            name="notesInternal"
            defaultValue={initial?.notesInternal ?? ""}
            className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tSet("save")}
        </Button>
        <Link href="/credit-notes">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
