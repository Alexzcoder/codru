"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">{t("Settings.profile.currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">{t("Settings.profile.newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error === "wrongCurrent"
            ? t("Settings.profile.wrongCurrent")
            : t("Auth.passwordTooShort")}
        </p>
      )}
      {state.saved && (
        <p className="text-sm text-green-700">{t("Settings.profile.passwordChanged")}</p>
      )}
      <Button type="submit" disabled={pending}>
        {t("Settings.save")}
      </Button>
    </form>
  );
}
