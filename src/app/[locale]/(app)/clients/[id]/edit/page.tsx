import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientForm } from "../../client-form";
import { updateClient } from "../../actions";
import { clientDisplayName } from "@/lib/client-display";
import { BackLink } from "@/components/back-link";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const [client, defs, values] = await Promise.all([
    prisma.client.findFirst({ where: { id, workspaceId: workspace.id } }),
    prisma.customFieldDef.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customFieldValue.findMany({ where: { clientId: id } }),
  ]);
  if (!client || client.deletedAt) notFound();

  const valuesMap = Object.fromEntries(values.map((v) => [v.fieldDefId, v.value]));
  const updateBound = updateClient.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href={`/clients/${id}`} label={clientDisplayName(client)} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {clientDisplayName(client)}
      </h1>
      <div className="mt-8">
        <ClientForm
          initial={client}
          customFieldDefs={defs}
          customFieldValues={valuesMap}
          action={updateBound}
        />
      </div>
    </div>
  );
}
