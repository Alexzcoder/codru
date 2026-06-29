"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Expense } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import type { ExpenseState } from "./actions";
import { scanReceipt } from "./scan-actions";
import { CompressingFileInput } from "@/components/compressing-file-input";
import { compressImage } from "@/lib/image-compress";
import { JobCombobox } from "@/components/job-combobox";

type Initial = Partial<Expense>;

export function ExpenseForm({
  initial,
  categories,
  jobs,
  action,
}: {
  initial?: Initial;
  categories: { id: string; name: string }[];
  jobs: { id: string; title: string }[];
  action: (prev: ExpenseState, formData: FormData) => Promise<ExpenseState>;
}) {
  const t = useTranslations("Expenses");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<ExpenseState, FormData>(
    action,
    {},
  );

  const [net, setNet] = useState(initial?.netAmount?.toString() ?? "0.00");
  const [rate, setRate] = useState(initial?.vatRatePercent?.toString() ?? "21");
  // VAT amount follows net×rate automatically; a manual edit pins it (override).
  const [vatManual, setVatManual] = useState(initial?.vatAmount?.toString() ?? "");
  const [vatTouched, setVatTouched] = useState(initial?.vatAmount != null);
  const [reverseCharge, setReverseCharge] = useState(
    initial?.reverseCharge ?? false,
  );
  const [date, setDate] = useState(toDateInput(initial?.date ?? new Date()));
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scanPending, startScan] = useTransition();
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const onScanFile = async (original: File | null) => {
    if (!original) return;
    setScanError(null);
    setScanInfo(null);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(original.type)) {
      setScanError("Use a JPEG / PNG / WebP / GIF photo.");
      return;
    }
    // Downscale first so big phone photos fit comfortably under the scan cap.
    const file = await compressImage(original, { maxEdge: 2200, minBytes: 300 * 1024 });
    if (file.size > 5 * 1024 * 1024) {
      setScanError("Receipt photo too large (max 5 MB).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) {
      setScanError("Could not read photo.");
      return;
    }
    startScan(async () => {
      const r = await scanReceipt({
        mediaType: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        base64: m[2],
      });
      if (!r.ok) {
        setScanError(r.message);
        return;
      }
      const s = r.scan;
      if (s.supplier) setSupplier(s.supplier);
      if (s.date) setDate(s.date.slice(0, 10));
      if (s.description) setDescription(s.description);
      if (s.vatRatePercent != null) setRate(String(s.vatRatePercent));
      // Let VAT re-derive from the scanned net × rate.
      setVatTouched(false);
      // Prefer net if printed; else derive from total + vat rate.
      if (s.netAmount != null) {
        setNet(s.netAmount.toFixed(2));
      } else if (s.totalAmount != null) {
        const r = s.vatRatePercent ?? 21;
        const netFromTotal = s.totalAmount / (1 + r / 100);
        setNet(netFromTotal.toFixed(2));
      }
      setScanInfo(
        `Filled from photo. Cost ≈ $${s.estimatedCostUsd.toFixed(4)}. Confirm before saving.`,
      );
    });
  };

  // parseFloat tolerates a trailing "." and junk -> NaN, which we coerce to 0
  // so the live preview never shows NaN. Czech comma is normalized too.
  const num = (s: string) => {
    const n = Number.parseFloat((s || "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const autoVat = useMemo(() => {
    if (reverseCharge) return "0.00";
    return ((num(net) * num(rate)) / 100).toFixed(2);
  }, [net, rate, reverseCharge]);

  // Shown/submitted VAT: the manual override if the user touched it, else auto.
  const vat = reverseCharge ? "0.00" : vatTouched ? vatManual : autoVat;

  const total = useMemo(
    () => (num(net) + num(vat)).toFixed(2),
    [net, vat],
  );

  return (
    <form action={formAction} className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-emerald-900">Scan receipt with AI</p>
            <p className="text-[11px] text-emerald-900/70">
              Snap a photo of the receipt — Claude reads supplier, date, amount, and VAT (~$0.02 / scan).
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onScanFile(e.target.files?.[0] ?? null)}
            />
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
              <Sparkles size={14} /> {scanPending ? "Reading…" : "Scan receipt"}
            </span>
          </label>
        </div>
        {scanInfo && (
          <p className="mt-2 text-xs text-emerald-900/80">{scanInfo}</p>
        )}
        {scanError && <p className="mt-2 text-xs text-red-700">{scanError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="date">{t("fields.date")}</Label>
          <Input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoryId">{t("fields.category")}</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initial?.categoryId ?? categories[0]?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <Label htmlFor="paymentMethod">{t("fields.paymentMethod")}</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={initial?.paymentMethod ?? "BANK"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="BANK">{t("methods.BANK")}</option>
            <option value="CASH">{t("methods.CASH")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier">{t("fields.supplier")}</Label>
          <Input
            id="supplier"
            name="supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">{t("fields.job")}</Label>
          <JobCombobox
            id="jobId"
            name="jobId"
            jobs={jobs}
            defaultValue={initial?.jobId ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("fields.description")}</Label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            value={vat}
            onChange={(e) => {
              setVatTouched(true);
              setVatManual(e.target.value);
            }}
            disabled={reverseCharge}
            inputMode="decimal"
            placeholder={autoVat}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("fields.totalAmount")}</Label>
          <div className="h-9 flex items-center rounded-xl border border-border bg-secondary/40 px-2 text-sm font-medium tabular-nums">
            {total}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{t("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? "CZK"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
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
        <input
          type="checkbox"
          name="taxDeductible"
          defaultChecked={initial?.taxDeductible ?? true}
        />
        {t("fields.taxDeductible")}
      </label>

      <div className="space-y-2">
        <Label htmlFor="receipt">{t("fields.receipt")}</Label>
        <CompressingFileInput
          id="receipt"
          name="receipt"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none cursor-pointer file:cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {initial?.receiptPath && (
          <p className="text-xs text-muted-foreground">
            Current: <a href={initial.receiptPath} target="_blank" rel="noreferrer" className="underline">{initial.receiptPath}</a>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t("actions.save")}
        </Button>
        <Link href="/expenses">
          <Button type="button" variant="ghost">
            {tSet("cancel")}
          </Button>
        </Link>
      </div>
    </form>
  );
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
