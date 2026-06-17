"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X as XIcon, Plus } from "lucide-react";
import { updateProtocol, type ProtocolState } from "./actions";

export type ProtocolItem = {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  completed: boolean;
  notCompleted: boolean;
  note: string;
};

export type ProtocolFormValues = {
  number: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  siteAddress: string;
  zakazkaNumber: string;
  contractorName: string;
  leaderName: string;
  realizationDate: string;
  signedAt: string;
  vicepraceDone: boolean;
  vicepraceDescription: string;
  vicepracePrice: string;
  vicepraceConsent: string;
  usedMaterials: string;
  wasteGenerated: string;
  wasteRemoved: string;
  photosBeforeTaken: boolean;
  photosDuringTaken: boolean;
  photosAfterTaken: boolean;
  acceptance:
    | "PENDING"
    | "ACCEPTED_NO_ISSUES"
    | "ACCEPTED_WITH_RESERVATIONS"
    | "NOT_ACCEPTED"
    | "CLIENT_ABSENT";
  clientReservations: string;
  contractorNote: string;
  status: "DRAFT" | "COMPLETED";
  items: ProtocolItem[];
};

const EMPTY_ITEM: ProtocolItem = {
  name: "",
  description: "",
  quantity: "",
  unit: "",
  completed: false,
  notCompleted: false,
  note: "",
};

