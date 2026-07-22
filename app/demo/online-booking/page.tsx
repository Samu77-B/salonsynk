import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your Salon — Book online (demo)",
  description: "Filming demo: generic salon website with SalonSynk booking embed. Noindex.",
  robots: { index: false, follow: false },
};

const DEFAULT_SLUG =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_SLUG?.trim() || "fabhair";

/**
 * Fake salon website chrome + live booking embed — for How it works / marketing screen recordings.
 * Use ?slug=your-salon to point at any salon. Embed uses ?neutral=1 so logo/real name are hidden.
 */
export default async function DemoOnlineBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: slugParam } = await searchParams;
  const slug = (slugParam?.trim() || DEFAULT_SLUG).toLowerCase();
  const embedSrc = `/book/${encodeURIComponent(slug)}/embed?neutral=1&primary=2c2c2c`;

  return (
    <div className="demo-salon-site min-h-screen bg-[#f7f5f2] text-[#1c1c1c]">
      {/* Fake browser / site chrome — crop this bar out of the recording if you want */}
      <p className="border-b border-black/10 bg-[#1c1c1c] px-4 py-1.5 text-center text-[11px] text-white/70">
        Filming demo · not a real salon ·{" "}
        <Link href="/how-it-works" className="underline hover:text-white">
          How it works
        </Link>
        {" · "}
        <span className="text-white/50">slug={slug}</span>
      </p>

      <header className="border-b border-black/10 bg-[#f7f5f2]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1c1c1c] text-xs font-semibold tracking-wide text-[#f7f5f2]"
              aria-hidden
            >
              YS
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Your Salon</p>
              <p className="truncate text-[11px] text-black/50">Hair · Colour · Style</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-black/70 sm:flex" aria-label="Demo site">
            <span className="cursor-default">Home</span>
            <span className="cursor-default">Services</span>
            <span className="cursor-default">Team</span>
            <span className="font-medium text-[#1c1c1c]">Book</span>
          </nav>
          <a
            href="#book"
            className="rounded-full bg-[#1c1c1c] px-4 py-2 text-xs font-medium text-[#f7f5f2] sm:text-sm"
          >
            Book now
          </a>
        </div>
      </header>

      <main>
        <section className="border-b border-black/10">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/45">Appointments</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Book online
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-black/60 sm:text-base">
              Choose a service and time — this booking form sits on your salon website so clients never leave
              your site.
            </p>
          </div>
        </section>

        <section id="book" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
            <div className="border-b border-black/5 px-4 py-3 sm:px-5">
              <p className="text-xs font-medium text-black/45">Live booking · embedded on this page</p>
            </div>
            <iframe
              title="Book an appointment"
              src={embedSrc}
              className="block w-full border-0 bg-white"
              style={{ minHeight: 780 }}
              loading="eager"
            />
          </div>
          <p className="mt-4 text-center text-xs text-black/40">
            Tip: pass <code className="rounded bg-black/5 px-1">?slug=your-salon</code> to use a different salon.
            Neutral mode hides the real logo and name in the embed.
          </p>
        </section>
      </main>

      <footer className="border-t border-black/10 py-8 text-center text-xs text-black/40">
        Your Salon · Demo website for SalonSynk walkthroughs
      </footer>
    </div>
  );
}
