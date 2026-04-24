import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  const invalid =
    !record || record.usedAt || record.expiresAt.getTime() < Date.now();

  if (invalid) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Reset.resetTitle")}</h1>
        <p className="mt-4 text-sm text-red-600">{t("Reset.invalidOrExpired")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Reset.resetTitle")}</h1>
      <div className="mt-8">
        <ResetForm token={token} />
      </div>
    </div>
  );
}
