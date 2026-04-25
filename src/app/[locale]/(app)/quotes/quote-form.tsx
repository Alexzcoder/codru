"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LineItemsEditor, type EditorLine, type TemplateOption, type TaxRateOption } from "./line-items-editor";
import type { QuoteState } from "./actions";

export type ClientOption = {
  id: string;
  name: string;
  hasIco: boolean;
  preferredCurrency: string;
  defaultLanguage: "cs" | "en";
};
export type JobOption = { id: string; title: string; clientId: string };
export type CompanyOption = { id: string; name: string };
export type TemplateChoice = { id: string; name: string };

type Initial = {
  clientId?: string;
  jobId?: string | null;
  companyProfileId?: string;
  documentTemplateId?: string;
  currency?: string;
  locale?: "cs" | "en";
  issueDate?: Date;
  validUntilDate?: Date;
  reverseCharge?: boolean;
  documentDiscountPercent?: string | null;
  documentDiscountAmount?: string | null;
  title?: string | null;
  notesInternal?: string | null;
  notesToClient?: string | null;
  lines?: EditorLine[];
};

export function QuoteForm({
  initial,
  clients,
  jobs,
  companyProfiles,
  documentTemplates,
  itemTemplates,
  taxRates,
  action,
  isDraft,
}: {
  initial?: Initial;
  clients: ClientOption[];
  jobs: JobOption[];
  companyProfiles: CompanyOption[];
  documentTemplates: TemplateChoice[];
  itemTemplates: TemplateOption[];
  taxRates: TaxRateOption[];
  action: (prev: QuoteState, formData: FormData) => Promise<QuoteState>;
  isDraft: boolean;
}) {
  const t = useTranslations("Quotes");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<QuoteState, FormData>(action, {});

  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "CZK");
  const [locale, setLocale] = useState<"cs" | "en">(initial?.locale ?? "cs");
  const [reverseCharge, setReverseCharge] = useState(initial?.reverseCharge ?? false);
  const [docDiscountPct, setDocDiscountPct] = useState(
    initial?.documentDiscountPercent ?? "",
  );
  const [docDiscountAmt, setDocDiscountAmt] = useState(
    initial?.documentDiscountAmount ?? "",
  );

  const client = clients.find((c) => c.id === clientId);
  const availableJobs = jobs.filter((j) => j.clientId === clientId);

  const today = initial?.issueDate ?? new Date();
  const defaultValidUntil =
    initial?.validUntilDate ??
    (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 30);
      return d;
    })();

  return (
    <form action={formAction} className="space-y-8">
      {!isDraft && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t("actions.editWarning")}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder="e.g. Kitchen remodel for Cejková"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">
          Internal name for this quote — not shown on the PDF. The legal
          number stays separate.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clientId">{t("fields.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const c = clients.find((x) => x.id === e.target.value);
              if (c) {
                setCurrency(c.preferredCurrency);
                setLocale(c.defaultLanguage);
              }
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {client && !client.hasIco && reverseCharge && (
            <p className="text-xs text-red-600">{t("reverseChargeWarning")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">{t("fields.job")}</Label>
          <select
            id="jobId"
            name="jobId"
            defaultValue={initial?.jobId ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {availableJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="issueDate">{t("fields.issueDate")}</Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={toDateInput(today)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validUntilDate">{t("fields.validUntil")}</Label>
          <Input
            id="validUntilDate"
            name="validUntilDate"
            type="date"
            defaultValue={toDateInput(defaultValidUntil)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{t("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">{t("fields.locale")}</Label>
          <select
            id="locale"
            name="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value as "cs" | "en")}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyProfileId">{t("fields.companyProfile")}</Label>
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
          <Label htmlFor="documentTemplateId">{t("fields.template")}</Label>
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
          checked={reverseCharge}
          onChange={(e) => setReverseCharge(e.target.checked)}
          disabled={!client?.hasIco}
        />
        {t("fields.reverseCharge")}
      </label>

      {/* Line items */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("lineItems.title")}</h3>
        <LineItemsEditor
          initialLines={initial?.lines ?? []}
          templates={itemTemplates}
          taxRates={taxRates}
          currency={currency}
          documentDiscountPercent={docDiscountPct}
          documentDiscountAmount={docDiscountAmt}
          reverseCharge={reverseCharge}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="documentDiscountPercent">
            {t("fields.documentDiscount")} (%)
          </Label>
          <Input
            id="documentDiscountPercent"
            name="documentDiscountPercent"
            value={docDiscountPct}
            onChange={(e) => {
              setDocDiscountPct(e.target.value);
              if (e.target.value) setDocDiscountAmt("");
            }}
            inputMode="decimal"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentDiscountAmount">
            {t("fields.documentDiscount")} ({currency})
          </Label>
          <Input
            id="documentDiscountAmount"
            name="documentDiscountAmount"
            value={docDiscountAmt}
            onChange={(e) => {
              setDocDiscountAmt(e.target.value);
              if (e.target.value) setDocDiscountPct("");
            }}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notesToClient">{t("fields.notesToClient")}</Label>
          <textarea
            id="notesToClient"
            name="notesToClient"
            defaultValue={initial?.notesToClient ?? ""}
            className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notesInternal">{t("fields.notesInternal")}</Label>
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
        <Link href="/quotes">
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
