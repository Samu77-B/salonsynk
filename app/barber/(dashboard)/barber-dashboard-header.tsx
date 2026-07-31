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
    { href: "/barber/appointments", label: "Bookings" },
    ...(isOwner
      ? [
          { href: "/barber/services", label: "Services" },
          { href: "/barber/team", label: "Team" },
        ]
      : []),
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function desktopLinkClass(href: string) {
    const base = "text-sm whitespace-nowrap transition-colors";
    return isActive(href)
      ? `${base} text-accent font-semibold`
      : `${base} text-muted hover:text-foreground`;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-lg font-bold tracking-tight">Barber Synk</span>
          <span className="hidden truncate text-xs text-muted sm:inline max-w-[140px] md:max-w-[200px]">
            {shopName}
          </span>
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

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="barber-mobile-menu fixed top-0 right-0 bottom-0 z-50 flex w-[min(100%,16rem)] flex-col border-l border-border p-3 md:hidden"
            aria-label="Mobile menu"
          >
            <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Menu</p>
                <p className="truncate text-xs text-muted">{shopName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="shrink-0 rounded p-1.5 text-muted hover:text-foreground hover:bg-foreground/5"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-0.5 py-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  data-active={isActive(href) ? "true" : "false"}
                  className={`px-3 py-2 text-sm font-medium ${
                    isActive(href) ? "text-accent" : "text-foreground/90"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="mt-auto border-t border-border pt-3 space-y-0.5">
              {isManager && <p className="px-3 text-xs text-muted">Manager access</p>}
              {userEmail && (
                <p className="px-3 text-xs text-muted truncate" title={userEmail}>
                  {userEmail}
                </p>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
