import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  const invalid =
    !invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now();

  if (invalid) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Invite.title")}
        </h1>
        <p className="mt-4 text-sm text-red-600">{t("Invite.invalidOrExpired")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Invite.title")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("Invite.intro")}</p>
      <p className="mt-4 text-sm text-neutral-500">
        Email: <span className="font-medium text-neutral-900">{invite.email}</span>
      </p>
      <div className="mt-8">
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
