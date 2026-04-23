import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Auth.login")}</h1>
      <LoginForm next={next} />
    </div>
  );
}
