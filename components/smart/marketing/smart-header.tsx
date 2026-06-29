import Link from "next/link";
import Image from "next/image";
import { SMART_SITE } from "@core/config/smart-site";

const NAV_ITEMS = [
  { label: "Product", href: "#platforms" },
  { label: "Solutions", href: "#platforms" },
  { label: "Pricing", href: "#platforms" },
  { label: "Resources", href: "#platforms" },
  { label: "Company", href: "#platforms" },
];

export function SmartHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/imgs/smart/logo.png"
            alt={SMART_SITE.name}
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="font-heading text-lg font-semibold tracking-tight">{SMART_SITE.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-xs font-medium uppercase tracking-wider text-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-foreground/30 px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
