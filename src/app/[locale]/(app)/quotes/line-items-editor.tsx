"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X as XIcon } from "lucide-react";
import { calculateDocument } from "@/lib/line-items";
import {
  PriceSuggesterButton,
  PriceSuggesterModal,
  type SuggesterTarget,
  type SitePhoto,
} from "@/components/price-suggester";

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
  const [suggesterTarget, setSuggesterTarget] = useState<SuggesterTarget | null>(null);
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  const onPhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    const accepted: SitePhoto[] = [];
    for (const file of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        setPhotoError(`${file.name}: only JPEG/PNG/WebP/GIF`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError(`${file.name}: max 5 MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) continue;
      accepted.push({
        name: file.name,
        mediaType: m[1] as SitePhoto["mediaType"],
        base64: m[2],
        previewUrl: dataUrl,
      });
    }
    setPhotos((prev) => [...prev, ...accepted].slice(0, 4));
  };
  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      {/* Hidden input that submits the full line array to the server action */}
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />

      {/* Site photos — used by the AI price suggester. Not persisted with the
          document; they live only in the browser session. */}
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium">Site photos for AI</p>
            <p className="text-[11px] text-muted-foreground">
              Up to 4 photos · used when you ask Claude for a price · not saved with the quote
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => onPhotoFiles(e.target.files)}
            />
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">
              <Camera size={14} /> Add photos
            </span>
          </label>
        </div>
        {photoError && (
          <p className="mt-2 text-xs text-red-600">{photoError}</p>
        )}
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="group relative h-16 w-16 overflow-hidden rounded-md border border-border bg-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
                  aria-label="Remove photo"
                >
                  <XIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 max-w-xs">
          <Label htmlFor="templatePicker">{t("fromTemplate")}</Label>
          <select
            id="templatePicker"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
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
          <tbody className="divide-y divide-border">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="px-2 py-1 text-xs text-muted-foreground">{i + 1}</td>
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
                  <div className="flex items-center gap-1">
                    <Input
                      value={l.unitPrice}
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
                      className="h-8 text-right"
                      inputMode="decimal"
                    />
                    <PriceSuggesterButton
                      description={`${l.name} ${l.description}`.trim()}
                      onOpen={() =>
                        setSuggesterTarget({
                          rowIndex: i + 1,
                          description: `${l.name} ${l.description}`.trim(),
                          contextLines: lines
                            .slice(0, i)
                            .filter((x) => x.name.trim().length > 0)
                            .map((x) => ({ name: x.name, description: x.description })),
                          photos,
                        })
                      }
                    />
                  </div>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={l.taxRatePercent}
                    onChange={(e) => update(i, { taxRatePercent: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm"
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
                    className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm"
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
        <dl className="w-72 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
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
          <div className="flex justify-between px-3 py-2 bg-primary text-primary-foreground rounded-b-md">
            <span className="font-bold">{tTotals("totalGross")}</span>
            <span className="font-bold tabular-nums">
              {formatMoney(totals.totalGross, currency)}
            </span>
          </div>
        </dl>
      </aside>

      <PriceSuggesterModal
        target={suggesterTarget}
        onClose={() => setSuggesterTarget(null)}
        onApply={(rowIndex, unitPrice, unit) =>
          setLines((ls) =>
            ls.map((l, idx) =>
              idx === rowIndex - 1
                ? {
                    ...l,
                    unitPrice,
                    ...(unit && !l.unit ? { unit } : {}),
                  }
                : l,
            ),
          )
        }
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
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
