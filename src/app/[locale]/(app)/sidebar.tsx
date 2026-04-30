import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar as CalendarIcon,
  FileText,
  FileCheck,
  FileX,
  Receipt,
  Wallet,
  PiggyBank,
  TrendingUp,
  Repeat,
  Settings as SettingsIcon,
  Megaphone,
  Sparkles,
  Mic,
} from "lucide-react";
import { SidebarLink } from "./sidebar-link";
import type { Workspace, Membership } from "@prisma/client";
import { hasFeature, type FeatureKey } from "@/lib/features";

type Item = { href: string; label: string; icon: React.ReactNode; key: FeatureKey };

export async function Sidebar({
  workspaceEmail,
  workspace,
  membership,
}: {
  workspaceEmail: string;
  workspace: Workspace | null;
  membership: Membership | null;
}) {
  const t = await getTranslations();

  // Each item declares its feature key. Sections are dropped when empty so a
  // workspace that disables a whole group (e.g. IE Public Speaking turning
  // off Documents + Money) doesn't leave behind dangling section labels.
  const sections: { label?: string; items: Item[] }[] = [
    {
      // Dashboard is always visible — no feature key.
      items: [],
      // Special: handled separately below so we don't have to give it a key.
    },
    {
      label: "CRM",
      items: [
        { href: "/clients",  label: t("Clients.title"),  icon: <Users size={16} />,        key: "clients" },
        { href: "/jobs",     label: t("Jobs.title"),     icon: <Briefcase size={16} />,    key: "jobs" },
        { href: "/calendar", label: t("Calendar.title"), icon: <CalendarIcon size={16} />, key: "calendar" },
      ],
    },
    {
      label: "Documents",
      items: [
        { href: "/quotes",            label: t("Quotes.title"),           icon: <FileText size={16} />,  key: "documents" },
        { href: "/advance-invoices",  label: t("AdvanceInvoices.title"),  icon: <FileCheck size={16} />, key: "documents" },
        { href: "/final-invoices",    label: t("FinalInvoices.title"),    icon: <Receipt size={16} />,   key: "documents" },
        { href: "/credit-notes",      label: t("CreditNotes.title"),      icon: <FileX size={16} />,     key: "documents" },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/payments",   label: t("Payments.title"),   icon: <Wallet size={16} />,     key: "money" },
        { href: "/expenses",   label: t("Expenses.title"),   icon: <PiggyBank size={16} />,  key: "money" },
        { href: "/accounting", label: t("Accounting.title"), icon: <TrendingUp size={16} />, key: "money" },
        { href: "/recurring",  label: t("Recurring.title"),  icon: <Repeat size={16} />,     key: "recurring" },
      ],
    },
    {
      label: "Club",
      items: [
        { href: "/events",    label: "Events",    icon: <Megaphone size={16} />, key: "events" },
        { href: "/scheduler", label: "Scheduler", icon: <Sparkles size={16} />,  key: "scheduler" },
        { href: "/podcast",   label: "Podcast",   icon: <Mic size={16} />,       key: "podcast" },
      ],
    },
  ];

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => hasFeature(workspace, item.key, membership)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <aside
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col"
      style={{
        background: "var(--sidebar)",
        color: "var(--sidebar-foreground)",
      }}
    >
      {/* Workspace header */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <img
            src="/logos/codru_v4_white_transparent.svg"
            alt="Codru"
            className="h-8 w-8"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {t("App.title")}
            </p>
            <p className="truncate text-[11px] opacity-70">{workspaceEmail}</p>
          </div>
        </div>
      </div>

      {/* Nav — scrollable via wheel, scrollbar itself hidden for a cleaner look */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Dashboard always visible */}
        <div className="mb-5">
          <ul className="space-y-0.5">
            <li>
              <SidebarLink
                href="/dashboard"
                icon={<LayoutDashboard size={16} />}
                label={t("Dashboard.title")}
              />
            </li>
          </ul>
        </div>

        {visibleSections.map((section, idx) => (
          <div key={idx} className="mb-5">
            {section.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest opacity-50">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink href={item.href} icon={item.icon} label={item.label} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings anchor */}
      <div className="border-t border-white/10 p-3">
        <SidebarLink
          href="/settings/profile"
          icon={<SettingsIcon size={16} />}
          label={t("Settings.title")}
        />
      </div>
    </aside>
  );
}
