"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SMART_PLATFORMS } from "@core/config/smart-site";

type Platform = (typeof SMART_PLATFORMS)[number];

type PlatformsShowcaseProps = {
  platforms: readonly Platform[];
};

export function PlatformsShowcase({ platforms }: PlatformsShowcaseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(index, platforms.length - 1));
    const panel = container.children[clamped] as HTMLElement | undefined;
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setActiveIndex(clamped);
    }
  }, [platforms.length]);

  const prev = () => scrollToIndex(activeIndex - 1);
  const next = () => scrollToIndex(activeIndex + 1);

  return (
    <section id="platforms" className="relative bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <h2 className="smart-section-title mb-12 text-center lg:mb-16">
          Our Platforms
        </h2>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={prev}
          disabled={activeIndex === 0}
          className="absolute left-16 top-1/2 z-10 hidden -translate-y-1/2 text-2xl font-light text-foreground/50 transition-colors hover:text-accent disabled:opacity-30 lg:left-20 lg:block"
          aria-label="Previous platform"
        >
          ←
        </button>

        <button
          type="button"
          onClick={next}
          disabled={activeIndex === platforms.length - 1}
          className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 text-2xl font-light text-foreground/50 transition-colors hover:text-accent disabled:opacity-30 lg:block"
          aria-label="Next platform"
        >
          →
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-6 pb-4 scrollbar-none sm:gap-4 sm:px-10 lg:justify-center lg:gap-5 lg:px-16"
          onScroll={() => {
            const container = scrollRef.current;
            if (!container) return;
            const panels = Array.from(container.children) as HTMLElement[];
            const center = container.scrollLeft + container.clientWidth / 2;
            let closest = 0;
            let minDist = Infinity;
            panels.forEach((panel, i) => {
              const panelCenter = panel.offsetLeft + panel.offsetWidth / 2;
              const dist = Math.abs(center - panelCenter);
              if (dist < minDist) {
                minDist = dist;
                closest = i;
              }
            });
            setActiveIndex(closest);
          }}
        >
          {platforms.map((platform) => (
            <Link
              key={platform.id}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex h-[420px] w-[200px] shrink-0 flex-col justify-between overflow-hidden sm:h-[480px] sm:w-[220px] lg:h-[520px] lg:w-[240px]"
            >
              <Image
                src={platform.panelImage}
                alt={platform.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="240px"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/70" />

              <p className="relative z-10 p-4 text-[10px] font-semibold uppercase leading-snug tracking-[0.15em] text-foreground sm:text-xs">
                {platform.name}
              </p>

              <p className="smart-vertical-text relative z-10 mb-6 ml-4 text-[9px] font-medium uppercase tracking-[0.3em] text-foreground/70">
                Platform
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
