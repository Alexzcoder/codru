"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { calculateLine } from "@/lib/line-items";
import type { ItemTemplateState } from "./actions";

type Option = { id: string; name: string };
type TaxOption = { id: string; label: string; percent: string };

type Initial = {
  id?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  unitId?: string;
  defaultQuantity?: string;
  defaultMarkupPercent?: string | null;
  defaultUnitPrice?: string;
  defaultTaxRateId?: string;
  defaultTaxMode?: "NET" | "GROSS";
};

export function ItemTemplateForm({
  initial,
  units,
  categories,
  taxRates,
  action,
}: {
  initial?: Initial;
  units: Option[];
  categories: Option[];
  taxRates: TaxOption[];
  action: (prev: ItemTemplateState, formData: FormData) => Promise<ItemTemplateState>;
}) {
  const t = useTranslations("ItemTemplates");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<ItemTemplateState, FormData>(
    action,
    {},
  );

  // Controlled inputs for live preview.
  const [markup, setMarkup] = useState(initial?.defaultMarkupPercent ?? "");
  const [unitPrice, setUnitPrice] = useState(initial?.defaultUnitPrice ?? "0.00");
  const [quantity, setQuantity] = useState(initial?.defaultQuantity ?? "1");
  const [taxRateId, setTaxRateId] = useState(
    initial?.defaultTaxRateId ?? taxRates[0]?.id ?? "",
  );
  const [taxMode, setTaxMode] = useState<"NET" | "GROSS">(
    initial?.defaultTaxMode ?? "NET",
  );

  const selectedRate = taxRates.find((r) => r.id === taxRateId);
  const ratePercent = selectedRate?.percent ?? "0";


  const preview = useMemo(() => {
    try {
      return calculateLine({
        quantity,
        unitPrice,
        taxRatePercent: ratePercent,
        taxMode,
      });
    } catch {
      return null;
    }
  }, [quantity, unitPrice, ratePercent, taxMode]);

  return (
    <form action={formAction} className="grid max-w-4xl gap-8 md:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">{t("fields.name")}</Label>
          <Input
            id="name"
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("fields.description")}</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="categoryId">{t("fields.category")}</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={initial?.categoryId ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitId">{t("fields.unit")}</Label>
            <select
              id="unitId"
              name="unitId"
              defaultValue={initial?.unitId ?? units[0]?.id ?? ""}
              required
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="defaultQuantity">{t("fields.defaultQuantity")}</Label>
            <Input
              id="defaultQuantity"
              name="defaultQuantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultMarkupPercent">
              {t("fields.defaultMarkupPercent")}
            </Label>
            <Input
              id="defaultMarkupPercent"
              name="defaultMarkupPercent"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultUnitPrice">{t("fields.defaultUnitPrice")}</Label>
          <Input
            id="defaultUnitPrice"
            name="defaultUnitPrice"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            inputMode="decimal"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="defaultTaxRateId">{t("fields.defaultTaxRate")}</Label>
            <select
              id="defaultTaxRateId"
              name="defaultTaxRateId"
              value={taxRateId}
              onChange={(e) => setTaxRateId(e.target.value)}
              required
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {taxRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultTaxMode">{t("fields.defaultTaxMode")}</Label>
            <select
              id="defaultTaxMode"
              name="defaultTaxMode"
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as "NET" | "GROSS")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="NET">{t("fields.taxModeNet")}</option>
              <option value="GROSS">{t("fields.taxModeGross")}</option>
            </select>
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
          <Link href="/settings/item-templates">
            <Button type="button" variant="ghost">
              {tSet("cancel")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Live preview */}
      <aside className="rounded-xl border border-border bg-secondary/40 p-4">
        <h3 className="text-sm font-medium">{t("preview.title")}</h3>
        {preview ? (
          <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t("preview.qty")}</dt>
            <dd className="text-right tabular-nums">{quantity}</dd>
            <dt className="text-muted-foreground">{t("preview.unitPrice")}</dt>
            <dd className="text-right tabular-nums">{unitPrice}</dd>
            <dt className="text-muted-foreground">{t("preview.rate")}</dt>
            <dd className="text-right tabular-nums">{ratePercent}%</dd>
            <dt className="text-muted-foreground">Mode</dt>
            <dd className="text-right text-xs">
              {taxMode === "NET" ? "net" : "gross"}
            </dd>
            <div className="col-span-2 my-2 border-t border-border" />
            <dt className="text-muted-foreground">{t("preview.net")}</dt>
            <dd className="text-right tabular-nums">{preview.net}</dd>
            <dt className="text-muted-foreground">{t("preview.tax")}</dt>
            <dd className="text-right tabular-nums">{preview.tax}</dd>
            <dt className="font-medium">{t("preview.gross")}</dt>
            <dd className="text-right font-medium tabular-nums">{preview.gross}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">—</p>
        )}
      </aside>
    </form>
  );
}
