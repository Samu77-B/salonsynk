"use client";

import Link from "next/link";

type SmartSidebarProps = {
  currentSlide: number;
  totalSlides: number;
};

export function SmartSidebar({ currentSlide, totalSlides }: SmartSidebarProps) {
  const slideNum = String(currentSlide + 1).padStart(2, "0");
  const totalNum = String(totalSlides).padStart(2, "0");

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-14 flex-col items-center justify-between border-r border-border/40 bg-background/60 py-8 backdrop-blur-sm lg:w-16">
      <div className="mt-16 text-center">
        <p className="font-heading text-sm font-bold text-accent lg:text-base">
          {slideNum}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">/ {totalNum}</p>
      </div>

      <p className="smart-vertical-text text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/60 lg:text-[10px]">
        Synk Platform
      </p>

      <div className="flex flex-col items-center gap-4 pb-2">
        <Link
          href="/login"
          className="smart-vertical-text text-[9px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
          title="Log in"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="smart-vertical-text text-[9px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
          title="Sign up"
        >
          Sign up
        </Link>
      </div>
    </aside>
  );
}
