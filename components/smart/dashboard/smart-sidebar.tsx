"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SmartSynkLogo } from "@/components/smart/smart-synk-logo";
import { PlatformIcon } from "@/components/smart/marketing/platform-icons";
import type { SmartPlatformId } from "@core/config/smart-site";
import type { PlatformMembership } from "@core/auth/resolve-user-platform";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

const MAIN_NAV: NavItem[] = [{ label: "Overview", href: "/smart/overview" }];

const PLATFORM_NAV: (NavItem & { platform: SmartPlatformId })[] = [
  { label: "SalonSynk", href: "/admin/salons", platform: "salon" },
  { label: "BarberSynk", href: "/admin/barber-shops", platform: "barber" },
  { label: "NailSynk", href: "/admin/nail-salons", platform: "nail" },
];

const TOOLS_NAV: NavItem[] = [
  { label: "Signups", href: "/admin/signups" },
  { label: "Analytics", href: "/smart/overview" },
  { label: "Settings", href: "/admin" },
];

const PLATFORM_LABELS: Record<string, string> = {
  salon: "SalonSynk",
  barber: "BarberSynk",
  nail: "NailSynk",
};

type SmartSidebarProps = {
  userName: string;
  userEmail: string | null;
  isSuperAdmin?: boolean;
  locations?: PlatformMembership[];
};

export function SmartSidebar({
  userName,
  userEmail,
  isSuperAdmin = true,
  locations = [],
}: SmartSidebarProps) {
  const pathname = usePathname();
  const [openingId, setOpeningId] = useState<string | null>(null);

  function isActive(href: string) {
    if (href === "/smart/overview") {
      return pathname === "/smart/overview";
    }
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(href);
  }

  async function openLocation(m: PlatformMembership) {
    const key = `${m.platform}-${m.tenantId}`;
    setOpeningId(key);
    try {
      const res = await fetch(
        `/api/auth/owner-location-handoff?platform=${encodeURIComponent(m.platform)}&tenantId=${encodeURIComponent(m.tenantId)}`
      );
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-5">
        <SmartSynkLogo variant="sidebar" href="/smart/overview" />
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

        {isSuperAdmin ? (
          <>
            <p className="mt-6 mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted">
              Platforms
            </p>
            <ul className="space-y-1">
              {PLATFORM_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item.href)
                        ? "bg-accent/10 text-foreground"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <PlatformIcon platform={item.platform} className="h-4 w-4 shrink-0 text-accent" />
                    <span className="flex-1">{item.label}</span>
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
          </>
        ) : (
          <>
            <p className="mt-6 mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted">
              Your locations
            </p>
            <ul className="space-y-1">
              {locations.map((m) => {
                const key = `${m.platform}-${m.tenantId}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={Boolean(openingId)}
                      onClick={() => openLocation(m)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
                    >
                      <PlatformIcon
                        platform={m.platform as SmartPlatformId}
                        className="h-4 w-4 shrink-0 text-accent"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="block truncate font-medium text-foreground">{m.tenantName}</span>
                        <span className="block truncate text-[10px] uppercase tracking-wide">
                          {openingId === key ? "Opening…" : PLATFORM_LABELS[m.platform]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted">
              {isSuperAdmin ? "Super Admin" : "Group owner"}
            </p>
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
