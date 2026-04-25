"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function SettingsNav({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("Settings");
  const path = usePathname();

  const items = [
    { href: "/settings/profile", label: t("navProfile") },
    { href: "/settings/company-profiles", label: t("navCompanyProfiles"), ownerOnly: true },
    { href: "/settings/tax-rates", label: t("navTaxRates"), ownerOnly: true },
    { href: "/settings/categories", label: t("navCategories"), ownerOnly: true },
    { href: "/settings/expense-categories", label: t("navExpenseCategories"), ownerOnly: true },
    { href: "/settings/units", label: t("navUnits"), ownerOnly: true },
    { href: "/settings/item-templates", label: t("navItemTemplates"), ownerOnly: true },
    { href: "/settings/document-templates", label: t("navDocumentTemplates"), ownerOnly: true },
    { href: "/settings/email-senders", label: "Email senders", ownerOnly: true },
    { href: "/settings/custom-fields", label: t("navCustomFields"), ownerOnly: true },
    { href: "/settings/users", label: t("navUsers"), ownerOnly: true },
  ].filter((i) => !i.ownerOnly || isOwner);

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={
              active
                ? "rounded-md bg-primary/10 px-3 py-2 font-medium text-primary"
                : "rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
