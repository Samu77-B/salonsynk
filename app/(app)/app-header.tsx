"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/dashboard", label: "Diary" },
  { href: "/team", label: "Team" },
  { href: "/clients", label: "Clients" },
  { href: "/checkout", label: "Checkout" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppHeader({
  userEmail,
  isSuperAdmin = false,
}: {
  userEmail: string | undefined;
  isSuperAdmin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <Image src="/salonsynk_logo-grey.png" alt="SalonSynk logo" width={32} height={32} className="h-8 w-auto" />
        <span className="sr-only">SalonSynk</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4 text-sm shrink-0">
        {NAV_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="text-muted hover:text-foreground whitespace-nowrap">
            {label}
          </Link>
        ))}
        {isSuperAdmin && (
          <Link href="/admin" className="text-accent hover:text-accent/90 whitespace-nowrap font-medium">
            Admin
          </Link>
        )}
        {userEmail && (
          <span className="text-muted text-xs max-w-[120px] truncate lg:max-w-[180px]" title={userEmail}>
            {userEmail}
          </span>
        )}
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="text-muted hover:text-foreground text-sm whitespace-nowrap">
            Sign out
          </button>
        </form>
      </nav>

      {/* Mobile: hamburger + overlay */}
      <div className="md:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-lg p-2 text-muted hover:text-foreground hover:bg-white/5"
          aria-expanded={menuOpen ? "true" : "false"}
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
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-muted hover:text-foreground hover:bg-white/5"
              >
                {label}
              </Link>
            ))}
            {isSuperAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-accent hover:bg-white/5 font-medium"
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
                className="w-full rounded-lg px-4 py-3 text-left text-sm text-muted hover:text-foreground hover:bg-white/5"
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
