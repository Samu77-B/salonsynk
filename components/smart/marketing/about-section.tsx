import Image from "next/image";
import {
  SMART_ABOUT,
  SMART_PLATFORMS,
  SMART_SITE,
} from "@core/config/smart-site";
import {
  ScissorsIcon,
  BarberPoleIcon,
  NailPolishIcon,
} from "@/components/smart/marketing/platform-card";

type AboutSectionProps = {
  businesses: number;
  appointments: number;
  transactions: number;
  platforms: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}K+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  return n.toLocaleString();
}

const PLATFORM_ICONS = {
  salon: ScissorsIcon,
  barber: BarberPoleIcon,
  nail: NailPolishIcon,
} as const;

const STATS = [
  { key: "businesses" as const, label: "Businesses" },
  { key: "appointments" as const, label: "Appointments" },
  { key: "transactions" as const, label: "Transactions" },
  { key: "platforms" as const, label: "Platforms" },
];

export function AboutSection({
  businesses,
  appointments,
  transactions,
  platforms,
}: AboutSectionProps) {
  const values = { businesses, appointments, transactions, platforms };

  return (
    <section id="about" className="relative bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <h2 className="smart-section-title mb-16 text-center">
          About {SMART_SITE.name}
        </h2>

        <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
          {/* Left — copy */}
          <div className="relative">
            <span className="smart-watermark" aria-hidden>
              {SMART_ABOUT.watermark}
            </span>
            <h3 className="relative font-heading text-2xl font-bold lowercase leading-snug text-foreground sm:text-3xl">
              {SMART_ABOUT.headline}
            </h3>
            <p className="relative mt-6 text-sm leading-relaxed text-muted sm:text-base">
              {SMART_ABOUT.body}
            </p>
          </div>

          {/* Middle — platforms */}
          <div>
            <p className="mb-6 font-heading text-sm font-bold lowercase text-foreground">
              {SMART_ABOUT.specializationLabel}
            </p>
            <ul className="space-y-5">
              {SMART_PLATFORMS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.id];
                return (
                  <li key={platform.id} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center text-accent">
                      <Icon />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                        {platform.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{platform.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right — stats + accent image */}
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.key}
                  className="border border-border/60 bg-card/30 px-4 py-5 text-center"
                >
                  <p className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                    {stat.key === "platforms"
                      ? platforms
                      : formatCount(values[stat.key])}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="relative aspect-square overflow-hidden">
              <Image
                src="/imgs/smart/about-accent.jpg"
                alt=""
                fill
                className="object-cover grayscale"
                sizes="(max-width: 1024px) 100vw, 33vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
