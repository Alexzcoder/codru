"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function SettingsNav({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("Settings");
  const path = usePathname();

  type Item = { href: string; label: string; ownerOnly?: boolean };
  type Group = { label: string; items: Item[] };

  const groups: Group[] = [
    {
      label: t("groupGeneral"),
      items: [{ href: "/settings/profile", label: t("navProfile") }],
    },
    {
      label: t("groupWorkspace"),
      items: [
        { href: "/settings/company-profiles", label: t("navCompanyProfiles"), ownerOnly: true },
        { href: "/settings/document-templates", label: t("navDocumentTemplates"), ownerOnly: true },
        { href: "/settings/item-templates", label: t("navItemTemplates"), ownerOnly: true },
        { href: "/settings/categories", label: t("navCategories"), ownerOnly: true },
        { href: "/settings/expense-categories", label: t("navExpenseCategories"), ownerOnly: true },
        { href: "/settings/tax-rates", label: t("navTaxRates"), ownerOnly: true },
        { href: "/settings/units", label: t("navUnits"), ownerOnly: true },
        { href: "/settings/custom-fields", label: t("navCustomFields"), ownerOnly: true },
      ],
    },
    {
      label: t("groupPeople"),
      items: [
        { href: "/settings/users", label: t("navUsers"), ownerOnly: true },
        { href: "/settings/email-senders", label: t("navEmailSenders"), ownerOnly: true },
      ],
    },
  ];

  return (
    <nav className="flex flex-col gap-4 text-sm">
      {groups.map((g) => {
        const visible = g.items.filter((i) => !i.ownerOnly || isOwner);
        if (visible.length === 0) return null;
        return (
          <div key={g.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              {g.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {visible.map((i) => {
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
            </div>
          </div>
        );
      })}
    </nav>
  );
}
