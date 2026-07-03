import type { Metadata } from "next";
import { SmartHeader } from "@/components/smart/marketing/smart-header";
import { HeroSlider } from "@/components/smart/marketing/hero-slider";
import { AboutSection } from "@/components/smart/marketing/about-section";
import { PlatformsShowcase } from "@/components/smart/marketing/platforms-showcase";
import { SMART_HERO_SLIDES, SMART_PLATFORMS, SMART_SITE } from "@core/config/smart-site";
import { fetchLandingStats } from "@core/smart/dashboard-stats";

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
    <div className="smart-marketing min-h-screen bg-canvas text-foreground">
      <SmartHeader />

      <main>
        <HeroSlider slides={SMART_HERO_SLIDES} />

        <AboutSection
          businesses={stats.businesses}
          appointments={stats.appointments}
          transactions={stats.transactions}
          platforms={stats.platforms}
        />

        <PlatformsShowcase platforms={SMART_PLATFORMS} />
      </main>

      <footer className="border-t border-border py-8 pl-14 text-center text-sm text-muted lg:pl-16">
        <p>© {new Date().getFullYear()} {SMART_SITE.url.replace("https://", "")}</p>
      </footer>
    </div>
  );
}
