import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { BARBER_SITE } from "@core/config/barber-site";
import heroImage from "../../imgs/barber/hero.png";
import scanIcon from "../../imgs/barber/scan.png";
import chairIcon from "../../imgs/barber/chair.png";
import cardIcon from "../../imgs/barber/card.png";
/* eslint-disable @next/next/no-img-element */

export const metadata: Metadata = {
  title: "BarberSynk — Your shop. Your queue. Your way.",
  description: BARBER_SITE.description,
};

const FEATURES = [
  {
    title: "Real-time Queue Management",
    description:
      "Walk-ins are added to a live queue that updates instantly across every screen in your shop. No clipboards, no confusion — just a clean list your whole team can see.",
  },
  {
    title: "Hybrid Booking Model",
    description:
      "Manage walk-ins and pre-booked appointments in one system. Booked slots sit alongside the queue so nothing clashes and no client gets forgotten.",
  },
  {
    title: "Performance Analytics",
    description:
      "Track daily revenue, services completed, and cash vs card split in real time. Know exactly how your shop is performing without end-of-day maths.",
  },
  {
    title: "Customer Self-Check-in",
    description:
      "Print a QR code for your door. Customers scan it, enter their name, and join the queue from their phone — no app download required.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does BarberSynk cost?",
    a: "£25 per calendar month, per shop. No per-cut commissions, no hidden fees — you keep 100% of what you take.",
  },
  {
    q: "Do my customers need to download an app?",
    a: "No. They scan a QR code and join the queue in their browser. Works on any phone, no download needed.",
  },
  {
    q: "Can I still take walk-ins without the QR code?",
    a: "Absolutely. Your team can add walk-ins directly from the dashboard. The public queue page is an optional extra.",
  },
  {
    q: "Do I need a specific card machine?",
    a: "No. BarberSynk tracks whether each client paid by cash or card, but you use your own card terminal. We don't process payments for you unless you choose to connect Stripe.",
  },
  {
    q: "Is it just for UK barbers?",
    a: "Built with UK barber shops in mind, but the platform works anywhere. Pricing is in GBP.",
  },
];

