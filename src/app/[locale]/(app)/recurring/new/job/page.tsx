import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
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
  await requireUser();
  const t = await getTranslations();

  const [clients, users, companyProfiles, documentTemplates, taxRates] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, anonymizedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { deactivatedAt: null },
      select: { id: true, name: true, calendarColor: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyProfile.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.documentTemplate.findMany({
      where: { archivedAt: null, type: "FINAL_INVOICE" },
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
