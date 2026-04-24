"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function RecurrenceFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    frequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM";
    customDays?: number;
    startDate?: Date;
    endDate?: Date | null;
    daysInAdvance?: number;
    autoGenerate?: boolean;
  };
}) {
  const t = useTranslations("Recurring");
  const [freq, setFreq] = useState(defaults?.frequency ?? "MONTHLY");

  return (
    <fieldset className="rounded-md border border-neutral-200 p-4 space-y-4">
      <legend className="px-1 text-sm font-medium">{t("title")}</legend>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="name">{t("fields.name")}</Label>
          <Input
            id="name"
            name="name"
            defaultValue={defaults?.name ?? ""}
            placeholder="e.g. Monthly insurance"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequency">{t("fields.frequency")}</Label>
          <select
            id="frequency"
            name="frequency"
            value={freq}
            onChange={(e) =>
              setFreq(e.target.value as typeof freq)
            }
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="WEEKLY">{t("frequency.WEEKLY")}</option>
            <option value="MONTHLY">{t("frequency.MONTHLY")}</option>
            <option value="QUARTERLY">{t("frequency.QUARTERLY")}</option>
            <option value="YEARLY">{t("frequency.YEARLY")}</option>
            <option value="CUSTOM">{t("frequency.CUSTOM")}</option>
          </select>
        </div>
        {freq === "CUSTOM" && (
          <div className="space-y-2">
            <Label htmlFor="customDays">{t("fields.customDays")}</Label>
            <Input
              id="customDays"
              name="customDays"
              type="number"
              min={1}
              max={365}
              defaultValue={defaults?.customDays ?? 30}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("fields.startDate")}</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInput(defaults?.startDate ?? new Date())}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">{t("fields.endDate")}</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={defaults?.endDate ? toDateInput(defaults.endDate) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daysInAdvance">{t("fields.daysInAdvance")}</Label>
          <Input
            id="daysInAdvance"
            name="daysInAdvance"
            type="number"
            min={0}
            max={60}
            defaultValue={defaults?.daysInAdvance ?? 0}
          />
        </div>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input
            type="checkbox"
            name="autoGenerate"
            defaultChecked={defaults?.autoGenerate ?? true}
          />
          {t("fields.autoGenerate")}
        </label>
      </div>
    </fieldset>
  );
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
