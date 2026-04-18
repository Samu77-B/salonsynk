"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { switchAdminSalon } from "./admin/actions";
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
      className={`rounded-lg p-2 text-muted hover:text-foreground ${isDark ? "hover:bg-white/5" : "hover:bg-black/[0.06]"} ${className}`}
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

const STAFF_ALLOWED_LINKS = new Set(["/dashboard", "/clients", "/checkout", "/help"]);

export function AppHeader({
  userEmail,
  isSuperAdmin = false,
  isManager = false,
  memberRole = null,
  currentSalon,
  adminSalons = [],
  theme = "dark",
  onToggleTheme,
}: {
  userEmail: string | undefined;
  isSuperAdmin?: boolean;
  isManager?: boolean;
  memberRole?: string | null;
  currentSalon?: { id: string; name: string; slug: string };
  adminSalons?: { id: string; name: string }[];
  theme?: DashboardTheme;
  onToggleTheme?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navHover =
    theme === "dark" ? "hover:bg-white/5" : "hover:bg-white/10";

  const navLinkClass =
    theme === "light"
      ? "text-zinc-300 hover:text-white whitespace-nowrap"
      : "text-muted hover:text-foreground whitespace-nowrap";

  const metaTextClass = theme === "light" ? "text-zinc-400" : "text-muted";

  const visibleLinks = isManager || isSuperAdmin
    ? NAV_LINKS
    : NAV_LINKS.filter((l) => STAFF_ALLOWED_LINKS.has(l.href));

  return (
    <header
      className={`flex min-h-[4.5rem] min-w-0 items-center justify-between gap-2 border-b px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 ${
        theme === "light"
          ? "border-zinc-600 bg-zinc-700"
          : "border-border bg-transparent"
      }`}
    >
      <Link
        href="/dashboard"
        className="flex min-w-0 max-w-[min(100%,10.5rem)] shrink items-center gap-2 overflow-hidden sm:max-w-none"
      >
        <Image
          src={theme === "light" ? dashboardLogoWhite : dashboardLogo}
          alt="SalonSynk logo"
          width={280}
          height={80}
          className="h-9 w-auto sm:h-11"
          sizes="(max-width: 640px) 120px, 160px"
          quality={95}
        />
        <span className="sr-only">SalonSynk</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4 text-sm shrink-0">
        {isSuperAdmin && adminSalons.length > 0 && (
          <ul className="flex items-center gap-2">
            <li className={`${metaTextClass} text-xs`}>Salon:</li>
            <li>
              <select
                value={currentSalon?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) switchAdminSalon(id);
                }}
                className={`rounded border px-2 py-1 text-sm max-w-[160px] truncate ${
                  theme === "light"
                    ? "border-zinc-500 bg-white text-zinc-900"
                    : "border-border bg-background"
                }`}
                aria-label="Switch salon"
              >
                {adminSalons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </li>
          </ul>
        )}
        {visibleLinks.map(({ href, label }) => (
          <Link key={href} href={href} className={navLinkClass}>
            {label}
          </Link>
        ))}
        {isSuperAdmin && (
          <Link href="/admin" className="text-accent hover:text-accent/90 whitespace-nowrap font-medium">
            Admin
          </Link>
        )}
        {userEmail && (
          <span className={`${metaTextClass} text-xs max-w-[120px] truncate lg:max-w-[180px]`} title={userEmail}>
            {userEmail}
          </span>
        )}
        {onToggleTheme && (
          <ThemeToggleButton
            theme={theme}
            onToggle={onToggleTheme}
            className={theme === "light" ? "text-zinc-300 hover:text-white" : ""}
          />
        )}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className={`text-sm whitespace-nowrap ${
              theme === "light" ? "text-zinc-300 hover:text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Sign out
          </button>
        </form>
      </nav>

      {/* Mobile: hamburger + overlay */}
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        {onToggleTheme && (
          <ThemeToggleButton
            theme={theme}
            onToggle={onToggleTheme}
            className={theme === "light" ? "text-zinc-300 hover:text-white" : ""}
          />
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`rounded-lg p-2 ${theme === "light" ? "text-zinc-300 hover:text-white" : "text-muted hover:text-foreground"} ${navHover}`}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-background border-l border-border p-4 flex flex-col gap-2 md:hidden"
            aria-label="Mobile menu"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Menu</span>
              {isSuperAdmin && adminSalons.length > 0 && (
                <div className="flex gap-2 items-center">
                  <select
                    value={currentSalon?.id ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) switchAdminSalon(id);
                    }}
                    className="rounded border border-border bg-background px-2 py-1 text-sm max-w-[140px]"
                    aria-label="Switch salon"
                  >
                    {adminSalons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {visibleLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-4 py-3 text-muted hover:text-foreground ${navHover}`}
              >
                {label}
              </Link>
            ))}
            {isSuperAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-4 py-3 text-accent ${navHover} font-medium`}
              >
                Admin
              </Link>
            )}
            {userEmail && (
              <p className="px-4 py-2 text-xs text-muted truncate border-t border-border mt-2 pt-4" title={userEmail}>
                {userEmail}
              </p>
            )}
            <form action="/api/auth/signout" method="post" className="mt-auto pt-4">
              <button
                type="submit"
                className={`w-full rounded-lg px-4 py-3 text-left text-sm text-muted hover:text-foreground ${navHover}`}
              >
                Sign out
              </button>
            </form>
          </nav>
        </>
      )}
    </header>
  );
}
