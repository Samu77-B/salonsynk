import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";
import { formatFlatFee, FLAT_FEE } from "@/config/subscription";
// Bundled so the hero image is always available in the build
import heroImage from "../imgs/hero01.png";

const FEATURES = [
  {
    title: "One diary",
    description: "See your whole team’s appointments in one place. No more double-booking or messy spreadsheets.",
    icon: "📅",
  },
  {
    title: "Your team, your clients",
    description: "Add stylists, manage clients, and keep colour formulas and notes in one system.",
    icon: "👥",
  },
  {
    title: "Online booking",
    description: "Let clients book 24/7 via your branded booking page. Seamless from your website.",
    icon: "🌐",
  },
  {
    title: "No commissions",
    description: "One flat fee per month. No per-booking cuts — you keep what you earn.",
    icon: "💷",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does SalonSynk cost?",
    a: `SalonSynk is a flat £${FLAT_FEE.AMOUNT_GBP} per month per salon. There are no per-booking commissions — you keep 100% of what you take.`,
  },
  {
    q: "Can clients book online?",
    a: "Yes. Each salon gets a unique booking page (e.g. salonsynk.com/book/your-salon) that you can link from your website. Clients pick a service, stylist, and time.",
  },
  {
    q: "Do I need to connect Stripe?",
    a: "Stripe is optional. You can use SalonSynk for diary and bookings without it. Connect Stripe when you want to take deposits or in-salon payments.",
  },
  {
    q: "Is it just for UK salons?",
    a: "We’re built with UK salons and barbers in mind, but the product works anywhere. Pricing is in GBP.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
        <div className="flex h-20 w-full items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/salonsynk_logo-grey.png"
              alt={SITE.name}
              width={56}
              height={56}
              className="h-14 w-auto sm:h-16"
            />
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors shrink-0"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero – full width, 100vh */}
        <section className="relative w-full h-[100vh] min-h-[400px] overflow-hidden">
          <Image
            src={heroImage}
            alt="Modern salon with appointment booking"
            fill
            className="object-cover"
            priority
            unoptimized
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow-lg">
              No commissions.
              <br />
              <span className="text-violet-300">Just Synk.</span>
            </h1>
            <p className="mt-4 text-lg text-white/95 max-w-xl drop-shadow-md">
              Flat-fee salon management for UK salons and barbers. One diary,
              your team, your clients — without the cut.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-violet-700 transition-colors"
              >
                Get started
              </Link>
              <a
                href="#book-demo"
                className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-white/10 backdrop-blur px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Book a demo
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-zinc-200 bg-zinc-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
              Everything you need to run your salon
            </h2>
            <p className="mt-3 text-center text-zinc-600 max-w-2xl mx-auto">
              One simple system for your diary, team, clients, and online booking.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all"
                >
                  <span className="text-3xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-center text-zinc-600 max-w-xl mx-auto">
              One flat fee. No per-booking commissions. Cancel anytime.
            </p>
            <div className="mt-12 flex justify-center">
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 px-8 py-8 sm:px-12 sm:py-10 text-center max-w-md">
                <p className="text-4xl font-bold text-zinc-900 sm:text-5xl">
                  {formatFlatFee()}
                </p>
                <p className="mt-2 text-zinc-600">per salon, per month</p>
                <ul className="mt-6 space-y-2 text-left text-sm text-zinc-700">
                  <li className="flex items-center gap-2">
                    <span className="text-violet-500">✓</span> Unlimited team
                    members
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-violet-500">✓</span> Unlimited clients
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-violet-500">✓</span> Branded booking
                    page
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-violet-500">✓</span> No commissions
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-200 bg-zinc-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
              Frequently asked questions
            </h2>
            <dl className="mt-10 space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
                >
                  <dt className="font-semibold text-zinc-900">{item.q}</dt>
                  <dd className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Book a demo CTA */}
        <section
          id="book-demo"
          className="py-16 sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              See SalonSynk in action
            </h2>
            <p className="mt-3 text-zinc-600">
              Book a short demo and we’ll walk you through the diary, bookings,
              and how to get started.
            </p>
            <a
              href="mailto:hello@salonsynk.com?subject=Demo%20request"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              Book a demo
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-200 bg-zinc-100/80 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/salonsynk_logo-grey.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-auto opacity-80"
              />
              <span className="text-sm font-medium text-zinc-600">
                {SITE.name}
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              A product of {SITE.studio}
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}