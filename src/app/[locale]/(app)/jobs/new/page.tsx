import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientDisplayName } from "@/lib/client-display";
import { JobForm } from "../job-form";
import { createJob } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();
  const { clientId } = await searchParams;

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
      select: { id: true, type: true, companyName: true, fullName: true, anonymizedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { deactivatedAt: null, memberships: { some: { workspaceId: workspace.id } } },
      select: { id: true, name: true, calendarColor: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/jobs" label={t("Jobs.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Jobs.newJob")}</h1>
      <div className="mt-8">
        <JobForm
          initial={clientId ? { clientId } : undefined}
          clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c) }))}
          users={users}
          action={createJob}
        />
      </div>
    </div>
  );
}
