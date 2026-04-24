import { requireUser } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations();

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("Settings.profile.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
        <div className="mt-6">
          <ProfileForm
            initial={{
              name: user.name,
              calendarColor: user.calendarColor,
              locale: user.locale,
              signatureImagePath: user.signatureImagePath,
              notificationPrefs: user.notificationPrefs as Record<string, boolean>,
            }}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("Settings.profile.changePassword")}</h2>
        <div className="mt-6 max-w-sm">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
