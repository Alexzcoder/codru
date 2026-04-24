import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotForm } from "./forgot-form";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Reset.forgotTitle")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("Reset.forgotIntro")}</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
    </div>
  );
}
