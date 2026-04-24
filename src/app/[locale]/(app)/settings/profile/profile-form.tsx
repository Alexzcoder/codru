"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveProfile, type ProfileState } from "./actions";

type Initial = {
  name: string;
  calendarColor: string;
  locale: "cs" | "en";
  signatureImagePath: string | null;
  notificationPrefs: Record<string, boolean>;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    saveProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="calendarColor">{t("fields.calendarColor")}</Label>
          <Input
            id="calendarColor"
            name="calendarColor"
            type="color"
            defaultValue={initial.calendarColor}
            className="h-10 p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">{t("fields.uiLanguage")}</Label>
          <select
            id="locale"
            name="locale"
            defaultValue={initial.locale}
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="cs">Čeština</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signature">{t("fields.signature")}</Label>
        <Input id="signature" name="signature" type="file" accept="image/*" />
        {initial.signatureImagePath && (
          <p className="text-xs text-neutral-500">Current: {initial.signatureImagePath}</p>
        )}
      </div>

      <fieldset className="space-y-2 rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium">Notifications</legend>
        <Toggle
          name="notifyOverdue"
          label="Invoice overdue"
          defaultChecked={initial.notificationPrefs.overdue ?? true}
        />
        <Toggle
          name="notifyPayment"
          label="Payment received"
          defaultChecked={initial.notificationPrefs.payment ?? true}
        />
        <Toggle
          name="notifyInquiry"
          label="New client inquiry"
          defaultChecked={initial.notificationPrefs.inquiry ?? true}
        />
      </fieldset>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-green-700">{t("saved")}</p>}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
