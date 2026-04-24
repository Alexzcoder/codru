"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.done) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-900">
        <p>{t("Reset.forgotDone")}</p>
        {state.devInviteLink && (
          <>
            <p className="mt-3 text-xs text-neutral-700">
              {t("Settings.users.devInviteLink")}
            </p>
            <code className="mt-1 block break-all rounded bg-white px-2 py-1">
              {state.devInviteLink}
            </code>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("Auth.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t("Reset.forgotSubmit")}
      </Button>
    </form>
  );
}
