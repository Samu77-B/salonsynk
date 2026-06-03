import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer";
import { MarketingSiteHeader } from "@/components/marketing/marketing-site-header";
import { PricingPlansSection } from "@/components/marketing/pricing-plans-section";
import {
  OUTCOME_GROUPS,
  ROADMAP_HIGHLIGHTS,
  UK_REASSURANCE_LEAD,
} from "@/config/features-marketing";
import { SITE } from "@/config/site";
import { PLAN_TIERS, formatPlanPrice } from "@/config/plans";

export const metadata = {
  title: `Features — ${SITE.name}`,
  description: `Salon diary, team, clients, branded online booking, optional Stripe payments — plans from £${PLAN_TIERS.essentials.amountGbp}/mo per salon, no commissions.`,
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <MarketingSiteHeader variant="static" activeNav="features" />

      <main className="pb-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
          <Reveal>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Everything your salon gets with SalonSynk
            </h1>
            <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
              Flat-fee software for running the diary, your team, client records, and online booking — with optional
              Stripe for deposits and in-salon payments. No per-booking commissions: plans
              from {formatPlanPrice("essentials")} per salon.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-12 sm:space-y-16 py-8">
          {OUTCOME_GROUPS.map((group, i) => (
            <Reveal key={group.title}>
              <section aria-labelledby={`feature-group-${i}`}>
                <h2 id={`feature-group-${i}`} className="text-xl font-bold text-zinc-900 sm:text-2xl">
                  {group.title}
                </h2>
                <ul className="mt-5 space-y-3 text-zinc-600 leading-relaxed">
                  {group.bulletsFull.map((line) => (
                    <li key={line} className="flex gap-3">
                      <span className="text-[#808080] shrink-0 mt-0.5">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <section className="bg-[#E0E0E0] py-16 sm:py-20 mt-12 sm:mt-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <PricingPlansSection />
            </div>
          </section>
        </Reveal>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-12 sm:space-y-16 py-12 sm:py-16">
          <Reveal>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-6 py-8 sm:px-8">
              <h2 className="text-lg font-semibold text-zinc-900">On the roadmap / not our focus yet</h2>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                We&apos;d rather be upfront than promise a full enterprise suite on day one. Here&apos;s what we&apos;re
                still building or don&apos;t optimise for compared to legacy platforms:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                {ROADMAP_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-zinc-400 shrink-0">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">UK-first</h2>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
                {UK_REASSURANCE_LEAD}{" "}
                <Link href="/policy" className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
                  Privacy policy
                </Link>{" "}
                for how we handle data.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-black px-8 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                Request access
              </Link>
              <a
                href={`mailto:${SITE.email}?subject=Demo%20request`}
                className="inline-flex items-center justify-center rounded-xl border-2 border-zinc-300 bg-white px-8 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
              >
                Book a demo
              </a>
              <Link
                href="/"
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-600 hover:text-zinc-900 py-3"
              >
                ← Back to home
              </Link>
            </section>
          </Reveal>
        </div>
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
