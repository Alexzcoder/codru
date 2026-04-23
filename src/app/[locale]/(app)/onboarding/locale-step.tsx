"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveLocale, type OnboardingState } from "./actions";

export function LocaleStep({ currentLocale }: { currentLocale: "cs" | "en" }) {
  const t = useTranslations("Onboarding");
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    saveLocale,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-lg font-medium">{t("language")}</h2>
      <fieldset className="space-y-2">
        <Label>
          <input
            type="radio"
            name="locale"
            value="cs"
            defaultChecked={currentLocale === "cs"}
            className="mr-2"
          />
          Čeština
        </Label>
        <Label className="block">
          <input
            type="radio"
            name="locale"
            value="en"
            defaultChecked={currentLocale === "en"}
            className="mr-2"
          />
          English
        </Label>
      </fieldset>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("finish")}
      </Button>
    </form>
  );
}
