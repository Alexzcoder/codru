import { requireOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CompanyProfileForm } from "../company-profile-form";
import { createCompanyProfile } from "../actions";
import { BackLink } from "@/components/back-link";

export default async function NewCompanyProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  const t = await getTranslations();

  return (
    <div>
      <BackLink href="/settings/company-profiles" label={t("Settings.companyProfiles")} />
      <h2 className="text-lg font-semibold tracking-tight">{t("Settings.newCompanyProfile")}</h2>
      <div className="mt-6">
        <CompanyProfileForm action={createCompanyProfile} />
      </div>
    </div>
  );
}
