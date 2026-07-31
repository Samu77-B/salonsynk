import {
  getEnabledFeatures,
  isPlanTierId,
  salonHasFeature,
  type PlanTierId,
  type PlatformFeatureId,
  type SalonPlanState,
} from "@/config/plans";

export type SalonPlanRow = {
  plan_tier?: string | null;
  feature_overrides?: Record<string, boolean> | null;
};

export function parseSalonPlanState(row: SalonPlanRow): SalonPlanState {
  const rawTier = row.plan_tier ?? "professional";
  const plan_tier: PlanTierId = isPlanTierId(rawTier) ? rawTier : "professional";
  const feature_overrides =
    row.feature_overrides && typeof row.feature_overrides === "object"
      ? row.feature_overrides
      : {};
  return { plan_tier, feature_overrides };
}

export function salonRowHasFeature(
  row: SalonPlanRow,
  featureId: PlatformFeatureId
): boolean {
  return salonHasFeature(parseSalonPlanState(row), featureId);
}

export const DASHBOARD_NAV_FEATURES: Record<string, PlatformFeatureId> = {
  "/dashboard": "diary",
  "/queue": "walk_in_queue",
  "/team": "team",
  "/clients": "clients",
  "/checkout": "checkout",
  "/reports": "reports",
  "/targets": "targets_loyalty",
  "/campaigns": "campaigns",
  "/services": "service_catalog",
  "/products": "products_shop",
  "/help": "help",
};

/** Settings is always reachable; individual sections are gated in the UI. */
export function dashboardNavLinksForFeatures(
  enabled: Set<PlatformFeatureId>
): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Diary" },
    { href: "/queue", label: "Walk-in queue" },
    { href: "/team", label: "Team" },
    { href: "/clients", label: "Clients" },
    { href: "/checkout", label: "Checkout" },
    { href: "/reports", label: "Reports" },
    { href: "/targets", label: "Targets" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/services", label: "Services" },
    { href: "/products", label: "Products" },
    { href: "/settings", label: "Settings" },
    { href: "/help", label: "Help" },
  ];
  return links.filter(({ href }) => {
    const feature = DASHBOARD_NAV_FEATURES[href];
    if (!feature) return true;
    return enabled.has(feature);
  });
}

export function salonPlanHasFeature(
  state: SalonPlanState,
  featureId: PlatformFeatureId
): boolean {
  return salonHasFeature(state, featureId);
}

export { getEnabledFeatures };
