import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CustomFieldForm } from "./custom-field-form";
import { archiveCustomField } from "./actions";
import { Button } from "@/components/ui/button";

export default async function CustomFieldsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();
  const t = await getTranslations();

  const defs = await prisma.customFieldDef.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">{t("Settings.navCustomFields")}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Extra fields that appear on every client profile.
      </p>

      {defs.length > 0 ? (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {defs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-2">
              <span>
                {d.label}{" "}
                <span className="text-xs text-neutral-500">({d.fieldType})</span>
              </span>
              <form
                action={async () => {
                  "use server";
                  await archiveCustomField(d.id);
                }}
              >
                <Button type="submit" variant="ghost" size="sm">
                  {t("Settings.archive")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">No custom fields yet.</p>
      )}

      <div className="mt-6">
        <CustomFieldForm />
      </div>
    </div>
  );
}
