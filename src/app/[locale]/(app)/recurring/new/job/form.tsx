"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RecurrenceFields } from "../../recurrence-fields";
import type { RuleState } from "../../actions";

type SimpleInvoiceLine = {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRatePercent: string;
};

export function JobRuleForm({
  clients,
  users,
  companyProfiles,
  documentTemplates,
  defaultTaxRatePercent,
  action,
}: {
  clients: { id: string; name: string }[];
  users: { id: string; name: string; calendarColor: string }[];
  companyProfiles: { id: string; name: string }[];
  documentTemplates: { id: string; name: string }[];
  defaultTaxRatePercent: string;
  action: (prev: RuleState, formData: FormData) => Promise<RuleState>;
}) {
  const t = useTranslations("Jobs");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<RuleState, FormData>(action, {});
  const [assignees, setAssignees] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const n = new Set(assignees);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setAssignees(n);
  };

  const [autoInvoice, setAutoInvoice] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<SimpleInvoiceLine[]>([
    { name: "", quantity: "1", unit: "ks", unitPrice: "0.00", taxRatePercent: defaultTaxRatePercent },
  ]);
  const updateLine = (i: number, patch: Partial<SimpleInvoiceLine>) =>
    setInvoiceLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setInvoiceLines((ls) => [
      ...ls,
      { name: "", quantity: "1", unit: "ks", unitPrice: "0.00", taxRatePercent: defaultTaxRatePercent },
    ]);
  const removeLine = (i: number) =>
    setInvoiceLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  // Marshal the simple lines into the InvoiceLinePayload shape the runner expects.
  const linesPayload = invoiceLines.map((l) => ({
    name: l.name,
    description: null,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    taxRatePercent: l.taxRatePercent,
    taxMode: "NET" as const,
    lineDiscountPercent: null,
    lineDiscountAmount: null,
  }));

  return (
    <form action={formAction} className="space-y-8">
      <RecurrenceFields />

      <input type="hidden" name="assignees" value={Array.from(assignees).join(",")} />

      <div className="space-y-2">
        <Label htmlFor="title">{t("form.title")}</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clientId">{t("form.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={clients[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="startHour">Start hour</Label>
          <Input
            id="startHour"
            name="startHour"
            type="number"
            min={0}
            max={23}
            defaultValue={9}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationHours">Duration (hours)</Label>
          <Input
            id="durationHours"
            name="durationHours"
            type="number"
            min={0}
            max={24}
            defaultValue={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationDays">Duration (extra days)</Label>
          <Input
            id="durationDays"
            name="durationDays"
            type="number"
            min={0}
            max={90}
            defaultValue={0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("form.assignees")}</Label>
        <div className="flex flex-wrap gap-2">
          {users.map((u) => {
            const active = assignees.has(u.id);
            return (
              <label
                key={u.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={active}
                  onChange={() => toggle(u.id)}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: u.calendarColor }}
                />
                {u.name}
              </label>
            );
          })}
        </div>
      </div>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm text-muted-foreground">{t("form.sitePrefix")}</legend>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="siteStreet">{t("form.street")}</Label>
            <Input id="siteStreet" name="siteStreet" />
          </div>
          <div className="grid grid-cols-[1fr_140px_100px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="siteCity">{t("form.city")}</Label>
              <Input id="siteCity" name="siteCity" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteZip">{t("form.zip")}</Label>
              <Input id="siteZip" name="siteZip" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteCountry">{t("form.country")}</Label>
              <Input id="siteCountry" name="siteCountry" />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Auto-invoice each cycle */}
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Also generate an invoice each cycle</legend>
        <input type="hidden" name="autoInvoice" value={autoInvoice ? "1" : ""} />
        <input
          type="hidden"
          name="invoiceLinesJson"
          value={JSON.stringify(linesPayload)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoInvoice}
            onChange={(e) => setAutoInvoice(e.target.checked)}
          />
          Yes — emit a draft FINAL_INVOICE on every run (linked to the new job)
        </label>

        {autoInvoice && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceCompanyProfileId">Company profile</Label>
                <select
                  id="invoiceCompanyProfileId"
                  name="invoiceCompanyProfileId"
                  defaultValue={companyProfiles[0]?.id ?? ""}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  required={autoInvoice}
                >
                  {companyProfiles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDocumentTemplateId">Document template</Label>
                <select
                  id="invoiceDocumentTemplateId"
                  name="invoiceDocumentTemplateId"
                  defaultValue={documentTemplates[0]?.id ?? ""}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  required={autoInvoice}
                >
                  {documentTemplates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invoiceCurrency">Currency</Label>
                <select
                  id="invoiceCurrency"
                  name="invoiceCurrency"
                  defaultValue="CZK"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="CZK">CZK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceLocale">Language</Label>
                <select
                  id="invoiceLocale"
                  name="invoiceLocale"
                  defaultValue="cs"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="cs">Čeština</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDueInDays">Due in (days)</Label>
                <Input
                  id="invoiceDueInDays"
                  name="invoiceDueInDays"
                  type="number"
                  min={0}
                  max={180}
                  defaultValue={14}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Lines
              </p>
              <div className="mt-2 space-y-2">
                {invoiceLines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_60px_90px_70px_30px] gap-2">
                    <Input
                      placeholder="Name"
                      value={l.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      required={autoInvoice}
                    />
                    <Input
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      inputMode="decimal"
                      className="text-right"
                    />
                    <Input
                      placeholder="Unit"
                      value={l.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                    />
                    <Input
                      placeholder="Unit price"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      inputMode="decimal"
                      className="text-right"
                    />
                    <Input
                      placeholder="VAT %"
                      value={l.taxRatePercent}
                      onChange={(e) => updateLine(i, { taxRatePercent: e.target.value })}
                      inputMode="decimal"
                      className="text-right"
                    />
                    {invoiceLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-xs text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={addLine}
              >
                + Line
              </Button>
            </div>
          </div>
        )}
      </fieldset>

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
