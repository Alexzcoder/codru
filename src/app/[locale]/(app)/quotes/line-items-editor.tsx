"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { calculateDocument } from "@/lib/line-items";

export type EditorLine = {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRatePercent: string;
  taxMode: "NET" | "GROSS";
  lineDiscountPercent: string;
  lineDiscountAmount: string;
};

export type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  defaultQuantity: string;
  unitName: string;
  defaultUnitPrice: string;
  defaultTaxRatePercent: string;
  defaultTaxMode: "NET" | "GROSS";
};

export type TaxRateOption = { id: string; label: string; percent: string };

const EMPTY_LINE: EditorLine = {
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

export function LineItemsEditor({
  initialLines,
  templates,
  taxRates,
  currency,
  documentDiscountPercent,
  documentDiscountAmount,
  reverseCharge,
}: {
  initialLines: EditorLine[];
  templates: TemplateOption[];
  taxRates: TaxRateOption[];
  currency: string;
  documentDiscountPercent: string;
  documentDiscountAmount: string;
  reverseCharge: boolean;
}) {
  const t = useTranslations("Quotes.lineItems");
  const tTotals = useTranslations("Quotes.totals");
  const [lines, setLines] = useState<EditorLine[]>(
    initialLines.length > 0 ? initialLines : [EMPTY_LINE],
  );
  const [templateId, setTemplateId] = useState<string>("");

  const totals = useMemo(
    () =>
      calculateDocument({
        lines: lines.map((l) => ({
          quantity: l.quantity || "0",
          unitPrice: l.unitPrice || "0",
          taxRatePercent: l.taxRatePercent || "0",
          taxMode: l.taxMode,
          lineDiscountPercent: l.lineDiscountPercent || null,
          lineDiscountAmount: l.lineDiscountAmount || null,
        })),
        documentDiscountPercent: documentDiscountPercent || null,
        documentDiscountAmount: documentDiscountAmount || null,
        reverseCharge,
      }),
    [lines, documentDiscountPercent, documentDiscountAmount, reverseCharge],
  );

  const addBlank = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  const addFromTemplate = () => {
    const tmpl = templates.find((x) => x.id === templateId);
    if (!tmpl) return;
    setLines((ls) => [
      ...ls,
      {
        name: tmpl.name,
        description: tmpl.description ?? "",
        quantity: tmpl.defaultQuantity,
        unit: tmpl.unitName,
        unitPrice: tmpl.defaultUnitPrice,
        taxRatePercent: tmpl.defaultTaxRatePercent,
        taxMode: tmpl.defaultTaxMode,
        lineDiscountPercent: "",
        lineDiscountAmount: "",
      },
    ]);
    setTemplateId("");
  };
  const update = (i: number, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) =>
    setLines((ls) => ls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {/* Hidden input that submits the full line array to the server action */}
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />

      <div className="flex items-end gap-2">
        <div className="flex-1 max-w-xs">
          <Label htmlFor="templatePicker">{t("fromTemplate")}</Label>
          <select
            id="templatePicker"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!templateId}
          onClick={addFromTemplate}
        >
          {t("addLine")} ↑
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addBlank}>
          + {t("addLine")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="w-6 px-2 py-2 text-left">{t("position")}</th>
              <th className="px-2 py-2 text-left">{t("name")}</th>
              <th className="px-2 py-2 text-right w-20">{t("qty")}</th>
              <th className="px-2 py-2 text-left w-16">{t("unit")}</th>
              <th className="px-2 py-2 text-right w-24">{t("unitPrice")}</th>
              <th className="px-2 py-2 text-right w-20">{t("taxRate")}</th>
              <th className="px-2 py-2 text-right w-24">{t("taxMode")}</th>
              <th className="px-2 py-2 text-right w-24">{t("lineDiscount")}</th>
              <th className="px-2 py-2 text-right w-28">{t("lineTotal")}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="px-2 py-1 text-xs text-neutral-400">{i + 1}</td>
                <td className="px-2 py-1">
                  <Input
                    value={l.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder={t("name")}
                    className="h-8"
                    required
                  />
                  <Input
                    value={l.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder={t("description")}
                    className="mt-1 h-7 text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={l.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    className="h-8 text-right"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={l.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={l.unitPrice}
                    onChange={(e) => update(i, { unitPrice: e.target.value })}
                    className="h-8 text-right"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={l.taxRatePercent}
                    onChange={(e) => update(i, { taxRatePercent: e.target.value })}
                    className="h-8 w-full rounded-md border border-neutral-300 bg-white px-1 text-sm"
                  >
                    {taxRates.map((r) => (
                      <option key={r.id} value={r.percent}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={l.taxMode}
                    onChange={(e) =>
                      update(i, { taxMode: e.target.value as "NET" | "GROSS" })
                    }
                    className="h-8 w-full rounded-md border border-neutral-300 bg-white px-1 text-sm"
                  >
                    <option value="NET">net</option>
                    <option value="GROSS">gross</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={l.lineDiscountPercent}
                    onChange={(e) =>
                      update(i, { lineDiscountPercent: e.target.value })
                    }
                    className="h-8 text-right"
                    inputMode="decimal"
                    placeholder="%"
                  />
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {totals.lines[i]
                    ? formatMoney(totals.lines[i].gross, currency)
                    : "—"}
                </td>
                <td className="px-2 py-1">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-xs text-red-600"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="flex justify-end">
        <dl className="w-72 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          <Row label={tTotals("subtotal")} value={formatMoney(totals.subtotalNet, currency)} />
          {totals.documentDiscount !== "0.00" && (
            <Row label={tTotals("documentDiscount")} value={`−${formatMoney(totals.documentDiscount, currency)}`} />
          )}
          {!reverseCharge &&
            totals.taxBands.map((b) => (
              <Row
                key={b.ratePercent}
                label={`${tTotals("tax")} ${formatRate(b.ratePercent)}`}
                value={formatMoney(b.tax, currency)}
              />
            ))}
          <div className="flex justify-between px-3 py-2 bg-neutral-900 text-white rounded-b-md">
            <span className="font-bold">{tTotals("totalGross")}</span>
            <span className="font-bold tabular-nums">
              {formatMoney(totals.totalGross, currency)}
            </span>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function formatMoney(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  const s = n
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    .replace(".", ",");
  return currency === "CZK" ? `${s} Kč` : `${s} ${currency}`;
}

function formatRate(p: string) {
  const n = Number.parseFloat(p);
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(2)}%`;
}
