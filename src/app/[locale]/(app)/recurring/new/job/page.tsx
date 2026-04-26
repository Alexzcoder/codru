import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientDisplayName } from "@/lib/client-display";
import { JobRuleForm } from "./form";
import { createJobRule } from "../../actions";
import { BackLink } from "@/components/back-link";

export default async function NewJobRulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { workspace } = await requireWorkspace();
  const t = await getTranslations();

  const [clients, users, companyProfiles, documentTemplates, taxRates] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.id, deletedAt: null, anonymizedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { deactivatedAt: null, memberships: { some: { workspaceId: workspace.id } } },
      select: { id: true, name: true, calendarColor: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyProfile.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.documentTemplate.findMany({
      where: {
        archivedAt: null,
        type: "FINAL_INVOICE",
        companyProfile: { workspaceId: workspace.id },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.taxRate.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { percent: "desc" }],
      select: { id: true, label: true, percent: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackLink href="/recurring/new" label={t("Recurring.title")} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("Recurring.new")} · {t("Recurring.kinds.JOB")}
      </h1>
      <div className="mt-8">
        <JobRuleForm
          clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c) }))}
          users={users}
          companyProfiles={companyProfiles}
          documentTemplates={documentTemplates}
          defaultTaxRatePercent={taxRates[0]?.percent.toString() ?? "21"}
          action={createJobRule}
        />
      </div>
    </div>
  );
}
