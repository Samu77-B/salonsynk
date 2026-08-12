"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export function BarberDashboardHeader({
  shopName,
  userEmail,
  isOwner,
  isManager,
}: {
  shopName: string;
  userEmail: string | null;
  isOwner: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/barber/dashboard", label: "Queue" },
    ...(isOwner || isManager
      ? [{ href: "/barber/appointments", label: "Bookings" }]
      : []),
    ...(isOwner || isManager
      ? [
          { href: "/barber/services", label: "Services" },
          { href: "/barber/team", label: "Team" },
          { href: "/barber/chairs", label: "Chairs" },
        ]
      : []),
    ...(isOwner ? [{ href: "/barber/billing", label: "Billing" }] : []),
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function desktopLinkClass(href: string) {
    const base = "text-sm whitespace-nowrap transition-colors";
    return isActive(href)
      ? `${base} text-foreground font-semibold`
      : `${base} text-muted hover:text-foreground`;
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden
          onClick={closeMenu}
        />
      )}

      <div className="relative z-40 flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold tracking-tight leading-tight">{shopName}</p>
          <p className="truncate text-[11px] text-muted leading-tight">Barber Synk</p>
        </div>

        <nav className="hidden md:flex items-center gap-4 ml-2" aria-label="Main navigation">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={desktopLinkClass(href)}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex ml-auto items-center gap-3 text-sm text-muted shrink-0">
          {isManager && <span className="text-xs opacity-60">Manager</span>}
          {userEmail && (
            <span className="text-xs max-w-[180px] truncate" title={userEmail}>
              {userEmail}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden shrink-0 rounded p-2 text-muted hover:text-foreground hover:bg-foreground/5"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <div
        className={`barber-roll-down relative z-40 md:hidden ${menuOpen ? "is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="barber-roll-down-inner">
          <nav className="barber-mobile-menu border-t border-border px-3 pb-3" aria-label="Mobile menu">
            <div className="flex flex-col gap-1 py-2">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  data-active={isActive(href) ? "true" : "false"}
                  className={`font-medium ${
                    isActive(href) ? "text-foreground" : "text-foreground/90"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border pt-2 space-y-0.5">
              {isManager && <p className="px-3 text-xs text-muted">Manager access</p>}
              {userEmail && (
                <p className="px-3 text-xs text-muted truncate" title={userEmail}>
                  {userEmail}
                </p>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
