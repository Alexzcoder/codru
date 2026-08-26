import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { JoinForm } from "./join-form";
import { joinSignedIn } from "./actions";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const workspace = await prisma.workspace.findFirst({
    where: { joinToken: token, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!workspace) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Join.title")}
        </h1>
        <p className="mt-4 text-sm text-red-600">{t("Join.invalidLink")}</p>
      </div>
    );
  }

  const session = await auth();
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, deactivatedAt: true },
      })
    : null;

  const joinBound = joinSignedIn.bind(null, token);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Join.title")}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        {t("Join.intro", { workspace: workspace.name })}
      </p>
      <div className="mt-8">
        {signedInUser && !signedInUser.deactivatedAt ? (
          <form action={joinBound}>
            <Button type="submit" className="w-full">
              {t("Join.joinAs", { name: signedInUser.name })}
            </Button>
          </form>
        ) : (
          <JoinForm token={token} />
        )}
      </div>
    </div>
  );
}