export default function BarberHomePage() {
  return (
    <div className="barber-marketing min-h-screen" style={{ backgroundColor: "#36454F", color: "#F5F1E8" }}>
      {/* Header — matches SalonSynk marketing header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white">
        <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center shrink-0 min-w-0">
            <img
              src="/imgs/barber/barbersynk_logo_blk-Mobile.png"
              alt="BarberSynk"
              className="h-10 w-auto md:hidden"
            />
            <img
              src="/imgs/barber/barbersynk_logo_blk.png"
              alt="BarberSynk"
              className="hidden md:block h-12 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
            <a href="#features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Pricing
            </a>
            <Link
              href="/barber/login"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 sm:px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative w-full min-h-[480px] sm:min-h-[600px] lg:min-h-[700px] overflow-hidden">
          <Image
            src={heroImage}
            alt="Professional barber cutting a client's hair in a modern barbershop"
            fill
            className="object-cover"
            priority
            unoptimized
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent flex items-center">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="max-w-xl">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: "#F5F1E8" }}>
                  Your shop.
                  <br />
                  Your queue.
                  <br />
                  <span style={{ color: "#A0522D" }}>Your way.</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed" style={{ color: "rgba(245,241,232,0.85)" }}>
                  Queue management built for barber shops. Walk-ins, bookings, cash or card — all from one screen. From just £25/mo.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/barber/signup"
                    className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
                    style={{ backgroundColor: "#A0522D" }}
                  >
                    Start Free Trial
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                    style={{ borderColor: "rgba(245,241,232,0.3)", color: "#F5F1E8" }}
                  >
                    See How It Works
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <Reveal>
          <section id="features" className="py-20 sm:py-24" style={{ backgroundColor: "#F5F1E8", color: "#36454F" }}>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: "#36454F" }}>
                Everything your shop needs. Nothing it doesn&apos;t.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-center" style={{ color: "#5a6a74" }}>
                Built around walk-ins, queues, and getting people in and out of the chair.
              </p>
              <div className="mt-14 grid gap-6 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded border p-8 transition-all hover:shadow-md"
                    style={{ borderColor: "#d6d0c4", backgroundColor: "#ffffff" }}
                  >
                    <h3 className="text-lg font-semibold" style={{ color: "#36454F" }}>{f.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "#5a6a74" }}>
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
          <section className="py-20 sm:py-24" style={{ backgroundColor: "#36454F" }}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: "#F5F1E8" }}>
                Three steps. Zero hassle.
              </h2>
              <div className="mt-14 grid gap-10 sm:grid-cols-3">
                {[
                  { icon: scanIcon, title: "Customer joins", desc: "They scan the QR code on your door or give their name at the desk." },
                  { icon: chairIcon, title: "You cut", desc: "Tap 'Start' when they sit down. The queue updates for everyone in real time." },
                  { icon: cardIcon, title: "Cash or card", desc: "Toggle the payment method and hit 'Complete'. Revenue tracked. Next customer." },
                ].map((s) => (
                  <div key={s.title} className="text-center">
                    <Image
                      src={s.icon}
                      alt=""
                      width={64}
                      height={64}
                      className="mx-auto h-16 w-16 object-contain"
                      unoptimized
                    />
                    <h3 className="mt-4 font-semibold" style={{ color: "#F5F1E8" }}>{s.title}</h3>
                    <p className="mt-2 text-sm" style={{ color: "rgba(245,241,232,0.7)" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* Pricing */}
        <Reveal>
          <section id="pricing" className="py-20 sm:py-24" style={{ backgroundColor: "#F5F1E8", color: "#36454F" }}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "#36454F" }}>
                Simple pricing. No surprises.
              </h2>
              <p className="mt-3" style={{ color: "#5a6a74" }}>
                One flat fee per shop. No commissions, no per-cut charges, no contracts.
              </p>
              <div
                className="mx-auto mt-12 max-w-md rounded border p-6 sm:p-10"
                style={{ borderColor: "#A0522D", backgroundColor: "#ffffff" }}
              >
                <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#A0522D" }}>
                  Per shop / per month
                </p>
                <p className="mt-3 text-6xl font-black" style={{ color: "#36454F" }}>
                  £25<span className="text-xl font-normal" style={{ color: "#5a6a74" }}> pcm</span>
                </p>
                <ul className="mt-8 space-y-4 text-sm text-left" style={{ color: "#5a6a74" }}>
                  {[
                    "Real-time queue management",
                    "Walk-in and pre-booked appointments",
                    "Unlimited barbers and chairs",
                    "Customer self-check-in via QR code",
                    "Cash and card tracking",
                    "Daily revenue and performance stats",
                    "Works on any device — tablet, phone, laptop",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 text-base" style={{ color: "#A0522D" }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/barber/signup"
                  className="mt-10 block w-full rounded py-4 text-center text-base font-bold text-white transition-colors"
                  style={{ backgroundColor: "#A0522D" }}
                >
                  Start Free Trial
                </Link>
                <p className="mt-3 text-xs" style={{ color: "#8a8278" }}>
                  No card required. Cancel anytime.
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        {/* FAQ */}
        <Reveal>
          <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: "#36454F" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: "#F5F1E8" }}>
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border p-6"
                    style={{ borderColor: "rgba(245,241,232,0.15)", backgroundColor: "rgba(245,241,232,0.05)" }}
                  >
                    <dt className="font-semibold" style={{ color: "#F5F1E8" }}>{item.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(245,241,232,0.7)" }}>
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
          <section className="py-20 sm:py-24" style={{ backgroundColor: "#F5F1E8", color: "#36454F" }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "#36454F" }}>
                Ready to ditch the clipboard?
              </h2>
              <p className="mt-3" style={{ color: "#5a6a74" }}>
                Set up in minutes. Start managing your queue today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/barber/signup"
                  className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
                  style={{ backgroundColor: "#A0522D" }}
                >
                  Start Free Trial
                </Link>
                <a
                  href={`mailto:${BARBER_SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                  style={{ borderColor: "#36454F", color: "#36454F" }}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Footer */}
        <footer className="border-t py-10" style={{ borderColor: "rgba(245,241,232,0.1)", backgroundColor: "#2b373f" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <img
              src="/imgs/barber/barbersynk_logo_wht-Mobile.png"
              alt="BarberSynk"
              className="h-8 w-auto md:hidden"
            />
            <img
              src="/imgs/barber/barbersynk_logo_wht.png"
              alt="BarberSynk"
              className="hidden md:block h-8 w-auto"
            />
            <p className="text-xs" style={{ color: "rgba(245,241,232,0.4)" }}>
              © {new Date().getFullYear()} {BARBER_SITE.studio}. All rights reserved.
            </p>
            <a
              href={`mailto:${BARBER_SITE.email}`}
              className="text-xs transition-opacity hover:opacity-100"
              style={{ color: "rgba(245,241,232,0.4)" }}
            >
              {BARBER_SITE.email}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
