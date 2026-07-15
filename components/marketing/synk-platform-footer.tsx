import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";

export const SYNK_PLATFORM_LINKS = [
  { label: "salonsynk.com", href: "https://salonsynk.com" },
  { label: "nailsynk.com", href: "https://nailsynk.com" },
  { label: "barbersynk.com", href: "https://barbersynk.com" },
] as const;

type PlatformFooterLogo = {
  href: string;
  src: string;
  alt: string;
};

type SynkPlatformFooterProps = {
  logo: ReactNode;
  platformFooterLogos?: readonly PlatformFooterLogo[];
  variant?: "dark" | "light";
  email?: string;
  studio?: string;
  borderColor?: string;
  backgroundColor?: string;
  linkAccent?: string;
};

export function SynkPlatformFooter({
  logo,
  platformFooterLogos,
  variant = "dark",
  email,
  studio,
  borderColor,
  backgroundColor,
  linkAccent,
}: SynkPlatformFooterProps) {
  const isDark = variant === "dark";

  const platformLinkClass = isDark
    ? "text-sm transition-opacity hover:opacity-100"
    : "text-sm text-zinc-600 transition-colors hover:text-zinc-900";

  const platformLinkStyle = isDark
    ? { color: linkAccent ?? "rgba(255,255,255,0.75)" }
    : undefined;

  const attributionClass = isDark
    ? "text-xs text-center"
    : "text-xs text-center text-zinc-500";

  const attributionStyle = isDark ? { color: "rgba(255,255,255,0.45)" } : undefined;

  const attributionLinkClass = isDark
    ? "underline underline-offset-2 transition-opacity hover:opacity-100"
    : "text-zinc-600 underline underline-offset-2 transition-colors hover:text-zinc-900";

  const metaClass = isDark
    ? "text-xs text-center"
    : "text-xs text-center text-zinc-500";

  const metaStyle = isDark ? { color: "rgba(255,255,255,0.4)" } : undefined;

  const emailClass = isDark
    ? "text-xs transition-opacity hover:opacity-100"
    : "text-xs text-zinc-600 transition-colors hover:text-zinc-900";

  const emailStyle = isDark
    ? { color: linkAccent ?? "rgba(255,255,255,0.45)" }
    : undefined;

  return (
    <Reveal>
      <footer
        className="border-t py-10"
        style={{
          borderColor: borderColor ?? (isDark ? "rgba(255,255,255,0.1)" : undefined),
          backgroundColor: backgroundColor ?? (isDark ? "#141414" : "#E0E0E0"),
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col items-center gap-5 text-center">
          <div>{logo}</div>

          {platformFooterLogos && platformFooterLogos.length > 0 && (
            <div className="flex flex-wrap items-end justify-center gap-8 sm:gap-10">
              {platformFooterLogos.map((item) => (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="h-24 w-auto object-contain sm:h-28"
                  />
                </a>
              ))}
            </div>
          )}

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {SYNK_PLATFORM_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={platformLinkClass}
                style={platformLinkStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className={attributionClass} style={attributionStyle}>
            A{" "}
            <a
              href="https://smartsynk.net"
              target="_blank"
              rel="noopener noreferrer"
              className={attributionLinkClass}
              style={isDark ? { color: "rgba(255,255,255,0.6)" } : undefined}
            >
              SmartSynk.net
            </a>{" "}
            platform | Powered by{" "}
            <a
              href="https://paradigmstudio.net"
              target="_blank"
              rel="noopener noreferrer"
              className={attributionLinkClass}
              style={isDark ? { color: "rgba(255,255,255,0.6)" } : undefined}
            >
              ParadigmStudio.net
            </a>
          </p>

          {(studio || email) && (
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
              {studio && (
                <p className={metaClass} style={metaStyle}>
                  © {new Date().getFullYear()} {studio}. All rights reserved.
                </p>
              )}
              {email && (
                <a href={`mailto:${email}`} className={emailClass} style={emailStyle}>
                  {email}
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    </Reveal>
  );
}
