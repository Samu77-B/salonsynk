"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades/slides content in when it enters the viewport. Lightweight (one observer per instance).
 * Above-the-fold: useLayoutEffect + getBoundingClientRect reveals before first paint when possible.
 */
export function Reveal({
  children,
  className = "",
  rootMargin = "0px 0px -5% 0px",
  once = true,
}: {
  children: ReactNode;
  className?: string;
  /** IntersectionObserver rootMargin (e.g. trigger slightly before fully in view) */
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => setVisible(true);

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.top < vh && r.bottom > 0) {
      reveal();
      return;
    }

    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal();
            if (once) ob.disconnect();
          }
        }
      },
      { threshold: 0.05, rootMargin }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [once, rootMargin]);

  return (
    <div
      ref={ref}
      className={`reveal-scroll will-change-[opacity,transform] transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? "opacity-100 translate-y-0" : "translate-y-3 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