export function ProtocolForm({
  protocolId,
  initial,
  printHref,
  blankPrintHref,
}: {
  protocolId: string;
  initial: ProtocolFormValues;
  printHref: string;
  blankPrintHref: string;
}) {
  const t = useTranslations("HandoverProtocols");

  const [values, setValues] = useState<ProtocolFormValues>(initial);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const prevPendingRef = useRef(false);

  const action = updateProtocol.bind(null, protocolId);
  const [state, formAction, pending] = useActionState<ProtocolState, FormData>(
    action,
    {},
  );

  // Detect the transition from "submitting" → "done with no error" and show
  // a transient "Saved at HH:MM:SS" message. Updating state inside the effect
  // body is OK here because the trigger is an external boundary (the action
  // finished), not state we derived during render.
  useEffect(() => {
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;
    if (wasPending && !pending && !state?.error) {
      setSavedMessage(t("savedAt", { time: new Date().toLocaleTimeString() }));
      const tm = setTimeout(() => setSavedMessage(null), 3000);
      return () => clearTimeout(tm);
    }
  }, [pending, state, t]);

  function updateItem(idx: number, patch: Partial<ProtocolItem>) {
    setValues((v) => ({
      ...v,
      items: v.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }

  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(idx: number) {
    setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== idx) }));
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="itemsJson" value={JSON.stringify(values.items)} />

      {/* ─── Identity ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.identity")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label={t("fields.number")}
            name="number"
            value={values.number}
            onChange={(v) => setValues((s) => ({ ...s, number: v }))}
          />
          <Field
            label={t("fields.zakazkaNumber")}
            name="zakazkaNumber"
            value={values.zakazkaNumber}
            onChange={(v) => setValues((s) => ({ ...s, zakazkaNumber: v }))}
          />
          <Field
            label={t("fields.clientName")}
            name="clientName"
            required
            value={values.clientName}
            onChange={(v) => setValues((s) => ({ ...s, clientName: v }))}
          />
          <Field
            label={t("fields.clientPhone")}
            name="clientPhone"
            value={values.clientPhone}
            onChange={(v) => setValues((s) => ({ ...s, clientPhone: v }))}
          />
          <Field
            label={t("fields.clientEmail")}
            name="clientEmail"
            value={values.clientEmail}
            onChange={(v) => setValues((s) => ({ ...s, clientEmail: v }))}
          />
          <Field
            label={t("fields.siteAddress")}
            name="siteAddress"
            value={values.siteAddress}
            onChange={(v) => setValues((s) => ({ ...s, siteAddress: v }))}
          />
          <Field
            label={t("fields.contractorName")}
            name="contractorName"
            value={values.contractorName}
            onChange={(v) => setValues((s) => ({ ...s, contractorName: v }))}
          />
          <Field
            label={t("fields.leaderName")}
            name="leaderName"
            value={values.leaderName}
            onChange={(v) => setValues((s) => ({ ...s, leaderName: v }))}
          />
          <DateField
            label={t("fields.realizationDate")}
            name="realizationDate"
            value={values.realizationDate}
            onChange={(v) => setValues((s) => ({ ...s, realizationDate: v }))}
          />
          <DateField
            label={t("fields.signedAt")}
            name="signedAt"
            value={values.signedAt}
            onChange={(v) => setValues((s) => ({ ...s, signedAt: v }))}
          />
        </div>
      </section>

      {/* ─── Items ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sections.items")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("itemsHint")}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus size={14} className="mr-1" />
            {t("addItem")}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {values.items.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              {t("noItems")}
            </p>
          )}
          {values.items.map((it, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start gap-3">
                <span className="mt-2 select-none text-xs font-mono text-muted-foreground">
                  {idx + 1}.
                </span>
                <div className="grid flex-1 gap-2 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <Input
                      placeholder={t("fields.itemName")}
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      placeholder={t("fields.itemQty")}
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      placeholder={t("fields.itemUnit")}
                      value={it.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label="Remove"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <div className="md:col-span-12">
                    <Input
                      placeholder={t("fields.itemDescription")}
                      value={it.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Two checkboxes per item */}
              <div className="mt-3 flex flex-wrap items-center gap-4 pl-7">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={it.completed}
                    onChange={(e) =>
                      updateItem(idx, {
                        completed: e.target.checked,
                        // Mutually exclusive UX (only one toggled at a time)
                        notCompleted: e.target.checked ? false : it.notCompleted,
                      })
                    }
                  />
                  <span className="font-medium text-emerald-700">
                    {t("itemCompleted")}
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-rose-600"
                    checked={it.notCompleted}
                    onChange={(e) =>
                      updateItem(idx, {
                        notCompleted: e.target.checked,
                        completed: e.target.checked ? false : it.completed,
                      })
                    }
                  />
                  <span className="font-medium text-rose-700">
                    {t("itemNotCompleted")}
                  </span>
                </label>
                <Input
                  placeholder={t("fields.itemNote")}
                  className="flex-1 min-w-[200px]"
                  value={it.note}
                  onChange={(e) => updateItem(idx, { note: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Vícepráce ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.viceprace")}
        </h2>
        <label className="mt-4 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="vicepraceDone"
            value="true"
            checked={values.vicepraceDone}
            onChange={(e) =>
              setValues((s) => ({ ...s, vicepraceDone: e.target.checked }))
            }
          />
          {t("vicepraceDone")}
        </label>
        {values.vicepraceDone && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextAreaField
              label={t("fields.vicepraceDescription")}
              name="vicepraceDescription"
              value={values.vicepraceDescription}
              onChange={(v) =>
                setValues((s) => ({ ...s, vicepraceDescription: v }))
              }
            />
            <Field
              label={t("fields.vicepracePrice")}
              name="vicepracePrice"
              value={values.vicepracePrice}
              onChange={(v) => setValues((s) => ({ ...s, vicepracePrice: v }))}
            />
            <Field
              label={t("fields.vicepraceConsent")}
              name="vicepraceConsent"
              value={values.vicepraceConsent}
              onChange={(v) => setValues((s) => ({ ...s, vicepraceConsent: v }))}
            />
          </div>
        )}
      </section>

      {/* ─── Materials & waste ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.materialsWaste")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextAreaField
            label={t("fields.usedMaterials")}
            name="usedMaterials"
            value={values.usedMaterials}
            onChange={(v) => setValues((s) => ({ ...s, usedMaterials: v }))}
          />
          <TextAreaField
            label={t("fields.wasteGenerated")}
            name="wasteGenerated"
            value={values.wasteGenerated}
            onChange={(v) => setValues((s) => ({ ...s, wasteGenerated: v }))}
          />
          <Field
            label={t("fields.wasteRemoved")}
            name="wasteRemoved"
            value={values.wasteRemoved}
            onChange={(v) => setValues((s) => ({ ...s, wasteRemoved: v }))}
          />
        </div>
      </section>

      {/* ─── Photos ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.photos")}
        </h2>
        <div className="mt-4 grid gap-2">
          <CheckRow
            label={t("photosBefore")}
            name="photosBeforeTaken"
            checked={values.photosBeforeTaken}
            onChange={(v) =>
              setValues((s) => ({ ...s, photosBeforeTaken: v }))
            }
          />
          <CheckRow
            label={t("photosDuring")}
            name="photosDuringTaken"
            checked={values.photosDuringTaken}
            onChange={(v) =>
              setValues((s) => ({ ...s, photosDuringTaken: v }))
            }
          />
          <CheckRow
            label={t("photosAfter")}
            name="photosAfterTaken"
            checked={values.photosAfterTaken}
            onChange={(v) => setValues((s) => ({ ...s, photosAfterTaken: v }))}
          />
        </div>
      </section>

      {/* ─── Acceptance ─── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.acceptance")}
        </h2>
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground">
            {t("fields.acceptance")}
          </Label>
          <select
            name="acceptance"
            value={values.acceptance}
            onChange={(e) =>
              setValues((s) => ({
                ...s,
                acceptance: e.target.value as ProtocolFormValues["acceptance"],
              }))
            }
            className="mt-1 block w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="PENDING">{t("acceptanceLabel.PENDING")}</option>
            <option value="ACCEPTED_NO_ISSUES">
              {t("acceptanceLabel.ACCEPTED_NO_ISSUES")}
            </option>
            <option value="ACCEPTED_WITH_RESERVATIONS">
              {t("acceptanceLabel.ACCEPTED_WITH_RESERVATIONS")}
            </option>
            <option value="NOT_ACCEPTED">
              {t("acceptanceLabel.NOT_ACCEPTED")}
            </option>
            <option value="CLIENT_ABSENT">
              {t("acceptanceLabel.CLIENT_ABSENT")}
            </option>
          </select>
        </div>
        <div className="mt-4">
          <TextAreaField
            label={t("fields.clientReservations")}
            name="clientReservations"
            value={values.clientReservations}
            onChange={(v) =>
              setValues((s) => ({ ...s, clientReservations: v }))
            }
          />
        </div>
        <div className="mt-4">
          <TextAreaField
            label={t("fields.contractorNote")}
            name="contractorNote"
            value={values.contractorNote}
            onChange={(v) => setValues((s) => ({ ...s, contractorNote: v }))}
          />
        </div>
      </section>

      {/* ─── Status + actions ─── */}
      <section className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-background/90 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">
              {t("fields.status")}
            </Label>
            <select
              name="status"
              value={values.status}
              onChange={(e) =>
                setValues((s) => ({
                  ...s,
                  status: e.target.value as ProtocolFormValues["status"],
                }))
              }
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="DRAFT">{t("status.DRAFT")}</option>
              <option value="COMPLETED">{t("status.COMPLETED")}</option>
            </select>
            {state.error && (
              <span className="text-sm text-red-600">
                {state.error}
              </span>
            )}
            {savedMessage && (
              <span className="text-sm text-emerald-700">{savedMessage}</span>
            )}
          </div>
          <div className="flex gap-2">
            <a href={blankPrintHref} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline" size="sm">
                {t("printBlank")}
              </Button>
            </a>
            <a href={printHref} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline" size="sm">
                {t("print")}
              </Button>
            </a>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function DateField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="date"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function CheckRow({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
