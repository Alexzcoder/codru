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
} from "lucide-react";
import { SidebarLink } from "./sidebar-link";

export async function Sidebar({
  workspaceEmail,
  userInitial,
}: {
  workspaceEmail: string;
  userInitial: string;
}) {
  const t = await getTranslations();

  const sections: {
    label?: string;
    items: { href: string; label: string; icon: React.ReactNode }[];
  }[] = [
    {
      items: [
        { href: "/dashboard", label: t("Dashboard.title"), icon: <LayoutDashboard size={16} /> },
      ],
    },
    {
      label: "CRM",
      items: [
        { href: "/clients", label: t("Clients.title"), icon: <Users size={16} /> },
        { href: "/jobs", label: t("Jobs.title"), icon: <Briefcase size={16} /> },
        { href: "/calendar", label: t("Calendar.title"), icon: <CalendarIcon size={16} /> },
      ],
    },
    {
      label: "Documents",
      items: [
        { href: "/quotes", label: t("Quotes.title"), icon: <FileText size={16} /> },
        { href: "/advance-invoices", label: t("AdvanceInvoices.title"), icon: <FileCheck size={16} /> },
        { href: "/final-invoices", label: t("FinalInvoices.title"), icon: <Receipt size={16} /> },
        { href: "/credit-notes", label: t("CreditNotes.title"), icon: <FileX size={16} /> },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/payments", label: t("Payments.title"), icon: <Wallet size={16} /> },
        { href: "/expenses", label: t("Expenses.title"), icon: <PiggyBank size={16} /> },
        { href: "/accounting", label: t("Accounting.title"), icon: <TrendingUp size={16} /> },
        { href: "/recurring", label: t("Recurring.title"), icon: <Repeat size={16} /> },
      ],
    },
  ];

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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md font-semibold"
            style={{
              background: "var(--sidebar-primary)",
              color: "var(--sidebar-primary-foreground)",
            }}
          >
            {userInitial.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("App.title")}</p>
            <p className="truncate text-[11px] opacity-70">{workspaceEmail}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {sections.map((section, idx) => (
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
