import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { NAIL_SITE } from "@core/config/nail-site";
import heroImage from "../../imgs/nail/hero.png";
/* eslint-disable @next/next/no-img-element */

const ACCENT = "#E8B5C2";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_MUTED = "#5c5c5c";

const HOW_IT_WORKS = [
  {
    icon: "/imgs/nail/how/step-join.svg",
    title: "Client joins",
    desc: "They scan the QR code on your door or give their name at the desk.",
  },
  {
    icon: "/imgs/nail/how/step-serve.svg",
    title: "You serve",
    desc: "Tap Start when they sit down. The queue updates for everyone in real time.",
  },
  {
    icon: "/imgs/nail/how/step-pay.svg",
    title: "Cash or card",
    desc: "Complete the service and track payment. Revenue logged. Next client.",
  },
];

export const metadata: Metadata = {
  title: `${NAIL_SITE.name} — ${NAIL_SITE.tagline}`,
  description: NAIL_SITE.description,
};

const FEATURES = [
  {
    title: "Live Walk-in Queue",
    description:
      "Walk-ins join a live queue that updates instantly across every screen in your salon. No clipboards — your whole team sees who is waiting and who is at the station.",
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
    q: "How do I get in touch?",
    a: `Email us at ${NAIL_SITE.email} for demos, setup help, or questions.`,
  },
];

export default function NailHomePage() {
  return (
    <div className="nail-marketing min-h-screen" style={{ backgroundColor: BLACK, color: WHITE }}>
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white">
        <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center shrink-0 min-w-0">
            <img
              src="/imgs/nail/nailsynk_logo_blk.png"
              alt="NailSynk"
              className="h-10 w-auto md:h-12"
            />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
            <a href="#features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:inline">
              How it works
            </a>
            <a href="#faq" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              FAQ
            </a>
            <a
              href={`mailto:${NAIL_SITE.email}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden md:inline"
            >
              Contact
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-transparent flex items-center">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="max-w-xl">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: WHITE }}>
                  Your salon.
                  <br />
                  Your queue.
                  <br />
                  <span style={{ color: ACCENT }}>Your diary.</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {NAIL_SITE.description}
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/nail/signup"
                    className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold transition-colors shadow-lg"
                    style={{ backgroundColor: ACCENT, color: BLACK }}
                  >
                    Request Access
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.35)", color: WHITE }}
                  >
                    See How It Works
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Reveal>
          <section id="features" className="py-20 sm:py-24" style={{ backgroundColor: WHITE, color: BLACK }}>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: BLACK }}>
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
                    style={{ borderColor: "#e8e8e8", backgroundColor: WHITE }}
                  >
                    <h3 className="text-lg font-semibold" style={{ color: BLACK }}>{f.title}</h3>
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
          <section id="how-it-works" className="py-20 sm:py-24" style={{ backgroundColor: BLACK }}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: WHITE }}>
                Three steps. Zero hassle.
              </h2>
              <div className="mt-14 grid gap-10 sm:grid-cols-3">
                {HOW_IT_WORKS.map((s) => (
                  <div key={s.title} className="text-center">
                    <div
                      className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: "rgba(232,181,194,0.15)" }}
                    >
                      <img
                        src={s.icon}
                        alt=""
                        width={80}
                        height={80}
                        className="h-20 w-20 object-contain"
                      />
                    </div>
                    <h3 className="mt-4 font-semibold" style={{ color: WHITE }}>{s.title}</h3>
                    <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: WHITE, color: BLACK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: BLACK }}>
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border p-6"
                    style={{ borderColor: "#e8e8e8", backgroundColor: WHITE }}
                  >
                    <dt className="font-semibold" style={{ color: BLACK }}>{item.q}</dt>
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
          <section className="py-20 sm:py-24" style={{ backgroundColor: BLACK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: WHITE }}>
                Ready to streamline your salon?
              </h2>
              <p className="mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
                Request access or email{" "}
                <a href={`mailto:${NAIL_SITE.email}`} className="underline hover:opacity-80" style={{ color: ACCENT }}>
                  {NAIL_SITE.email}
                </a>
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/nail/signup"
                  className="inline-flex items-center justify-center rounded px-8 py-4 text-base font-bold transition-colors shadow-lg"
                  style={{ backgroundColor: ACCENT, color: BLACK }}
                >
                  Request Access
                </Link>
                <a
                  href={`mailto:${NAIL_SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded border px-8 py-4 text-base font-semibold transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.35)", color: WHITE }}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        <footer className="border-t py-10" style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: BLACK }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <img
              src="/imgs/nail/nailsynk_logo_wht.png"
              alt="NailSynk"
              className="h-8 w-auto"
            />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              © {new Date().getFullYear()} {NAIL_SITE.studio}. All rights reserved.
            </p>
            <a
              href={`mailto:${NAIL_SITE.email}`}
              className="text-xs transition-opacity hover:opacity-100"
              style={{ color: ACCENT }}
            >
              {NAIL_SITE.email}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
