import type { Metadata } from "next";
import Image from "next/image";
import { SmartHeader } from "@/components/smart/marketing/smart-header";
import { HubGraphic } from "@/components/smart/marketing/hub-graphic";
import {
  PlatformCard,
  ScissorsIcon,
  BarberPoleIcon,
  NailPolishIcon,
} from "@/components/smart/marketing/platform-card";
import { StatsBar } from "@/components/smart/marketing/stats-bar";
import { SMART_SITE, SMART_PLATFORMS } from "@core/config/smart-site";
import { fetchLandingStats } from "@core/smart/dashboard-stats";

export const metadata: Metadata = {
  title: `${SMART_SITE.name} — ${SMART_SITE.tagline}`,
  description: SMART_SITE.description,
};

const GLOW_CLASSES = {
  salon: "smart-glow-salon",
  barber: "smart-glow-barber",
  nail: "smart-glow-nail",
} as const;

const ICONS = {
  salon: ScissorsIcon,
  barber: BarberPoleIcon,
  nail: NailPolishIcon,
} as const;

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

      <main className="relative overflow-hidden pt-20">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(126,184,218,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(126,184,218,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(500px) rotateX(60deg)",
            transformOrigin: "center top",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-accent/5 via-transparent to-transparent" />

        {/* Hero */}
        <section className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <Image
            src="/imgs/smart/logo.png"
            alt={SMART_SITE.name}
            width={80}
            height={80}
            className="mx-auto mb-6 h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {SMART_SITE.name}
          </h1>
          <p className="mt-4 font-heading text-sm font-bold uppercase tracking-[0.3em] text-accent sm:text-base">
            One platform. Three worlds.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            {SMART_SITE.description}
          </p>
        </section>

        {/* Hub + platform cards */}
        <section id="platforms" className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="relative flex flex-col items-center">
            <HubGraphic />

            <div className="mt-8 grid w-full max-w-5xl gap-6 sm:grid-cols-3">
              {SMART_PLATFORMS.map((platform) => {
                const Icon = ICONS[platform.id];
                return (
                  <PlatformCard
                    key={platform.id}
                    name={platform.name}
                    description={platform.description}
                    href={platform.url}
                    glowClass={GLOW_CLASSES[platform.id]}
                    accentColor={platform.color}
                    icon={<Icon />}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <StatsBar
        businesses={stats.businesses}
        appointments={stats.appointments}
        transactions={stats.transactions}
        platforms={stats.platforms}
      />

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p>© {new Date().getFullYear()} {SMART_SITE.url.replace("https://", "")}</p>
      </footer>
    </div>
  );
}
