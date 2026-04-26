import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const customFieldDefs = await prisma.customFieldDef.findMany({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/clients" label={t("Clients.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Clients.newClient")}</h1>
      <div className="mt-8">
        <ClientForm
          customFieldDefs={customFieldDefs}
          customFieldValues={{}}
          action={createClient}
        />
      </div>
    </div>
  );
}
