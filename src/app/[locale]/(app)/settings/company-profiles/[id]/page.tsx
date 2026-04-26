import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CompanyProfileForm } from "../company-profile-form";
import { updateCompanyProfile, archiveCompanyProfile } from "../actions";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";

export default async function EditCompanyProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireOwner();
  const t = await getTranslations();

  const profile = await prisma.companyProfile.findUnique({ where: { id } });
  if (!profile || profile.archivedAt) notFound();

  const updateBound = updateCompanyProfile.bind(null, id);
  const archiveBound = async () => {
    "use server";
    await archiveCompanyProfile(id);
  };

  return (
    <div>
      <BackLink href="/settings/company-profiles" label={t("Settings.companyProfiles")} />
      <h2 className="text-lg font-semibold tracking-tight">{t("Settings.editCompanyProfile")}</h2>
      <div className="mt-6">
        <CompanyProfileForm initial={profile} action={updateBound} />
      </div>
      <form action={archiveBound} className="mt-10">
        <Button type="submit" variant="outline" size="sm">
          {t("Settings.archive")}
        </Button>
      </form>
    </div>
  );
}
