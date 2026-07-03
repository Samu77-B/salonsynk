"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SmartSidebar } from "@/components/smart/marketing/smart-sidebar";
import type { SMART_HERO_SLIDES } from "@core/config/smart-site";

type HeroSlide = (typeof SMART_HERO_SLIDES)[number];

type HeroSliderProps = {
  slides: readonly HeroSlide[];
};

export function HeroSlider({ slides }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % total) + total) % total);
    },
    [total],
  );

  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  const slide = slides[current];

  return (
    <>
      <SmartSidebar currentSlide={current} totalSlides={total} />

      <section id="hero" className="relative min-h-screen pl-14 lg:pl-16">
        {/* Background slides */}
        <div className="absolute inset-0 left-14 lg:left-16">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`smart-slide-fade absolute inset-0 ${i === current ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <Image
                src={s.image}
                alt=""
                fill
                priority={i === 0}
                className="object-cover"
                sizes="100vw"
              />
              <div className="smart-hero-overlay absolute inset-0" />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative flex min-h-screen flex-col justify-end px-6 pb-16 pt-28 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
          <div className="mb-8 flex items-center gap-6">
            <button
              type="button"
              onClick={prev}
              className="group flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/70 transition-colors hover:text-accent"
              aria-label="Previous slide"
            >
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              Prev
            </button>
            <button
              type="button"
              onClick={next}
              className="group flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/70 transition-colors hover:text-accent"
              aria-label="Next slide"
            >
              Next
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>

          <h1 className="max-w-3xl font-heading text-3xl font-bold uppercase leading-tight tracking-wide text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            {slide.headline}
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-relaxed text-foreground/80 sm:text-base">
            {slide.description}
          </p>

          <Link
            href={slide.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
          >
            {slide.cta}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
