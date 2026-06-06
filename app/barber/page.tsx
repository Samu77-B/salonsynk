import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { BARBER_SITE } from "@core/config/barber-site";

const FEATURES = [
  {
    icon: "⚡",
    title: "Live Queue",
    description:
      "Customers join via QR code or walk in. Your team sees the queue update in real time — no clipboards, no chaos.",
  },
  {
    icon: "✂",
    title: "Chair Management",
    description:
      "Assign barbers to chairs, track who's cutting, and see at a glance who's free for the next walk-in.",
  },
  {
    icon: "💳",
    title: "Cash or Card",
    description:
      "Toggle between cash and card at the end of every cut. Revenue tracked automatically — no end-of-day maths.",
  },
  {
    icon: "📅",
    title: "Pre-Bookings Too",
    description:
      "Some clients want to book ahead. Pre-booked slots sit alongside walk-ins so nothing clashes.",
  },
  {
    icon: "📊",
    title: "Daily Stats",
    description:
      "See how many you've served, revenue by barber, cash vs card split — all in real time on the dashboard.",
  },
  {
    icon: "📱",
    title: "Customer Queue Page",
    description:
      "Give customers a link or QR code. They join from their phone and see their position — no waiting inside.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does BarberSynk cost?",
    a: "Simple flat-fee plans from £29/mo per shop. No per-cut commissions — you keep 100% of what you take.",
  },
  {
    q: "Do customers need an app?",
    a: "No. They visit your shop's queue page in their browser (via QR code or link). No download needed.",
  },
  {
    q: "Can I still take walk-ins without the queue page?",
    a: "Absolutely. Your team can add walk-ins directly from the dashboard. The public queue page is optional.",
  },
  {
    q: "Do I need a card machine?",
    a: "No. BarberSynk tracks cash and card sales, but you use your own card machine. We don't process payments for you (unless you connect Stripe).",
  },
  {
    q: "Is it just for UK barbers?",
    a: "Built with UK barber shops in mind, but it works anywhere. Pricing is in GBP.",
  },
];

export default function BarberHomePage() {
  return (
    <div className="barber-marketing min-h-screen bg-[#0a0a0a] text-[#f5f5f5]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-black tracking-tight">
            Barber<span className="text-amber-500">Synk</span>
          </span>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <a href="#features" className="text-white/70 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-white/70 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-white/70 hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-4xl px-4 py-24 sm:py-32 lg:py-40 text-center">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Your chair.{" "}
              <span className="text-amber-500">Your queue.</span>
              <br />
              Your rules.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 leading-relaxed">
              {BARBER_SITE.description} Flat-fee plans from £29/mo — no commissions, no per-cut charges.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded bg-amber-600 px-8 py-4 text-base font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
              >
                Start Free Trial
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded border border-white/20 px-8 py-4 text-base font-semibold text-white hover:border-white/40 hover:bg-white/5 transition-colors"
              >
                See How It Works
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <Reveal>
          <section id="features" className="border-b border-white/5 py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl">
                Built for the way barber shops actually work
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-center text-white/60">
                Walk-ins, queues, cash, card — all tracked from a single screen.
              </p>
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded border border-white/10 bg-white/[0.03] p-6 hover:border-amber-500/30 hover:bg-white/[0.05] transition-all"
                  >
                    <span className="text-2xl">{f.icon}</span>
                    <h3 className="mt-3 font-semibold text-white">{f.title}</h3>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* How it works */}
        <Reveal>
          <section className="border-b border-white/5 bg-white/[0.02] py-20 sm:py-24">
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl">
                Three steps. Zero hassle.
              </h2>
              <div className="mt-14 grid gap-8 sm:grid-cols-3">
                {[
                  { step: "1", title: "Customer joins", desc: "They scan the QR code on your door or give their name at the desk." },
                  { step: "2", title: "You cut", desc: "Tap 'Start' when they sit down. The queue updates for everyone." },
                  { step: "3", title: "Cash or card", desc: "Tap the payment method and hit 'Complete'. Done. Next customer." },
                ].map((s) => (
                  <div key={s.step} className="text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-600/20 text-amber-500 text-lg font-bold">
                      {s.step}
                    </span>
                    <h3 className="mt-4 font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm text-white/60">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* Pricing */}
        <Reveal>
          <section id="pricing" className="border-b border-white/5 py-20 sm:py-24">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                Simple pricing. No surprises.
              </h2>
              <p className="mt-3 text-white/60">
                One flat fee per shop. No commissions, no per-cut charges.
              </p>
              <div className="mx-auto mt-12 max-w-sm rounded border border-amber-500/30 bg-white/[0.03] p-8">
                <p className="text-sm font-semibold text-amber-500 uppercase tracking-wider">Per shop</p>
                <p className="mt-2 text-5xl font-black">
                  £29<span className="text-lg font-normal text-white/50">/mo</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-white/70 text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Unlimited walk-ins and queue entries
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Unlimited barbers and chairs
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Public queue page with QR code
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Real-time dashboard across all devices
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Cash and card tracking
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Pre-booked appointments
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    Daily revenue reports
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block w-full rounded bg-amber-600 py-3 text-center text-sm font-bold text-white hover:bg-amber-500 transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

        {/* FAQ */}
        <Reveal>
          <section id="faq" className="border-b border-white/5 bg-white/[0.02] py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl">
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                  >
                    <dt className="font-semibold text-white">{item.q}</dt>
                    <dd className="mt-2 text-sm text-white/60 leading-relaxed">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </Reveal>

        {/* CTA */}
        <Reveal>
          <section className="py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                Ready to ditch the clipboard?
              </h2>
              <p className="mt-3 text-white/60">
                Set up in minutes. Start managing your queue today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded bg-amber-600 px-8 py-4 text-base font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
                >
                  Start Free Trial
                </Link>
                <a
                  href={`mailto:${BARBER_SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded border border-white/20 px-8 py-4 text-base font-semibold text-white hover:border-white/40 hover:bg-white/5 transition-colors"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Footer */}
        <footer className="border-t border-white/10 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-bold">
              Barber<span className="text-amber-500">Synk</span>
            </span>
            <p className="text-xs text-white/40">
              © {new Date().getFullYear()} {BARBER_SITE.studio}. All rights reserved.
            </p>
            <a
              href={`mailto:${BARBER_SITE.email}`}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              {BARBER_SITE.email}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
