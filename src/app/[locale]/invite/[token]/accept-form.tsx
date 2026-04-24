"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(
    acceptInvite,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="name">{t("Auth.name")}</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("Auth.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error === "passwordTooShort"
            ? t("Auth.passwordTooShort")
            : state.error === "invalidOrExpired"
              ? t("Invite.invalidOrExpired")
              : t("Auth.loginError")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {t("Invite.setPassword")}
      </Button>
    </form>
  );
}
