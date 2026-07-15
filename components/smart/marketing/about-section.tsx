import Image from "next/image";
import {
  SMART_ABOUT,
  SMART_PLATFORM_FOOTER_LOGOS,
  SMART_PLATFORMS,
  SMART_SITE,
} from "@core/config/smart-site";

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

const STATS = [
  { key: "businesses" as const, label: "Businesses" },
  { key: "appointments" as const, label: "Appointments" },
  { key: "transactions" as const, label: "Transactions" },
  { key: "platforms" as const, label: "Platforms" },
];

const FOOTER_LOGO_BY_ID = Object.fromEntries(
  SMART_PLATFORM_FOOTER_LOGOS.map((logo) => [logo.id, logo]),
) as Record<(typeof SMART_PLATFORM_FOOTER_LOGOS)[number]["id"], (typeof SMART_PLATFORM_FOOTER_LOGOS)[number]>;

export function AboutSection({
  businesses,
  appointments,
  transactions,
  platforms,
}: AboutSectionProps) {
  const values = { businesses, appointments, transactions, platforms };

  return (
    <section id="about" className="py-20 sm:py-24" style={{ backgroundColor: "#141414" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl text-white">
          About {SMART_SITE.name}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm sm:text-base text-white/70">
          {SMART_SITE.description}
        </p>

        <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-8">
          <div>
            <h3 className="text-xl font-bold leading-snug text-white sm:text-2xl">
              {SMART_ABOUT.headline}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
              {SMART_ABOUT.body}
            </p>
          </div>

          <div>
            <p className="mb-6 text-sm font-semibold uppercase tracking-wide text-white/90">
              {SMART_ABOUT.specializationLabel}
            </p>
            <ul className="space-y-5">
              {SMART_PLATFORMS.map((platform) => {
                const footerLogo = FOOTER_LOGO_BY_ID[platform.id];
                return (
                  <li key={platform.id} className="flex items-center gap-4">
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-16 w-16 shrink-0 items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={footerLogo.src}
                        alt={footerLogo.alt}
                        className="max-h-16 w-auto object-contain"
                      />
                    </a>
                    <div>
                      <p className="text-sm font-semibold text-white">{platform.name}</p>
                      <p className="mt-0.5 text-xs text-white/60">{platform.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-lg border px-4 py-5 text-center"
                  style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  <p className="text-2xl font-bold text-white sm:text-3xl">
                    {stat.key === "platforms"
                      ? platforms
                      : formatCount(values[stat.key])}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-white/50">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src="/imgs/smart/about-accent.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 33vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
