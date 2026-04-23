"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerOwner, type RegisterState } from "./actions";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerOwner,
    {},
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
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
            ? t("passwordTooShort")
            : state.error === "registerClosed"
              ? t("registerClosed")
              : t("loginError")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {t("submitRegister")}
      </Button>
    </form>
  );
}
