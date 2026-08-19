"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SMART_HERO_SLIDES } from "@core/config/smart-site";
import { FirstMonthFree } from "@/components/marketing/first-month-free";

type HeroSlide = (typeof SMART_HERO_SLIDES)[number];

type HeroSliderProps = {
  slides: readonly HeroSlide[];
};

const AUTO_ADVANCE_MS = 6000;

export function HeroSlider({ slides }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const currentRef = useRef(current);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % total) + total) % total);
    },
    [total],
  );

  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  useEffect(() => {
    if (total <= 1 || paused) return;

    const id = window.setInterval(() => {
      goTo(currentRef.current + 1);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(id);
  }, [current, goTo, paused, total]);

  const slide = slides[current];

  return (
    <section
      id="hero"
      className="relative w-full min-h-[480px] sm:min-h-[600px] lg:min-h-[700px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0">
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

      <div className="relative mx-auto flex min-h-[480px] sm:min-h-[600px] lg:min-h-[700px] max-w-6xl flex-col justify-end px-4 pb-16 pt-12 sm:px-6 sm:pb-20 lg:pb-24">
        <div className="mb-6 flex items-center gap-4 text-sm text-white/70">
          <button
            type="button"
            onClick={prev}
            className="font-medium transition-colors hover:text-white"
            aria-label="Previous slide"
          >
            ← Prev
          </button>
          <span className="text-white/90">
            {current + 1} / {total}
          </span>
          <button
            type="button"
            onClick={next}
            className="font-medium transition-colors hover:text-white"
            aria-label="Next slide"
          >
            Next →
          </button>
        </div>

        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
          {slide.headline}
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
          {slide.description}
        </p>

        <Link
          href={slide.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex w-fit items-center justify-center rounded-lg px-8 py-4 text-base font-bold text-white transition-colors shadow-lg hover:brightness-110"
          style={{ backgroundColor: "#FF6B2C" }}
        >
          {slide.cta}
        </Link>
        <FirstMonthFree className="mt-4 text-white" />
      </div>
    </section>
  );
}
