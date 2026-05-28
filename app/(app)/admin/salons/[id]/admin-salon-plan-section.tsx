"use client";

import { useMemo, useState } from "react";
import {
  PLAN_TIERS,
  PLAN_TIER_IDS,
  PLATFORM_FEATURES,
  buildFeatureOverrides,
  formatPlanPrice,
  getEnabledFeatures,
  getFeatureOverrideValue,
  salonHasFeature,
  tierIncludesFeature,
  type FeatureOverrideValue,
  type PlanTierId,
  type PlatformFeatureId,
} from "@/config/plans";
import { adminUpdateSalonPlan } from "../actions";

export function AdminSalonPlanSection({
  salonId,
  initialPlanTier,
  initialFeatureOverrides,
  subscriptionStatus,
}: {
  salonId: string;
  initialPlanTier: PlanTierId;
  initialFeatureOverrides: Record<string, boolean>;
  subscriptionStatus: string;
}) {
  const [planTier, setPlanTier] = useState<PlanTierId>(initialPlanTier);
  const [overrides, setOverrides] = useState<Record<PlatformFeatureId, FeatureOverrideValue>>(() => {
    const init = {} as Record<PlatformFeatureId, FeatureOverrideValue>;
    for (const f of PLATFORM_FEATURES) {
      init[f.id] = getFeatureOverrideValue(initialFeatureOverrides, f.id);
    }
    return init;
  });
  const [showOverrides, setShowOverrides] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"saved" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const draftState = useMemo(
    () => ({
      plan_tier: planTier,
      feature_overrides: buildFeatureOverrides(overrides),
    }),
    [planTier, overrides]
  );

  const enabledCount = getEnabledFeatures(draftState).length;
  const tierMeta = PLAN_TIERS[planTier];

  function setOverride(featureId: PlatformFeatureId, value: FeatureOverrideValue) {
    setOverrides((prev) => ({ ...prev, [featureId]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setErrorText("");
    setLoading(true);
    const result = await adminUpdateSalonPlan(salonId, {
      planTier,
      featureOverrides: buildFeatureOverrides(overrides),
    });
    setLoading(false);
    if (result.error) {
      setSaveMsg("error");
      setErrorText(result.error);
    } else {
      setSaveMsg("saved");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 border-t border-border pt-8">
      <h2 className="text-lg font-semibold">Platform plan</h2>
      <p className="text-sm text-muted">
        Assign which SalonSynk modules this salon can use. Billing uses{" "}
        <span className="font-medium text-foreground">{formatPlanPrice(planTier)}</span> when they
        subscribe (Stripe price for this tier).
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <label htmlFor="plan-tier" className="block text-sm font-medium mb-1">
            Plan tier
          </label>
          <select
            id="plan-tier"
            value={planTier}
            onChange={(e) => setPlanTier(e.target.value as PlanTierId)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {PLAN_TIER_IDS.map((id) => (
              <option key={id} value={id}>
                {PLAN_TIERS[id].label} — {formatPlanPrice(id)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">{tierMeta.tagline}</p>
        </div>
        <div className="text-sm text-muted pb-2">
          Subscription:{" "}
          <span className="capitalize font-medium text-foreground">{subscriptionStatus}</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">
          Included features ({enabledCount} of {PLATFORM_FEATURES.length})
        </h3>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {PLATFORM_FEATURES.map((f) => {
            const inTier = tierIncludesFeature(planTier, f.id);
            const enabled = salonHasFeature(draftState, f.id);
            const override = overrides[f.id];
            return (
              <li
                key={f.id}
                className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                  enabled ? "text-foreground" : "text-muted"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    enabled
                      ? "border-green-500/60 bg-green-500/15 text-green-400"
                      : "border-border"
                  }`}
                >
                  {enabled ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{f.label}</span>
                  {override !== "default" && (
                    <span className="ml-1 text-xs text-amber-400/90">(override)</span>
                  )}
                  {!inTier && override === "default" && (
                    <span className="ml-1 text-xs text-muted">(not in tier)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOverrides((v) => !v)}
          className="text-sm text-accent hover:underline"
        >
          {showOverrides ? "Hide" : "Show"} per-feature overrides
        </button>
        {showOverrides && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Feature</th>
                  <th className="text-left px-3 py-2 font-medium">In tier</th>
                  <th className="text-left px-3 py-2 font-medium">Override</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_FEATURES.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{f.label}</span>
                      <span className="block text-xs text-muted">{f.description}</span>
                    </td>
                    <td className="px-3 py-2">{tierIncludesFeature(planTier, f.id) ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={overrides[f.id]}
                        onChange={(e) =>
                          setOverride(f.id, e.target.value as FeatureOverrideValue)
                        }
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        aria-label={`Override for ${f.label}`}
                      >
                        <option value="default">Plan default</option>
                        <option value="on">Force on</option>
                        <option value="off">Force off</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saveMsg === "saved" && <p className="text-sm text-green-400">Plan saved.</p>}
      {saveMsg === "error" && (
        <p className="text-sm text-red-400">{errorText || "Failed to save plan."}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save plan"}
      </button>
    </form>
  );
}
