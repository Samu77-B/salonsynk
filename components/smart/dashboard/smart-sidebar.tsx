"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SMART_SITE } from "@core/config/smart-site";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

const MAIN_NAV: NavItem[] = [{ label: "Overview", href: "/smart/overview" }];

const PLATFORM_NAV: NavItem[] = [
  { label: "SalonSynk", href: "/admin/salons" },
  { label: "BarberSynk", href: "/admin/barber-shops" },
  { label: "NailSynk", href: "/admin/nail-salons" },
];

const TOOLS_NAV: NavItem[] = [
  { label: "Signups", href: "/admin/signups" },
  { label: "Analytics", href: "/smart/overview" },
  { label: "Settings", href: "/admin" },
];

type SmartSidebarProps = {
  userName: string;
  userEmail: string | null;
};

export function SmartSidebar({ userName, userEmail }: SmartSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/smart/overview") {
      return pathname === "/smart/overview";
    }
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-5">
        <Image
          src={SMART_SITE.logoWht}
          alt={SMART_SITE.name}
          width={120}
          height={36}
          className="h-8 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-accent/20 text-accent font-medium"
                    : "text-muted hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted">
          Platforms
        </p>
        <ul className="space-y-1">
          {PLATFORM_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-accent/10 text-foreground"
                    : "text-muted hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {item.label}
                <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-4 space-y-1">
          {TOOLS_NAV.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-accent/10 text-foreground"
                    : "text-muted hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted">Super Admin</p>
          </div>
        </div>
        {userEmail && (
          <p className="mt-2 truncate text-xs text-muted">{userEmail}</p>
        )}
        <form action="/api/auth/signout" method="post" className="mt-3">
          <button type="submit" className="text-xs text-muted hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
