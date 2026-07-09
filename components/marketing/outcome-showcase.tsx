"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type OutcomeShowcaseAccordionItem = {
  title: string;
  body: string;
  bullets?: readonly string[];
};

export type OutcomeShowcaseTab = {
  id: string;
  label: string;
  productName: string;
  tagline: string;
  ctaLabel: string;
  href: string;
  color?: string;
  image: string;
  imageAlt: string;
  accordion: readonly OutcomeShowcaseAccordionItem[];
  features: readonly string[];
};

type OutcomeShowcaseProps = {
  id?: string;
  sectionLabel?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  tabs: readonly OutcomeShowcaseTab[];
  variant?: "smart" | "light";
  productBadge?: string;
  renderIcon?: (tabId: string) => React.ReactNode;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function OutcomeShowcase({
  id = "platforms",
  sectionLabel = "Our platforms",
  sectionTitle,
  sectionSubtitle,
  tabs,
  variant = "smart",
  productBadge = "Platform",
  renderIcon,
}: OutcomeShowcaseProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [openAccordionIndex, setOpenAccordionIndex] = useState(0);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setOpenAccordionIndex(0);
  }, []);

  if (!activeTab) return null;

  const isSmart = variant === "smart";
  const accent = activeTab.color ?? (isSmart ? "var(--accent)" : "#18181b");

  return (
    <section
      id={id}
      className={
        isSmart
          ? "relative bg-canvas py-20 lg:py-28"
          : "relative border-t border-zinc-200 bg-white py-16 sm:py-20"
      }
    >
      <div className={isSmart ? "mx-auto max-w-7xl px-6 sm:px-10 lg:px-16" : "mx-auto max-w-6xl px-4 sm:px-6"}>
        {sectionLabel && (
          <p className={isSmart ? "smart-section-title mb-4 text-center" : "text-center text-sm font-semibold uppercase tracking-wider text-zinc-500"}>
            {sectionLabel}
          </p>
        )}
        {sectionTitle && (
          <h2
            className={
              isSmart
                ? "mb-3 text-center font-heading text-2xl font-bold lowercase text-foreground sm:text-3xl"
                : "mb-3 text-center text-2xl font-bold text-zinc-900 sm:text-3xl"
            }
          >
            {sectionTitle}
          </h2>
        )}
        {sectionSubtitle && (
          <p
            className={
              isSmart
                ? "mx-auto mb-10 max-w-2xl text-center text-sm text-muted sm:text-base"
                : "mx-auto mb-10 max-w-2xl text-center text-sm text-zinc-600 sm:text-base"
            }
          >
            {sectionSubtitle}
          </p>
        )}

        {/* Tab pills */}
        <div
          className={`flex flex-wrap justify-center gap-2 sm:gap-3 ${sectionTitle || sectionSubtitle ? "" : "mb-10"}`}
          role="tablist"
          aria-label="Platform categories"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(tab.id)}
                className={
                  isSmart
                    ? `rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors sm:px-5 sm:py-2.5 sm:text-xs ${
                        selected
                          ? "border-accent bg-accent text-background"
                          : "border-border bg-card/40 text-foreground/80 hover:border-accent/50 hover:text-foreground"
                      }`
                    : `rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:px-5 ${
                        selected
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                      }`
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main card */}
        <div
          className={
            isSmart
              ? "mt-8 overflow-hidden rounded-2xl border border-border bg-card/30"
              : "mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          }
          role="tabpanel"
        >
          {/* Card header */}
          <div
            className={
              isSmart
                ? "flex flex-col gap-4 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8"
                : "flex flex-col gap-4 border-b border-zinc-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8"
            }
          >
            <div className="flex items-start gap-4">
              {renderIcon && (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${accent}20`,
                    color: accent,
                  }}
                >
                  {renderIcon(activeTab.id)}
                </div>
              )}
              <div>
                <p className={isSmart ? "text-[10px] font-semibold uppercase tracking-[0.2em] text-muted" : "text-xs font-semibold uppercase tracking-wider text-zinc-500"}>
                  {productBadge}
                </p>
                <h3 className={isSmart ? "mt-1 font-heading text-xl font-bold text-foreground sm:text-2xl" : "mt-1 text-xl font-bold text-zinc-900 sm:text-2xl"}>
                  {activeTab.productName}
                </h3>
                <p className={isSmart ? "mt-1 max-w-xl text-sm text-muted" : "mt-1 max-w-xl text-sm text-zinc-600"}>
                  {activeTab.tagline}
                </p>
              </div>
            </div>
            <Link
              href={activeTab.href}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isSmart
                  ? "inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
                  : "inline-flex shrink-0 items-center justify-center rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              }
              style={isSmart ? { backgroundColor: accent } : undefined}
            >
              {activeTab.ctaLabel}
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Two-column body */}
          <div className="grid lg:grid-cols-2">
            {/* Accordion */}
            <div className={isSmart ? "border-b border-border p-6 sm:p-8 lg:border-b-0 lg:border-r" : "border-b border-zinc-200 p-6 sm:p-8 lg:border-b-0 lg:border-r"}>
              <div className="space-y-3">
                {activeTab.accordion.map((item, index) => {
                  const open = openAccordionIndex === index;
                  return (
                    <div
                      key={item.title}
                      className={
                        isSmart
                          ? `rounded-xl border transition-colors ${open ? "border-accent/40 bg-card/60" : "border-border/60 bg-card/20"}`
                          : `rounded-xl border transition-colors ${open ? "border-zinc-300 bg-zinc-50" : "border-zinc-200 bg-white"}`
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setOpenAccordionIndex(index)}
                        className={
                          isSmart
                            ? "flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
                            : "flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
                        }
                        aria-expanded={open}
                      >
                        <span className={isSmart ? "mt-0.5 text-accent" : "mt-0.5 text-zinc-500"}>
                          <Chevron open={open} />
                        </span>
                        <span className={isSmart ? "text-sm font-semibold leading-snug text-foreground sm:text-base" : "text-sm font-semibold leading-snug text-zinc-900 sm:text-base"}>
                          {item.title}
                        </span>
                      </button>
                      {open && (
                        <div className="px-4 pb-5 pl-11 sm:px-5 sm:pl-12">
                          <p className={isSmart ? "text-sm leading-relaxed text-muted" : "text-sm leading-relaxed text-zinc-600"}>
                            {item.body}
                          </p>
                          {item.bullets && item.bullets.length > 0 && (
                            <ul className={isSmart ? "mt-4 space-y-2 text-sm text-foreground/85" : "mt-4 space-y-2 text-sm text-zinc-700"}>
                              {item.bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual + features */}
            <div className="p-6 sm:p-8">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/60">
                <Image
                  src={activeTab.image}
                  alt={activeTab.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: isSmart
                      ? "linear-gradient(to top, rgba(26,26,26,0.55) 0%, transparent 50%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 45%)",
                  }}
                />
              </div>

              <div className="mt-6">
                <p className={isSmart ? "text-[10px] font-semibold uppercase tracking-[0.2em] text-muted" : "text-xs font-semibold uppercase tracking-wider text-zinc-500"}>
                  Popular features
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {activeTab.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: isSmart ? `${accent}25` : "#f4f4f5", color: accent }}
                      >
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      <span className={isSmart ? "text-sm text-foreground/90" : "text-sm text-zinc-700"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
