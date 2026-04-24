"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { PaymentState } from "./actions";

export type ClientChoice = {
  id: string;
  name: string;
  preferredCurrency: string;
};

export type OpenInvoice = {
  id: string;
  type: "ADVANCE_INVOICE" | "FINAL_INVOICE";
  number: string | null;
  clientId: string;
  currency: string;
  gross: string;
  allocated: string;
  outstanding: string;
  dueDate: string | null;
};

type Initial = {
  clientId?: string;
  date?: Date;
  method?: "BANK_TRANSFER" | "CASH" | "OTHER";
  amount?: string;
  currency?: string;
  reference?: string | null;
  notes?: string | null;
  allocations?: { documentId: string; amount: string }[];
};

export function PaymentForm({
  initial,
  clients,
  openInvoices,
  preselectDocumentId,
  action,
}: {
  initial?: Initial;
  clients: ClientChoice[];
  openInvoices: OpenInvoice[];
  preselectDocumentId?: string;
  action: (prev: PaymentState, formData: FormData) => Promise<PaymentState>;
}) {
  const t = useTranslations("Payments");
  const tSet = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<PaymentState, FormData>(
    action,
    {},
  );

  const preselectInvoice = preselectDocumentId
    ? openInvoices.find((i) => i.id === preselectDocumentId)
    : null;

  const [clientId, setClientId] = useState(
    initial?.clientId ?? preselectInvoice?.clientId ?? "",
  );
  const [currency, setCurrency] = useState(
    initial?.currency ?? preselectInvoice?.currency ?? "CZK",
  );
  const [amount, setAmount] = useState(
    initial?.amount ?? preselectInvoice?.outstanding ?? "0.00",
  );
  const [alloc, setAlloc] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (initial?.allocations) {
      for (const a of initial.allocations) seed[a.documentId] = a.amount;
    } else if (preselectInvoice) {
      seed[preselectInvoice.id] = preselectInvoice.outstanding;
    }
    return seed;
  });

  const invoicesForClient = openInvoices.filter(
    (i) => i.clientId === clientId && i.currency === currency,
  );

  const allocated = useMemo(
    () =>
      Object.entries(alloc).reduce((s, [id, v]) => {
        if (invoicesForClient.some((i) => i.id === id))
          return s + Number.parseFloat(v || "0");
        return s;
      }, 0),
    [alloc, invoicesForClient],
  );
  const total = Number.parseFloat(amount || "0");
  const remainder = total - allocated;

  const setAllocFor = (id: string, value: string) =>
    setAlloc((prev) => ({ ...prev, [id]: value }));

  const fillRemaining = (invoiceId: string) => {
    const invoice = invoicesForClient.find((i) => i.id === invoiceId);
    if (!invoice) return;
    const current = Number.parseFloat(alloc[invoiceId] ?? "0");
    const want = Math.min(
      Number.parseFloat(invoice.outstanding),
      current + Math.max(remainder, 0),
    );
    setAllocFor(invoiceId, want.toFixed(2));
  };

  const distributeProportional = () => {
    if (invoicesForClient.length === 0 || total <= 0) return;
    const totalOutstanding = invoicesForClient.reduce(
      (s, i) => s + Number.parseFloat(i.outstanding),
      0,
    );
    if (totalOutstanding <= 0) return;
    const next: Record<string, string> = { ...alloc };
    let assigned = 0;
    invoicesForClient.forEach((i, idx) => {
      if (idx === invoicesForClient.length - 1) {
        next[i.id] = (total - assigned).toFixed(2);
      } else {
        const share = Math.min(
          Number.parseFloat(i.outstanding),
          (Number.parseFloat(i.outstanding) / totalOutstanding) * total,
        );
        const rounded = Math.round(share * 100) / 100;
        assigned += rounded;
        next[i.id] = rounded.toFixed(2);
      }
    });
    setAlloc(next);
  };

  const allocationsJson = JSON.stringify(
    Object.entries(alloc)
      .filter(([id]) => invoicesForClient.some((i) => i.id === id))
      .map(([documentId, amt]) => ({ documentId, amount: amt })),
  );

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="allocationsJson" value={allocationsJson} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="clientId">{t("fields.client")}</Label>
          <select
            id="clientId"
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAlloc({});
              const c = clients.find((x) => x.id === e.target.value);
              if (c) setCurrency(c.preferredCurrency);
            }}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
          <Label htmlFor="date">{t("fields.date")}</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={toDateInput(initial?.date ?? new Date())}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">{t("fields.method")}</Label>
          <select
            id="method"
            name="method"
            defaultValue={initial?.method ?? "BANK_TRANSFER"}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="BANK_TRANSFER">{t("methods.BANK_TRANSFER")}</option>
            <option value="CASH">{t("methods.CASH")}</option>
            <option value="OTHER">{t("methods.OTHER")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="amount">{t("fields.amount")}</Label>
          <Input
            id="amount"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{t("fields.currency")}</Label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setAlloc({});
            }}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reference">{t("fields.reference")}</Label>
          <Input
            id="reference"
            name="reference"
            defaultValue={initial?.reference ?? ""}
          />
        </div>
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium">{t("allocations.title")}</legend>
        {!clientId ? (
          <p className="text-sm text-neutral-500">{t("allocations.pickClientFirst")}</p>
        ) : invoicesForClient.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("allocations.noOpenInvoices")}</p>
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={distributeProportional}
              >
                {t("allocations.distribute")}
              </Button>
            </div>
            <ul className="space-y-2">
              {invoicesForClient.map((i) => (
                <li
                  key={i.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 text-sm"
                >
                  <span className="font-medium">{i.number ?? "(draft)"}</span>
                  <span className="text-xs text-neutral-500">
                    {i.type === "ADVANCE_INVOICE" ? "Advance" : "Final"}
                    {i.dueDate ? ` · due ${i.dueDate}` : ""}
                  </span>
                  <span className="tabular-nums text-xs text-neutral-500">
                    {t("allocations.outstanding")}: {i.outstanding} {i.currency}
                  </span>
                  <Input
                    value={alloc[i.id] ?? ""}
                    onChange={(e) => setAllocFor(i.id, e.target.value)}
                    inputMode="decimal"
                    className="w-28 text-right"
                    placeholder="0.00"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => fillRemaining(i.id)}
                  >
                    {t("allocations.fillRemaining")}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-end gap-6 text-sm">
              <div>
                <span className="text-neutral-500">{t("allocations.total")}: </span>
                <span className="tabular-nums font-medium">{total.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-neutral-500">{t("allocations.allocated")}: </span>
                <span className="tabular-nums font-medium">{allocated.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-neutral-500">{t("allocations.remainder")}: </span>
                <span
                  className={`tabular-nums font-medium ${remainder < 0 ? "text-amber-700" : remainder > 0 ? "text-red-600" : "text-green-700"}`}
                >
                  {remainder.toFixed(2)}
                </span>
              </div>
            </div>
            {remainder < 0 && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {t("allocations.overpayment", {
                  amount: Math.abs(remainder).toFixed(2),
                  currency,
                })}
              </p>
            )}
          </>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="h-20 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !clientId}>
          {t("actions.save")}
        </Button>
        <Link href="/payments">
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
