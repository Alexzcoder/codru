"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { skipOnboarding } from "./actions";

export function SkipButton() {
  const t = useTranslations("Onboarding");
  return (
    <form action={skipOnboarding}>
      <Button type="submit" variant="ghost" size="sm">
        {t("skip")}
      </Button>
    </form>
  );
}
