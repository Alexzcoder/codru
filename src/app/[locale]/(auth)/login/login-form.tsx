"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login, type LoginState } from "./actions";
import { Link } from "@/i18n/navigation";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
          autoComplete="current-password"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error === "rateLimited"
            ? "Too many attempts — wait 15 minutes."
            : t("loginError")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {t("submitLogin")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-neutral-600 hover:text-neutral-900">
          {t("forgotPassword")}
        </Link>
      </p>
    </form>
  );
}
