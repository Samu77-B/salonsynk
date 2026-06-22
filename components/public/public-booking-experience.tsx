"use client";

import { useState, type ReactNode } from "react";
import { PublicAiConcierge } from "./public-ai-concierge";
import { PublicSalonQa } from "./public-salon-qa";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

type Tab = "form" | "concierge" | "qa";

export function PublicBookingExperience({
  slug,
  salonName,
  form,
}: {
  slug: string;
  salonName: string;
  form: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("form");

  const tabs: { id: Tab; label: string }[] = [
    { id: "form", label: "Book online" },
    { id: "concierge", label: SYNKAI_AGENT_NAME },
    { id: "qa", label: "Salon QA" },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-background/60 p-1"
        role="tablist"
        aria-label="Booking options"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[7rem] rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
              tab === t.id
                ? "bg-accent text-background"
                : "text-muted hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "form" && form}
        {tab === "concierge" && <PublicAiConcierge slug={slug} salonName={salonName} />}
        {tab === "qa" && <PublicSalonQa slug={slug} salonName={salonName} />}
      </div>
    </div>
  );
}
