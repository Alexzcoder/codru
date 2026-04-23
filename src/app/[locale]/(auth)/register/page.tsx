import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
  if (ownerCount > 0) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Auth.register")}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">{t("App.tagline")}</p>
      <RegisterForm />
    </div>
  );
}
