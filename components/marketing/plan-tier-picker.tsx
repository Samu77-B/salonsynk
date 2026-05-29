"use client";

import {
  PLAN_MARKETING_BULLETS,
  PLAN_TIER_ORDER,
  PLAN_TIERS,
  formatPlanPrice,
  type PlanTierId,
} from "@/config/plans";

export function PlanTierPicker({
  value,
  onChange,
  name = "planTier",
}: {
  value: PlanTierId;
  onChange: (tier: PlanTierId) => void;
  name?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-medium mb-1">Choose your plan</legend>
      <p className="text-xs text-muted -mt-1 mb-2">
        No per-booking commissions on any plan. We&apos;ll confirm your tier when we set up your salon.
      </p>
      <div className="grid gap-3 sm:grid-cols-1">
        {PLAN_TIER_ORDER.map((tierId) => {
          const tier = PLAN_TIERS[tierId];
          const selected = value === tierId;
          const highlighted = tierId === "professional";
          const topBullets = PLAN_MARKETING_BULLETS[tierId].slice(0, 4);

          return (
            <label
              key={tierId}
              className={`relative flex cursor-pointer rounded-xl border p-4 transition-colors ${
                selected
                  ? "border-accent bg-accent/5 ring-2 ring-accent"
                  : "border-border bg-background hover:border-muted"
              } ${highlighted && !selected ? "border-zinc-400" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={tierId}
                checked={selected}
                onChange={() => onChange(tierId)}
                className="mt-1 mr-3 shrink-0 accent-accent"
                required
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-foreground">{tier.label}</span>
                  <span className="text-sm font-bold text-foreground">{formatPlanPrice(tierId)}</span>
                  {highlighted && (
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                      Popular
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{tier.tagline}</span>
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {topBullets.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
