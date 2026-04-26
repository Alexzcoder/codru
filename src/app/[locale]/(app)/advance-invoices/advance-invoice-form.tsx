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
  ClientOption,
  JobOption,
  CompanyOption,
  TemplateChoice,
} from "../quotes/quote-form";
import type { AdvanceState } from "./actions";

export type QuoteSummary = {
  id: string;
  number: string | null;
  clientId: string;
  currency: string;
  totalGross: string;
};

type Initial = {
  clientId?: string;
  jobId?: string | null;
  sourceQuoteId?: string | null;
  companyProfileId?: string;
  documentTemplateId?: string;
  currency?: string;
  locale?: "cs" | "en";
  issueDate?: Date;
  taxPointDate?: Date | null;
  dueDate?: Date;
  reverseCharge?: boolean;
  advanceAmountMode?: "PERCENT" | "FIXED" | null;
  advanceAmountPercent?: string | null;
  advanceAmountFixed?: string | null;
  title?: string | null;
  notesInternal?: string | null;
  notesToClient?: string | null;
  lines?: EditorLine[];
};

const DEFAULT_TAX_RATE = "21";

export function AdvanceInvoiceForm({
  initial,
  clients,
  jobs,
  quotes,
  companyProfiles,
  documentTemplates,
  itemTemplates,
  taxRates,
  action,
  isDraft,
  defaultLineName,
}: {
  initial?: Initial;
  clients: ClientOption[];
  jobs: JobOption[];
  quotes: QuoteSummary[];
  companyProfiles: CompanyOption[];
  documentTemplates: TemplateChoice[];
  itemTemplates: TemplateOption[];
  taxRates: TaxRateOption[];
  action: (prev: AdvanceState, formData: FormData) => Promise<AdvanceState>;
  isDraft: boolean;
  defaultLineName: string;
}) {
  const t = useTranslations("AdvanceInvoices");
  const tQ = useTranslations("Quotes");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<AdvanceState, FormData>(
    action,
    {},
  );

  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [sourceQuoteId, setSourceQuoteId] = useState(initial?.sourceQuoteId ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "CZK");
  const [locale, setLocale] = useState<"cs" | "en">(initial?.locale ?? "cs");
  const [reverseCharge, setReverseCharge] = useState(initial?.reverseCharge ?? false);
  const [amountMode, setAmountMode] = useState<"PERCENT" | "FIXED">(
    initial?.advanceAmountMode ?? (initial?.sourceQuoteId ? "PERCENT" : "FIXED"),
  );
  const [amountPercent, setAmountPercent] = useState(initial?.advanceAmountPercent ?? "30");
  const [amountFixed, setAmountFixed] = useState(initial?.advanceAmountFixed ?? "");

  const client = clients.find((c) => c.id === clientId);
  const availableJobs = jobs.filter((j) => j.clientId === clientId);
  const availableQuotes = quotes.filter((q) => q.clientId === clientId);
  const sourceQuote = quotes.find((q) => q.id === sourceQuoteId);

  const today = initial?.issueDate ?? new Date();
  const defaultDue =
    initial?.dueDate ??
    (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 14);
      return d;
    })();

  // Auto-computed default advance line (user can still override in editor).
  const computedAmount =
    amountMode === "PERCENT" && sourceQuote
      ? ((Number.parseFloat(sourceQuote.totalGross) * Number.parseFloat(amountPercent || "0")) / 100).toFixed(2)
      : amountMode === "FIXED"
        ? Number.parseFloat(amountFixed || "0").toFixed(2)
        : "0.00";

  const defaultLines: EditorLine[] =
    initial?.lines && initial.lines.length > 0
      ? initial.lines
      : [
          {
            name: `${defaultLineName} — ${computedAmount} ${currency}`,
            description: "",
            quantity: "1",
            unit: "ks",
            unitPrice: computedAmount,
            taxRatePercent: DEFAULT_TAX_RATE,
            taxMode: "NET",
            lineDiscountPercent: "",
            lineDiscountAmount: "",
          },
        ];

  return (
    <form action={formAction} className="space-y-8">
      {!isDraft && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {tQ("actions.editWarning")}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">{t("titleField.label")}</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder={t("titleField.placeholder")}
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">{t("titleField.hint")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="clientId">{tQ("fields.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSourceQuoteId("");
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">{tQ("fields.job")}</Label>
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
        <div className="space-y-2">
          <Label htmlFor="sourceQuoteId">{t("fields.sourceQuote")}</Label>
          <select
            id="sourceQuoteId"
            name="sourceQuoteId"
            value={sourceQuoteId}
            onChange={(e) => setSourceQuoteId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {availableQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.number ?? `draft/${q.id.slice(-6)}`} — {q.totalGross} {q.currency}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="issueDate">{tQ("fields.issueDate")}</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={toDateInput(today)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxPointDate">{t("fields.taxPointDate")}</Label>
          <Input
            id="taxPointDate"
            name="taxPointDate"
            type="date"
            defaultValue={initial?.taxPointDate ? toDateInput(initial.taxPointDate) : toDateInput(today)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">{t("fields.dueDate")}</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInput(defaultDue)} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="currency">{tQ("fields.currency")}</Label>
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
            <Label htmlFor="locale">{tQ("fields.locale")}</Label>
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

      {/* Amount mode */}
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("fields.amountMode")}</legend>
        <div className="flex items-center gap-4">
          {sourceQuoteId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="advanceAmountMode"
                value="PERCENT"
                checked={amountMode === "PERCENT"}
                onChange={() => setAmountMode("PERCENT")}
              />
              {t("fields.amountPercent")}
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="advanceAmountMode"
              value="FIXED"
              checked={amountMode === "FIXED"}
              onChange={() => setAmountMode("FIXED")}
            />
            {t("fields.amountFixed")}
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {amountMode === "PERCENT" && sourceQuoteId ? (
            <Input
              name="advanceAmountPercent"
              value={amountPercent}
              onChange={(e) => setAmountPercent(e.target.value)}
              inputMode="decimal"
              placeholder="30"
            />
          ) : (
            <Input
              name="advanceAmountFixed"
              value={amountFixed}
              onChange={(e) => setAmountFixed(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          )}
          <p className="self-center text-sm text-muted-foreground">
            {amountMode === "PERCENT" && sourceQuote
              ? `= ${computedAmount} ${currency}`
              : ""}
          </p>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="reverseCharge"
          checked={reverseCharge}
          onChange={(e) => setReverseCharge(e.target.checked)}
          disabled={!client?.hasIco}
        />
        {tQ("fields.reverseCharge")}
      </label>

      <div>
        <h3 className="text-sm font-medium mb-2">{tQ("lineItems.title")}</h3>
        <LineItemsEditor
          initialLines={defaultLines}
          templates={itemTemplates}
          taxRates={taxRates}
          currency={currency}
          documentDiscountPercent=""
          documentDiscountAmount=""
          reverseCharge={reverseCharge}
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
        <Link href="/advance-invoices">
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
