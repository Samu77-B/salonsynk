import Link from "next/link";
import Image from "next/image";
import { SMART_NAV_ITEMS, SMART_SITE } from "@core/config/smart-site";

export function SmartHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pl-14 lg:pl-16">
      <div className="flex items-center justify-between px-4 py-5 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src={SMART_SITE.logo}
            alt={SMART_SITE.name}
            width={140}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <a
          href={`mailto:${SMART_SITE.email}`}
          className="hidden text-xs tracking-wider text-muted transition-colors hover:text-foreground md:block"
        >
          {SMART_SITE.email}
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {SMART_NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/80 transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 lg:hidden">
          <Link
            href="/login"
            className="text-xs font-medium uppercase tracking-wider text-muted transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background transition-opacity hover:opacity-90"
          >
            Start
          </Link>
        </div>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/login"
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
