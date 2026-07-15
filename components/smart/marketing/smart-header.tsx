import Link from "next/link";
import { SMART_NAV_ITEMS, SMART_SITE } from "@core/config/smart-site";
/* eslint-disable @next/next/no-img-element */

export function SmartHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white">
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center shrink-0 min-w-0">
          <img
            src={SMART_SITE.icon}
            alt={SMART_SITE.name}
            className="h-10 w-auto object-contain md:hidden"
          />
          <img
            src={SMART_SITE.logo}
            alt={SMART_SITE.name}
            className="hidden h-12 w-auto object-contain md:block sm:h-14"
          />
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
          {SMART_NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:inline"
            >
              {item.label}
            </a>
          ))}
          <a
            href={`mailto:${SMART_SITE.email}`}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden md:inline"
          >
            Contact
          </a>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 sm:px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
