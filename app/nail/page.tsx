import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { NAIL_SITE } from "@core/config/nail-site";
import heroImage from "../../imgs/hero01.png";
import scanIcon from "../../imgs/nail/scan.png";
import chairIcon from "../../imgs/nail/chair.png";
import cardIcon from "../../imgs/nail/card.png";

const ACCENT = "#9B4B6A";
const BG_DARK = "#2D2A32";
const BG_LIGHT = "#FAF7F5";
const TEXT_DARK = "#2D2A32";
const TEXT_MUTED = "#6B6560";

export const metadata: Metadata = {
  title: `${NAIL_SITE.name} — ${NAIL_SITE.tagline}`,
  description: NAIL_SITE.description,
};

const FEATURES = [
  {
    title: "Live Walk-in Queue",
    description:
      "Walk-ins join a live queue that updates instantly across every screen in your salon. No clipboards — your whole team sees who is waiting and who is in the chair.",
  },
  {
    title: "Appointment Diary",
    description:
      "Manage walk-ins and pre-booked appointments in one system. Booked slots sit alongside the queue so nothing clashes and no client gets forgotten.",
  },
  {
    title: "Patch Test Tracking",
    description:
      "Track patch test due dates on client profiles so your team knows when colour services are safe to book.",
  },
  {
    title: "Customer Self-Check-in",
    description:
      "Share a QR code at your door. Clients scan it, enter their name, and join the queue from their phone — no app download required.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does NailSynk cost?",
    a: "Simple monthly pricing per salon. No per-service commissions — you keep what you earn.",
  },
  {
    q: "Do my clients need to download an app?",
    a: "No. They scan a QR code and join the queue in their browser. Works on any phone.",
  },
  {
    q: "Can I still take walk-ins without the QR code?",
    a: "Absolutely. Your team can add walk-ins directly from the queue screen. The public join page is an optional extra.",
  },
  {
    q: "Does it replace my booking diary?",
    a: "NailSynk combines a walk-in queue with a full appointment diary — ideal for busy nail bars that do both.",
  },
  {
    q: "Is it just for UK nail salons?",
    a: "Built with UK nail bars in mind, but the platform works anywhere. Pricing is in GBP.",
  },
];

export default function NailHomePage() {
  return (
    <div className="nail-marketing min-h-screen" style={{ backgroundColor: BG_DARK, color: BG_LIGHT }}>
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white">
        <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/nail" className="flex items-center shrink-0 min-w-0">
            <span className="text-xl font-bold tracking-tight" style={{ color: TEXT_DARK }}>
              {NAIL_SITE.name}
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
            <a href="#features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Features
            </a>
            <a href="#faq" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              FAQ
            </a>
            <Link
              href="/nail/login"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 sm:px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative w-full min-h-[480px] sm:min-h-[600px] lg:min-h-[700px] overflow-hidden">
          <Image
            src={heroImage}
            alt="Nail technician working in a modern nail salon"
            fill
            className="object-cover"
            priority
            unoptimized
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent flex items-center">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="max-w-xl">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: BG_LIGHT }}>
                  Your salon.
                  <br />
                  Your queue.
                  <br />
                  <span style={{ color: ACCENT }}>Your diary.</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed" style={{ color: "rgba(250,247,245,0.85)" }}>
                  {NAIL_SITE.description}
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/nail/signup"
                    className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Request Access
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                    style={{ borderColor: "rgba(250,247,245,0.3)", color: BG_LIGHT }}
                  >
                    See How It Works
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Reveal>
          <section id="features" className="py-20 sm:py-24" style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK }}>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: TEXT_DARK }}>
                Everything your nail bar needs.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-center" style={{ color: TEXT_MUTED }}>
                Walk-in queue, appointment diary, and client records — built for nail salons.
              </p>
              <div className="mt-14 grid gap-6 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded border p-8 transition-all hover:shadow-md"
                    style={{ borderColor: "#e8e2dc", backgroundColor: "#ffffff" }}
                  >
                    <h3 className="text-lg font-semibold" style={{ color: TEXT_DARK }}>{f.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
                      {f.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 sm:py-24" style={{ backgroundColor: BG_DARK }}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: BG_LIGHT }}>
                Three steps. Zero hassle.
              </h2>
              <div className="mt-14 grid gap-10 sm:grid-cols-3">
                {[
                  { icon: scanIcon, title: "Client joins", desc: "They scan the QR code on your door or give their name at the desk." },
                  { icon: chairIcon, title: "You serve", desc: "Tap Start when they sit down. The queue updates for everyone in real time." },
                  { icon: cardIcon, title: "Cash or card", desc: "Complete the service and track payment. Revenue logged. Next client." },
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
                    <h3 className="mt-4 font-semibold" style={{ color: BG_LIGHT }}>{s.title}</h3>
                    <p className="mt-2 text-sm" style={{ color: "rgba(250,247,245,0.7)" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: BG_LIGHT, color: TEXT_DARK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: TEXT_DARK }}>
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border p-6"
                    style={{ borderColor: "#e8e2dc", backgroundColor: "#ffffff" }}
                  >
                    <dt className="font-semibold" style={{ color: TEXT_DARK }}>{item.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 sm:py-24" style={{ backgroundColor: BG_DARK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: BG_LIGHT }}>
                Ready to streamline your salon?
              </h2>
              <p className="mt-3" style={{ color: "rgba(250,247,245,0.7)" }}>
                Request access and we&apos;ll get your nail bar set up.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/nail/signup"
                  className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
                  style={{ backgroundColor: ACCENT }}
                >
                  Request Access
                </Link>
                <a
                  href={`mailto:${NAIL_SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                  style={{ borderColor: "rgba(250,247,245,0.3)", color: BG_LIGHT }}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        <footer className="border-t py-10" style={{ borderColor: "rgba(250,247,245,0.1)", backgroundColor: "#1f1c22" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-lg font-bold" style={{ color: BG_LIGHT }}>{NAIL_SITE.name}</span>
            <p className="text-xs" style={{ color: "rgba(250,247,245,0.4)" }}>
              © {new Date().getFullYear()} {NAIL_SITE.studio}. All rights reserved.
            </p>
            <a
              href={`mailto:${NAIL_SITE.email}`}
              className="text-xs transition-opacity hover:opacity-100"
              style={{ color: "rgba(250,247,245,0.4)" }}
            >
              {NAIL_SITE.email}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
