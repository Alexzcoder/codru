"use client";

import { useActionState, useMemo, useState } from "react";
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
import type { FinalInvoiceState } from "./actions";

export type AvailableAdvance = {
  id: string;
  number: string | null;
  jobId: string | null;
  currency: string;
  bands: { ratePercent: string; net: string }[];
  totalGross: string;
};

export type QuoteChoice = {
  id: string;
  number: string | null;
  clientId: string;
  currency: string;
  locale: "cs" | "en";
  reverseCharge: boolean;
  documentDiscountPercent: string | null;
  documentDiscountAmount: string | null;
  lines: EditorLine[];
};

type Initial = {
  clientId?: string;
  jobId?: string;
  sourceQuoteId?: string | null;
  companyProfileId?: string;
  documentTemplateId?: string;
  currency?: string;
  locale?: "cs" | "en";
  issueDate?: Date;
  taxPointDate?: Date | null;
  dueDate?: Date;
  reverseCharge?: boolean;
  documentDiscountPercent?: string | null;
  documentDiscountAmount?: string | null;
  title?: string | null;
  notesInternal?: string | null;
  notesToClient?: string | null;
  lines?: EditorLine[];
  deductedAdvanceIds?: string[];
};

export function FinalInvoiceForm({
  initial,
  clients,
  jobs,
  quotes,
  availableAdvances,
  companyProfiles,
  documentTemplates,
  itemTemplates,
  taxRates,
  deductionLabelTemplate,
  action,
  isDraft,
}: {
  initial?: Initial;
  clients: ClientOption[];
  jobs: JobOption[];
  quotes: QuoteChoice[];
  availableAdvances: AvailableAdvance[];
  companyProfiles: CompanyOption[];
  documentTemplates: TemplateChoice[];
  itemTemplates: TemplateOption[];
  taxRates: TaxRateOption[];
  deductionLabelTemplate: string; // e.g. "Advance {number} — deduction ({rate}%)"
  action: (prev: FinalInvoiceState, formData: FormData) => Promise<FinalInvoiceState>;
  isDraft: boolean;
}) {
  const t = useTranslations("FinalInvoices");
  const tQ = useTranslations("Quotes");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<FinalInvoiceState, FormData>(
    action,
    {},
  );

  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [jobId, setJobId] = useState(initial?.jobId ?? "");
  const [sourceQuoteId, setSourceQuoteId] = useState(initial?.sourceQuoteId ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "CZK");
  const [locale, setLocale] = useState<"cs" | "en">(initial?.locale ?? "cs");
  const [reverseCharge, setReverseCharge] = useState(initial?.reverseCharge ?? false);
  const [docDiscountPct, setDocDiscountPct] = useState(initial?.documentDiscountPercent ?? "");
  const [docDiscountAmt, setDocDiscountAmt] = useState(initial?.documentDiscountAmount ?? "");
  const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(
    new Set(initial?.deductedAdvanceIds ?? []),
  );
  const [workLines, setWorkLines] = useState<EditorLine[]>(
    initial?.lines?.filter((l) => !l.name.startsWith("__DEDUCTION__")) ??
      (initial?.lines ?? []),
  );

  const client = clients.find((c) => c.id === clientId);
  const availableJobs = jobs.filter((j) => j.clientId === clientId);
  const availableQuotes = quotes.filter((q) => q.clientId === clientId);
  const advancesForJob = availableAdvances.filter((a) => a.jobId === jobId);
  const selectedQuote = quotes.find((q) => q.id === sourceQuoteId) ?? null;

  // Build deduction lines from current selection.
  const deductionLines: EditorLine[] = useMemo(() => {
    const selected = availableAdvances.filter((a) => selectedAdvances.has(a.id));
    const out: EditorLine[] = [];
    for (const adv of selected) {
      const number = adv.number ?? `ADV-draft/${adv.id.slice(-6)}`;
      for (const band of adv.bands) {
        out.push({
          name: deductionLabelTemplate
            .replace("{number}", number)
            .replace("{rate}", band.ratePercent),
          description: "",
          quantity: "1",
          unit: "ks",
          unitPrice: `-${band.net}`,
          taxRatePercent: band.ratePercent,
          taxMode: "NET",
          lineDiscountPercent: "",
          lineDiscountAmount: "",
        });
      }
    }
    return out;
  }, [selectedAdvances, availableAdvances, deductionLabelTemplate]);

  const baseLines: EditorLine[] = selectedQuote
    ? selectedQuote.lines
    : workLines.length === 0
      ? [
          {
            name: "",
            description: "",
            quantity: "1",
            unit: "ks",
            unitPrice: "0.00",
            taxRatePercent: "21",
            taxMode: "NET",
            lineDiscountPercent: "",
            lineDiscountAmount: "",
          },
        ]
      : workLines;
  const allLines: EditorLine[] = [...baseLines, ...deductionLines];

  const today = initial?.issueDate ?? new Date();
  const defaultDue =
    initial?.dueDate ??
    (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 14);
      return d;
    })();

  const toggleAdvance = (id: string) => {
    const next = new Set(selectedAdvances);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAdvances(next);
  };

  return (
    <form action={formAction} className="space-y-8">
      {!isDraft && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {tQ("actions.editWarning")}
        </div>
      )}

      <input
        type="hidden"
        name="deductedAdvanceIds"
        value={Array.from(selectedAdvances).join(",")}
      />

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
              setJobId("");
              setSourceQuoteId("");
              setSelectedAdvances(new Set());
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
          <Label htmlFor="jobId">{t("fields.jobRequired")}</Label>
          <select
            id="jobId"
            name="jobId"
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              setSelectedAdvances(new Set());
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            <option value="">—</option>
            {availableJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          {!jobId && clientId && (
            <p className="text-xs text-red-600">{t("jobRequiredHint")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceQuoteId">{t("fields.sourceQuote")}</Label>
          <select
            id="sourceQuoteId"
            name="sourceQuoteId"
            value={sourceQuoteId}
            onChange={(e) => {
              const id = e.target.value;
              setSourceQuoteId(id);
              const q = quotes.find((x) => x.id === id);
              if (q) {
                setCurrency(q.currency);
                setLocale(q.locale);
                setReverseCharge(q.reverseCharge);
                setDocDiscountPct(q.documentDiscountPercent ?? "");
                setDocDiscountAmt(q.documentDiscountAmount ?? "");
              }
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {availableQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.number ?? `draft/${q.id.slice(-6)}`}
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

      {/* Available advances panel */}
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("fields.availableAdvances")}</legend>
        {jobId ? (
          advancesForJob.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAvailableAdvances")}</p>
          ) : (
            <ul className="space-y-2">
              {advancesForJob.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAdvances.has(a.id)}
                    onChange={() => toggleAdvance(a.id)}
                  />
                  <span className="font-medium">{a.number ?? "(draft)"}</span>
                  <span className="text-muted-foreground">
                    {a.bands
                      .map(
                        (b) =>
                          `${b.net} @ ${b.ratePercent}%`,
                      )
                      .join(", ")}
                  </span>
                  <span className="ml-auto tabular-nums">
                    {a.totalGross} {a.currency}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t("jobRequiredHint")}</p>
        )}
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
          key={`${sourceQuoteId || "blank"}-${selectedAdvances.size}`}
          initialLines={allLines}
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
            {tQ("fields.documentDiscount")} (%)
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentDiscountAmount">
            {tQ("fields.documentDiscount")} ({currency})
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
          />
        </div>
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
        <Button type="submit" disabled={pending || !jobId}>
          {tSet("save")}
        </Button>
        <Link href="/final-invoices">
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
