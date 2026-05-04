"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Plain native <input> here — base-ui's <Input> wrapper was eating the `name`
// attribute on submit, so FormData arrived empty and zod kicked back loginError
// before any DB call ran. Login is the one form that has to work even when
// JS hydration is mid-flight, so a native input is the right call.
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
import { login, type LoginState } from "./actions";
import { Link } from "@/i18n/navigation";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className={`${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
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
