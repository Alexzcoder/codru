"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RecurrenceFields } from "../../recurrence-fields";
import type { RuleState } from "../../actions";

export function ExpenseRuleForm({
  categories,
  jobs,
  action,
}: {
  categories: { id: string; name: string }[];
  jobs: { id: string; title: string }[];
  action: (prev: RuleState, formData: FormData) => Promise<RuleState>;
}) {
  const t = useTranslations("Expenses");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<RuleState, FormData>(action, {});
  const [net, setNet] = useState("0.00");
  const [rate, setRate] = useState("21");
  const [reverseCharge, setReverseCharge] = useState(false);
  const autoVat = useMemo(() => {
    if (reverseCharge) return "0.00";
    return (
      (Number.parseFloat(net || "0") * Number.parseFloat(rate || "0")) /
      100
    ).toFixed(2);
  }, [net, rate, reverseCharge]);

  return (
    <form action={formAction} className="space-y-8">
      <RecurrenceFields />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="categoryId">{t("fields.category")}</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categories[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">{t("fields.supplier")}</Label>
          <Input id="supplier" name="supplier" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentMethod">{t("fields.paymentMethod")}</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue="BANK"
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="BANK">{t("methods.BANK")}</option>
            <option value="CASH">{t("methods.CASH")}</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("fields.description")}</Label>
        <textarea
          id="description"
          name="description"
          required
          className="h-20 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="netAmount">{t("fields.netAmount")}</Label>
          <Input
            id="netAmount"
            name="netAmount"
            value={net}
            onChange={(e) => setNet(e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatRatePercent">{t("fields.vatRate")}</Label>
          <Input
            id="vatRatePercent"
            name="vatRatePercent"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatAmount">{t("fields.vatAmount")}</Label>
          <Input
            id="vatAmount"
            name="vatAmount"
            defaultValue={autoVat}
            placeholder={autoVat}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{t("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            defaultValue="CZK"
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
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
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="taxDeductible" defaultChecked />
        {t("fields.taxDeductible")}
      </label>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          className="h-20 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
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
