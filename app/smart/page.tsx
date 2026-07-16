import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SmartHeader } from "@/components/smart/marketing/smart-header";
import { HeroSlider } from "@/components/smart/marketing/hero-slider";
import { AboutSection } from "@/components/smart/marketing/about-section";
import { PlatformShowcase } from "@/components/smart/marketing/platform-showcase";
import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { SmartSynkLogo } from "@/components/smart/smart-synk-logo";
import {
  SMART_FAQ_ITEMS,
  SMART_HERO_SLIDES,
  SMART_SHOWCASE_TABS,
  SMART_SITE,
} from "@core/config/smart-site";
import { fetchLandingStats } from "@core/smart/dashboard-stats";

const ACCENT = "#FF6B2C";
const BG = "#1a1a1a";
const TEXT = "#f5f5f5";
const MUTED = "rgba(245,245,245,0.7)";

export const metadata: Metadata = {
  title: `${SMART_SITE.name} — ${SMART_SITE.tagline}`,
  description: SMART_SITE.description,
};

export default async function SmartLandingPage() {
  let stats = { businesses: 0, appointments: 0, transactions: 0, platforms: 3 };
  try {
    stats = await fetchLandingStats();
  } catch {
    // DB unavailable in dev without credentials
  }

  return (
    <div className="smart-marketing min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      <SmartHeader />

      <main>
        <HeroSlider slides={SMART_HERO_SLIDES} />

        <AboutSection
          businesses={stats.businesses}
          appointments={stats.appointments}
          transactions={stats.transactions}
          platforms={stats.platforms}
        />

        <PlatformShowcase tabs={SMART_SHOWCASE_TABS} />

        <Reveal>
          <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: BG }}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: TEXT }}>
                Frequently asked questions
              </h2>
              <dl className="mt-10 space-y-4">
                {SMART_FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded border p-6"
                    style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" }}
                  >
                    <dt className="font-semibold" style={{ color: TEXT }}>{item.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 sm:py-24 bg-white text-zinc-900">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl text-zinc-900">
                One login. Three platforms.
              </h2>
              <p className="mt-3 text-zinc-600">
                Sign in to manage your salon, barber shop, or nail studio from the SmartSynk hub.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
                  style={{ backgroundColor: ACCENT }}
                >
                  Sign in to SmartSynk
                </Link>
                <a
                  href={`mailto:${SMART_SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-8 py-4 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Contact us
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        <SynkPlatformFooter
          backgroundColor="#141414"
          studio={SMART_SITE.studio}
          email={SMART_SITE.email}
          logo={<SmartSynkLogo variant="footer" />}
        />
      </main>
    </div>
  );
}
