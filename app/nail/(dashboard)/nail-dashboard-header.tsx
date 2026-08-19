"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAIL_SITE } from "@core/config/nail-site";
import { SupportEmailChip } from "@/components/support-email-chip";

type NavLink = { href: string; label: string };

export function NailDashboardHeader({
  salonName,
  userEmail,
  isOwner,
  isManager,
}: {
  salonName: string;
  userEmail: string | null;
  isOwner: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/nail/queue", label: "Queue" },
    ...(isOwner || isManager
      ? [{ href: "/nail/appointments", label: "Bookings" }]
      : []),
    ...(isOwner || isManager
      ? [
          { href: "/nail/services", label: "Services" },
          { href: "/nail/team", label: "Team" },
          { href: "/nail/stations", label: "Stations" },
        ]
      : []),
    ...(isOwner ? [{ href: "/nail/billing", label: "Billing" }] : []),
  ];

  function linkClass(href: string, mobile = false) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const base = mobile
      ? "rounded-lg px-4 py-3 text-sm"
      : "text-sm whitespace-nowrap";
    return active
      ? `${base} text-foreground font-medium`
      : `${base} text-muted hover:text-foreground`;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-lg font-bold tracking-tight">{NAIL_SITE.name}</span>
          <span className="hidden truncate text-xs text-muted sm:inline max-w-[140px] md:max-w-[200px]">
            {salonName}
          </span>
        </div>

        <nav
          className="hidden md:flex items-center gap-4 ml-2"
          aria-label="Main navigation"
        >
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)}>
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
          <SupportEmailChip email={NAIL_SITE.email} />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden shrink-0 rounded-lg p-2 text-muted hover:text-foreground hover:bg-white/5"
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
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-xs flex-col gap-1 border-l border-border bg-surface p-4 md:hidden"
            aria-label="Mobile menu"
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
              <div className="min-w-0">
                <p className="font-semibold">Menu</p>
                <p className="truncate text-xs text-muted">{salonName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="shrink-0 rounded-lg p-2 text-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={linkClass(href, true)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-auto border-t border-border pt-4 space-y-2">
              {isManager && (
                <p className="px-4 text-xs text-muted">Manager access</p>
              )}
              {userEmail && (
                <p className="px-4 text-xs text-muted truncate" title={userEmail}>
                  {userEmail}
                </p>
              )}
              <div className="px-4">
                <SupportEmailChip email={NAIL_SITE.email} />
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
