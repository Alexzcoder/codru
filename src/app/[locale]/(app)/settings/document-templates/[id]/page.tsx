import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DocumentTemplateForm } from "../document-template-form";
import { updateDocumentTemplate, archiveDocumentTemplate } from "../actions";
import { Button } from "@/components/ui/button";

export default async function EditDocumentTemplatePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireOwner();

  const [tmpl, companyProfiles] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { id } }),
    prisma.companyProfile.findMany({
      where: { archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
  ]);
  if (!tmpl || tmpl.archivedAt) notFound();

  const updateBound = updateDocumentTemplate.bind(null, id);
  const archiveBound = async () => {
    "use server";
    await archiveDocumentTemplate(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{tmpl.name}</h2>
        <a
          href={`/settings/document-templates/${id}/preview`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-neutral-700 hover:underline"
        >
          Preview PDF ↗
        </a>
      </div>
      <div className="mt-6">
        <DocumentTemplateForm
          initial={tmpl}
          companyProfiles={companyProfiles.map((c) => ({ id: c.id, name: c.name }))}
          action={updateBound}
        />
      </div>
      <form action={archiveBound} className="mt-10">
        <Button type="submit" variant="outline" size="sm">
          Archive
        </Button>
      </form>
    </div>
  );
}
