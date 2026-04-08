import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/config/site";

export function MarketingSiteFooter() {
  return (
    <Reveal>
      <footer className="border-t border-zinc-200 bg-[#E0E0E0] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium text-zinc-600">{SITE.name}</span>
          <p className="text-sm text-zinc-500">
            A product of{" "}
            <a
              href="https://paradigmstudio.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
            >
              {SITE.studio}
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/features" className="text-zinc-600 hover:text-zinc-900">
              Features
            </Link>
            <Link href="/contact" className="text-zinc-600 hover:text-zinc-900">
              Contact
            </Link>
            <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">
              Terms
            </Link>
            <Link href="/policy" className="text-zinc-600 hover:text-zinc-900">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </Reveal>
  );
}
