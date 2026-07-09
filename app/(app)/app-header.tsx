"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { switchAdminSalon } from "./admin/actions";
import { DASHBOARD_NAV_FEATURES } from "@/lib/salon-features";
import type { PlatformFeatureId } from "@/config/plans";
import dashboardLogo from "../../salonsynk-light.png";
import dashboardLogoWhite from "../../salonsynk_logo-wht.png";
import type { DashboardTheme } from "./dashboard-theme";

function ThemeToggleButton({
  theme,
  onToggle,
  className = "",
}: {
  theme: DashboardTheme;
  onToggle: () => void;
  className?: string;
}) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-lg p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Diary" },
  { href: "/team", label: "Team" },
  { href: "/clients", label: "Clients" },
  { href: "/checkout", label: "Checkout" },
  { href: "/reports", label: "Reports" },
  { href: "/targets", label: "Targets" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/services", label: "Services" },
  { href: "/products", label: "Products" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
] as const;

const MOBILE_NAV_GROUPS = [
  {
    label: "Today",
    links: ["/dashboard", "/clients", "/checkout"],
  },
  {
    label: "Business",
    links: ["/reports", "/targets", "/campaigns"],
  },
  {
    label: "Setup",
    links: ["/team", "/services", "/products", "/settings", "/help"],
  },
] as const;

const STAFF_ALLOWED_LINKS = new Set(["/dashboard", "/clients", "/checkout", "/help"]);

function navLinksForPlan(
  enabledFeatures: PlatformFeatureId[],
  isManager: boolean,
  isSuperAdmin: boolean
) {
  const enabled = new Set(enabledFeatures);
  const roleFiltered =
    isManager || isSuperAdmin
      ? NAV_LINKS
      : NAV_LINKS.filter((l) => STAFF_ALLOWED_LINKS.has(l.href));
  return roleFiltered.filter(({ href }) => {
    const feature = DASHBOARD_NAV_FEATURES[href];
    if (!feature) return true;
    return enabled.has(feature);
  });
}

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClassName(active: boolean) {
  return active
    ? "rounded-lg bg-accent/15 px-2.5 py-1.5 text-sm font-medium text-accent whitespace-nowrap"
    : "rounded-lg px-2.5 py-1.5 text-sm text-muted whitespace-nowrap transition-colors hover:bg-foreground/5 hover:text-foreground";
}

export function AppHeader({
  userEmail,
  isSuperAdmin = false,
  isManager = false,
  memberRole = null,
  currentSalon,
  adminSalons = [],
  enabledFeatures = [],
  theme = "dark",
  onToggleTheme,
}: {
  userEmail: string | undefined;
  isSuperAdmin?: boolean;
  isManager?: boolean;
  memberRole?: string | null;
  currentSalon?: { id: string; name: string; slug: string };
  adminSalons?: { id: string; name: string }[];
  enabledFeatures?: PlatformFeatureId[];
  theme?: DashboardTheme;
  onToggleTheme?: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const visibleLinks = navLinksForPlan(
    enabledFeatures,
    Boolean(isManager),
    Boolean(isSuperAdmin)
  );

  return (
    <>
    <header className="app-header sticky top-0 z-30 border-b border-border backdrop-blur-md">
      <div className="flex min-h-[3.75rem] min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 max-w-[min(100%,10.5rem)] shrink items-center gap-2 overflow-hidden sm:max-w-none"
        >
          <Image
            src={theme === "light" ? dashboardLogo : dashboardLogoWhite}
            alt="SalonSynk logo"
            width={280}
            height={80}
            className="h-8 w-auto sm:h-9"
            sizes="(max-width: 640px) 120px, 160px"
            quality={95}
          />
          <span className="sr-only">SalonSynk</span>
        </Link>

        {/* Desktop nav + account */}
        <div className="hidden min-w-0 items-center justify-end gap-2 md:flex lg:gap-3">
          <nav
            className="flex min-w-0 items-center justify-end gap-0.5 overflow-x-auto scrollbar-none lg:gap-1"
            aria-label="Main"
          >
            {visibleLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={navLinkClassName(isNavActive(pathname, href))}
                aria-current={isNavActive(pathname, href) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 border-l border-border pl-2 lg:pl-3">
          {isSuperAdmin && adminSalons.length > 0 && (
            <select
              value={currentSalon?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) switchAdminSalon(id);
              }}
              className="dashboard-field max-w-[140px] truncate rounded-lg border border-border bg-background px-2 py-1.5 text-xs lg:max-w-[160px]"
              aria-label="Switch salon"
            >
              {adminSalons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
            >
              Admin
            </Link>
          )}
          {userEmail && (
            <span
              className="hidden max-w-[120px] truncate text-xs text-muted lg:inline xl:max-w-[160px]"
              title={userEmail}
            >
              {userEmail}
            </span>
          )}
          {onToggleTheme && <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />}
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Sign out
            </button>
          </form>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {onToggleTheme && <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/50 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed top-0 right-0 bottom-0 z-[110] flex w-full max-w-xs flex-col gap-1 overflow-y-auto border-l border-border bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl md:hidden"
            aria-label="Mobile menu"
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
              <span className="font-semibold text-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isSuperAdmin && adminSalons.length > 0 && (
              <select
                value={currentSalon?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) switchAdminSalon(id);
                }}
                className="dashboard-field mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                aria-label="Switch salon"
              >
                {adminSalons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {MOBILE_NAV_GROUPS.map((group) => {
              const groupLinks = group.links
                .map((href) => visibleLinks.find((l) => l.href === href))
                .filter(Boolean) as (typeof visibleLinks)[number][];
              if (groupLinks.length === 0) return null;
              return (
                <div key={group.label} className="mb-3">
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {group.label}
                  </p>
                  {groupLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-sm ${
                        isNavActive(pathname, href)
                          ? "bg-accent/15 font-medium text-accent"
                          : "text-foreground hover:bg-foreground/5"
                      }`}
                      aria-current={isNavActive(pathname, href) ? "page" : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              );
            })}


            {isSuperAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                Admin
              </Link>
            )}

            {userEmail && (
              <p className="mt-2 truncate border-t border-border px-3 pt-3 text-xs text-muted" title={userEmail}>
                {userEmail}
              </p>
            )}

            <form action="/api/auth/signout" method="post" className="mt-auto pt-4">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-foreground/5 hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </nav>
        </>
      )}
    </>
  );
}
