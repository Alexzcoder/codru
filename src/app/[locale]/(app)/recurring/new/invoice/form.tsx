"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RecurrenceFields } from "../../recurrence-fields";
import {
  LineItemsEditor,
  type EditorLine,
  type TemplateOption,
  type TaxRateOption,
} from "../../../quotes/line-items-editor";
import type {
  ClientOption,
  JobOption,
  CompanyOption,
  TemplateChoice,
} from "../../../quotes/quote-form";
import type { RuleState } from "../../actions";

export function InvoiceRuleForm({
  clients,
  jobs,
  companyProfiles,
  documentTemplates,
  itemTemplates,
  taxRates,
  action,
}: {
  clients: ClientOption[];
  jobs: JobOption[];
  companyProfiles: CompanyOption[];
  documentTemplates: TemplateChoice[];
  itemTemplates: TemplateOption[];
  taxRates: TaxRateOption[];
  action: (prev: RuleState, formData: FormData) => Promise<RuleState>;
}) {
  const t = useTranslations("Quotes");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<RuleState, FormData>(action, {});
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [currency, setCurrency] = useState("CZK");
  const [locale, setLocale] = useState<"cs" | "en">("cs");
  const [reverseCharge, setReverseCharge] = useState(false);
  const jobsForClient = jobs.filter((j) => j.clientId === clientId);

  const emptyLine: EditorLine = {
    name: "",
    description: "",
    quantity: "1",
    unit: "ks",
    unitPrice: "0.00",
    taxRatePercent: "21",
    taxMode: "NET",
    lineDiscountPercent: "",
    lineDiscountAmount: "",
  };

  return (
    <form action={formAction} className="space-y-8">
      <RecurrenceFields />

      <div className="grid gap-4 md:grid-cols-3">
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
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">{t("fields.job")}</Label>
          <select
            id="jobId"
            name="jobId"
            defaultValue=""
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="">—</option>
            {jobsForClient.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueInDays">Due in (days)</Label>
          <Input
            id="dueInDays"
            name="dueInDays"
            type="number"
            min={0}
            max={180}
            defaultValue={14}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="currency">{t("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyProfileId">{t("fields.companyProfile")}</Label>
          <select
            id="companyProfileId"
            name="companyProfileId"
            defaultValue={companyProfiles[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
            defaultValue={documentTemplates[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
        />
        {t("fields.reverseCharge")}
      </label>

      <div>
        <h3 className="text-sm font-medium mb-2">{t("lineItems.title")}</h3>
        <LineItemsEditor
          initialLines={[emptyLine]}
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
          <Label htmlFor="notesToClient">{t("fields.notesToClient")}</Label>
          <textarea
            id="notesToClient"
            name="notesToClient"
            className="h-24 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notesInternal">{t("fields.notesInternal")}</Label>
          <textarea
            id="notesInternal"
            name="notesInternal"
            className="h-24 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {tSet("save")}
        </Button>
        <Link href="/recurring">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}
