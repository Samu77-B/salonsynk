import type { Metadata } from "next";
import { SmartHeader } from "@/components/smart/marketing/smart-header";
import { HeroSlider } from "@/components/smart/marketing/hero-slider";
import { AboutSection } from "@/components/smart/marketing/about-section";
import { PlatformShowcase } from "@/components/smart/marketing/platform-showcase";
import { SMART_HERO_SLIDES, SMART_SHOWCASE_TABS, SMART_SITE } from "@core/config/smart-site";
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

        <PlatformShowcase tabs={SMART_SHOWCASE_TABS} />
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p>© {new Date().getFullYear()} {SMART_SITE.url.replace("https://", "")}</p>
      </footer>
    </div>
  );
}
