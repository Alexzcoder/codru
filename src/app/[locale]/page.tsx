import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ownerCount = await prisma.user
    .count({ where: { role: "OWNER" } })
    .catch(() => 0);

  const nextHref = ownerCount === 0 ? "/register" : "/login";
  const nextLabel =
    ownerCount === 0 ? t("Auth.submitRegister") : t("Auth.submitLogin");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 flex flex-col justify-center px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">
        {t("App.title")}
      </h1>
      <p className="mt-3 text-neutral-600">{t("App.tagline")}</p>
      <Link
        href={nextHref}
        className="mt-10 inline-flex w-fit items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        {nextLabel} →
      </Link>
    </main>
  );
}
