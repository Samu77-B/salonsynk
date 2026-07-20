import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";
import siteLogo from "@/salonsynk_logo.png";

type ActiveNav = "home" | "features" | "how-it-works" | "none";

type Props = {
  /** Homepage uses fixed header over hero */
  variant?: "fixed" | "static";
  activeNav?: ActiveNav;
};

function navClass(isActive: boolean) {
  return isActive
    ? "text-sm font-semibold text-zinc-900"
    : "text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors";
}

export function MarketingSiteHeader({ variant = "static", activeNav = "none" }: Props) {
  const fixed = variant === "fixed";
  return (
    <header
      className={
        fixed
          ? "fixed top-0 left-0 right-0 z-50 border-b border-zinc-200/80 bg-white"
          : "border-b border-zinc-200/80 bg-white"
      }
    >
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center shrink-0 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/salonsynk-icon-v3.png"
            alt={SITE.name}
            className="h-10 w-auto md:hidden"
          />
          <Image
            src={siteLogo}
            alt={SITE.name}
            width={1024}
            height={224}
            className="hidden h-12 w-auto max-w-[min(100%,18rem)] md:block sm:h-14"
            sizes="(min-width: 640px) 280px, 220px"
            quality={100}
            priority={fixed}
          />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
          <Link href="/features" className={navClass(activeNav === "features")}>
            Features
          </Link>
          <Link href="/how-it-works" className={navClass(activeNav === "how-it-works")}>
            How it works
          </Link>
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
