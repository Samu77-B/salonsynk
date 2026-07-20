import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { NAIL_MONTHLY_GBP } from "@core/billing/platform-billing";
import { NAIL_SITE } from "@core/config/nail-site";
import heroImage from "../../imgs/nail/hero.png";
/* eslint-disable @next/next/no-img-element */

const ACCENT = "#E8B5C2";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_MUTED = "#5c5c5c";
const PRICE_LABEL = `£${NAIL_MONTHLY_GBP}`;

const HOW_IT_WORKS = [
  {
    icon: "/imgs/nail/how/step-join.svg",
    title: "Client joins",
    desc: "They scan the QR code at your door, enter their name, and join the queue from their phone — no app needed.",
  },
  {
    icon: "/imgs/nail/how/step-serve.svg",
    title: "Your team serves",
    desc: "The live queue updates on every screen. Tap Start when a client sits down — everyone on shift sees who's waiting and who's at the station.",
  },
  {
    icon: "/imgs/nail/how/step-notify.svg",
    title: "They're notified",
    desc: "Waiting clients get a text automatically when you tap Start. No shouting names across the salon — they can wait nearby until it's their turn.",
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
    title: "Customer Self-Check-in",
    description:
      "Every salon gets a free branded window sticker with your unique QR code — clients scan at the door, join the queue in seconds, and never need to download an app.",
  },
  {
    title: "Automatic Text Updates",
    description:
      "When you tap Start, waiting clients get a text so they know when it's their turn. No shouting names across the salon.",
  },
  {
    title: "Real-Time for Your Team",
    description:
      "New walk-ins appear on the queue screen instantly. Everyone on shift sees the same live list — reception, technicians, and managers.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does NailSynk cost?",
    a: `${PRICE_LABEL} per calendar month, per salon. No per-service commissions, no hidden fees — you keep 100% of what you take.`,
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
    q: "How do clients know when it's their turn?",
    a: "When your technician taps Start, NailSynk texts the next people in the queue automatically — so they can wait nearby without hovering at the desk.",
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
          <Link href="/nail" className="flex items-center shrink-0 min-w-0">
            <img
              src="/imgs/nail/nailsynk-icon-v3.png"
              alt="NailSynk"
              className="h-10 w-auto md:hidden"
            />
            <img
              src="/imgs/nail/nailsynk_logo_blk.png"
              alt="NailSynk"
              className="hidden h-12 w-auto max-w-[min(100%,18rem)] md:block sm:h-14"
            />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5 shrink-0">
            <a href="#features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:inline">
              How it works
            </a>
            <a href="#pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              Pricing
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
                  <span style={{ color: ACCENT }}>Your way.</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                  Walk-in queue for nail bars. Clients scan to join, your team sees the live queue, and waiting
                  customers get a text when it&apos;s their turn. From just {PRICE_LABEL}/mo.
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
                Built around walk-ins, queues, and getting clients served in order.
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
          <section id="pricing" className="py-20 sm:py-24" style={{ backgroundColor: WHITE, color: BLACK }}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: BLACK }}>
                Simple pricing. No surprises.
              </h2>
              <p className="mt-3" style={{ color: TEXT_MUTED }}>
                One flat fee per salon. No commissions, no per-service charges, no contracts.
              </p>
              <div
                className="mx-auto mt-12 max-w-md rounded border p-6 sm:p-10"
                style={{ borderColor: ACCENT, backgroundColor: WHITE }}
              >
                <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#9B4B6A" }}>
                  Per salon / per month
                </p>
                <p className="mt-3 text-6xl font-black" style={{ color: BLACK }}>
                  {PRICE_LABEL}
                  <span className="text-xl font-normal" style={{ color: TEXT_MUTED }}>
                    {" "}
                    pcm
                  </span>
                </p>
                <ul className="mt-8 space-y-4 text-sm text-left" style={{ color: TEXT_MUTED }}>
                  {[
                    "Live walk-in queue management",
                    "Customer self-check-in via QR code",
                    "Automatic text updates when it is their turn",
                    "Unlimited technicians and stations",
                    "Team-wide real-time queue view",
                    "Works on any device — tablet, phone, laptop",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 text-base" style={{ color: "#9B4B6A" }}>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/nail/signup"
                  className="mt-10 block w-full rounded py-4 text-center text-base font-bold transition-colors"
                  style={{ backgroundColor: ACCENT, color: BLACK }}
                >
                  Request Access
                </Link>
                <p className="mt-3 text-xs" style={{ color: "#8a8278" }}>
                  No card required to request access. Cancel anytime once live.
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: BLACK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: WHITE }}>
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border p-6"
                    style={{ borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    <dt className="font-semibold" style={{ color: WHITE }}>{item.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 sm:py-24" style={{ backgroundColor: WHITE, color: BLACK }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: BLACK }}>
                Ready to streamline your salon?
              </h2>
              <p className="mt-3" style={{ color: TEXT_MUTED }}>
                Request access or email{" "}
                <a href={`mailto:${NAIL_SITE.email}`} className="underline hover:opacity-80" style={{ color: "#9B4B6A" }}>
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
                  style={{ borderColor: BLACK, color: BLACK }}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        <SynkPlatformFooter
          backgroundColor={BLACK}
          studio={NAIL_SITE.studio}
          email={NAIL_SITE.email}
          linkAccent={ACCENT}
          logo={
            <img
              src="/imgs/nail/nailsynk_logo_wht.png"
              alt="NailSynk"
              className="h-10 w-auto max-w-[min(100%,16rem)]"
            />
          }
        />
      </main>
    </div>
  );
}
