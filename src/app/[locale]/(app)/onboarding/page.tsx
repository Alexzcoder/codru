import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { CompanyProfileStep } from "./company-profile-step";
import { LocaleStep } from "./locale-step";
import { SkipButton } from "./skip-button";
import { auth } from "@/auth";

const TOTAL_STEPS = 2; // Shorter flow in M1; categories/tax-rates/signature steps land in M2/M6.

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { step } = await searchParams;
  const t = await getTranslations();

  const stepNum = Math.min(Math.max(Number(step) || 1, 1), TOTAL_STEPS);
  const session = await auth();
  const currentLocale = (session?.user as { locale?: "cs" | "en" } | undefined)
    ?.locale ?? "cs";
  const existing = await prisma.companyProfile.findFirst({
    where: { isDefault: true },
  });

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <p className="text-xs uppercase tracking-wider text-neutral-500">
        {t("Onboarding.step", { current: stepNum, total: TOTAL_STEPS })}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("Onboarding.welcome")}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">{t("Onboarding.intro")}</p>

      <div className="mt-8">
        {stepNum === 1 && <CompanyProfileStep initial={existing} />}
        {stepNum === 2 && <LocaleStep currentLocale={currentLocale} />}
      </div>

      <div className="mt-10">
        <SkipButton />
      </div>
    </div>
  );
}
