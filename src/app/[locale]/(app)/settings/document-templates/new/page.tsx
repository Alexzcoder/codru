import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { seedDefaults } from "@/lib/seed-defaults";
import { setRequestLocale } from "next-intl/server";
import { DocumentTemplateForm } from "../document-template-form";
import { createDocumentTemplate } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewDocumentTemplatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  await seedDefaults();

  const companyProfiles = await prisma.companyProfile.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <BackLink href="/settings/document-templates" label="Document templates" />
      <h2 className="text-lg font-semibold tracking-tight">New document template</h2>
      <div className="mt-6">
        <DocumentTemplateForm
          companyProfiles={companyProfiles.map((c) => ({ id: c.id, name: c.name }))}
          action={createDocumentTemplate}
        />
      </div>
    </div>
  );
}
