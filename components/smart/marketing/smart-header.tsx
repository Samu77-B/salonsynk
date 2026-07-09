import Link from "next/link";
import Image from "next/image";
import { SMART_NAV_ITEMS, SMART_SITE } from "@core/config/smart-site";

const loginButtonClass =
  "rounded-full border border-white/30 bg-white/10 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground shadow-sm backdrop-blur-sm transition-all hover:border-white/45 hover:bg-white/15";

const signupButtonClass =
  "rounded-full bg-accent px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background shadow-[0_4px_16px_rgba(197,164,126,0.4)] transition-all hover:brightness-110";

export function SmartHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="smart-glass-nav mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src={SMART_SITE.logo}
            alt={SMART_SITE.name}
            width={140}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-8 lg:flex">
          <a
            href={`mailto:${SMART_SITE.email}`}
            className="text-xs tracking-wider text-foreground/70 transition-colors hover:text-foreground"
          >
            {SMART_SITE.email}
          </a>

          <nav className="flex items-center gap-6">
            {SMART_NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/90 transition-colors hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className={`${loginButtonClass} hidden lg:inline-flex`}>
            Log in
          </Link>
          <Link
            href="/signup"
            className={`${signupButtonClass} hidden px-5 py-2 lg:inline-flex`}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={`${loginButtonClass} px-4 py-1.5 lg:hidden`}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={`${signupButtonClass} px-4 py-2 lg:hidden`}
          >
            Start
          </Link>
        </div>
      </div>
    </header>
  );
}
