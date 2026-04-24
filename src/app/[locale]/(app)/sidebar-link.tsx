"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Matches: exact path, or nested (e.g. /clients/new is active when nav item is /clients).
// But don't treat "/" as a prefix for every path.
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/settings/profile") return pathname.startsWith("/settings");
  return pathname.startsWith(href + "/");
}

export function SidebarLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium shadow-sm"
          : "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-white/5"
      }
      style={
        active
          ? {
              background: "var(--sidebar-primary)",
              color: "var(--sidebar-primary-foreground)",
            }
          : undefined
      }
    >
      <span className="opacity-80">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
