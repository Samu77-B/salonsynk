/**
 * Platform plan tiers and feature bundles (master admin + billing).
 */

export type PlanTierId = "essentials" | "professional" | "complete";

export type PlatformFeatureId =
  | "diary"
  | "team"
  | "clients"
  | "service_catalog"
  | "online_booking"
  | "branding"
  | "staff_logins"
  | "help"
  | "checkout"
  | "stripe_connect"
  | "reports"
  | "email_reminders"
  | "review_requests"
  | "deposits_no_show"
  | "appointment_photos"
  | "processing_time"
  | "campaigns"
  | "we_miss_you"
  | "aftercare"
  | "targets_loyalty"
  | "products_shop"
  | "chair_renter_splits";

export type PlatformFeatureMeta = {
  id: PlatformFeatureId;
  label: string;
  description: string;
};

export const PLATFORM_FEATURES: PlatformFeatureMeta[] = [
  { id: "diary", label: "Diary", description: "Day/week views, drag reschedule, appointments" },
  { id: "team", label: "Team", description: "Staff, roles, invites, diary colours" },
  { id: "clients", label: "Clients", description: "Client records, notes, colour history" },
  { id: "service_catalog", label: "Service menu", description: "Services list for booking and checkout" },
  { id: "online_booking", label: "Online booking", description: "Public /book page and embed" },
  { id: "branding", label: "Branding", description: "Logo, colours, display name on booking" },
  { id: "staff_logins", label: "Front-desk logins", description: "Shared staff role and PIN flows" },
  { id: "help", label: "Help", description: "In-app help (always available)" },
  { id: "checkout", label: "Checkout", description: "In-salon payments" },
  { id: "stripe_connect", label: "Stripe Connect", description: "Connect salon account for payouts" },
  { id: "reports", label: "Reports", description: "Reports and PDF exports" },
  { id: "email_reminders", label: "Email reminders", description: "Appointment reminder emails" },
  { id: "review_requests", label: "Review requests", description: "Post-visit review emails" },
  { id: "deposits_no_show", label: "Deposits & no-show", description: "Deposit settings and no-show capture" },
  { id: "appointment_photos", label: "Appointment photos", description: "Before/after photo URLs on appointments" },
  { id: "processing_time", label: "Processing time", description: "Service processing time and diary gaps" },
  { id: "campaigns", label: "Campaigns", description: "Marketing email campaigns" },
  { id: "we_miss_you", label: "We Miss You", description: "Lapsed-client re-engagement" },
  { id: "aftercare", label: "Aftercare", description: "Post-appointment aftercare messages" },
  { id: "targets_loyalty", label: "Targets & loyalty", description: "Staff targets and client loyalty tiers" },
  { id: "products_shop", label: "Products & shop", description: "Retail products and /shop page" },
  { id: "chair_renter_splits", label: "Chair renter splits", description: "RENTER splits via Stripe Connect" },
];

const ESSENTIALS_FEATURES: PlatformFeatureId[] = [
  "diary",
  "team",
  "clients",
  "service_catalog",
  "online_booking",
  "branding",
  "staff_logins",
  "help",
];

const PROFESSIONAL_ADDONS: PlatformFeatureId[] = [
  "checkout",
  "stripe_connect",
  "reports",
  "email_reminders",
  "review_requests",
  "deposits_no_show",
  "appointment_photos",
  "processing_time",
];

const COMPLETE_ADDONS: PlatformFeatureId[] = [
  "campaigns",
  "we_miss_you",
  "aftercare",
  "targets_loyalty",
  "products_shop",
  "chair_renter_splits",
];

export const PLAN_TIERS: Record<
  PlanTierId,
  {
    label: string;
    amountGbp: number;
    tagline: string;
    features: PlatformFeatureId[];
  }
> = {
  essentials: {
    label: "Essentials",
    amountGbp: 29,
    tagline: "Run the floor day-to-day",
    features: [...ESSENTIALS_FEATURES],
  },
  professional: {
    label: "Professional",
    amountGbp: 49,
    tagline: "Get paid and keep clients coming back",
    features: [...ESSENTIALS_FEATURES, ...PROFESSIONAL_ADDONS],
  },
  complete: {
    label: "Complete",
    amountGbp: 69,
    tagline: "Grow with marketing, retail, and advanced ops",
    features: [...ESSENTIALS_FEATURES, ...PROFESSIONAL_ADDONS, ...COMPLETE_ADDONS],
  },
};

export const PLAN_TIER_IDS = Object.keys(PLAN_TIERS) as PlanTierId[];

export function isPlanTierId(value: string): value is PlanTierId {
  return PLAN_TIER_IDS.includes(value as PlanTierId);
}

export function formatPlanPrice(tier: PlanTierId): string {
  return `£${PLAN_TIERS[tier].amountGbp}/mo`;
}

export function tierIncludesFeature(tier: PlanTierId, featureId: PlatformFeatureId): boolean {
  return PLAN_TIERS[tier].features.includes(featureId);
}

export type SalonPlanState = {
  plan_tier: PlanTierId;
  feature_overrides: Record<string, boolean>;
};

export function salonHasFeature(
  state: SalonPlanState,
  featureId: PlatformFeatureId
): boolean {
  if (featureId in state.feature_overrides) {
    return Boolean(state.feature_overrides[featureId]);
  }
  return tierIncludesFeature(state.plan_tier, featureId);
}

export function getEnabledFeatures(state: SalonPlanState): PlatformFeatureId[] {
  return PLATFORM_FEATURES.map((f) => f.id).filter((id) => salonHasFeature(state, id));
}

export type FeatureOverrideValue = "default" | "on" | "off";

export function getFeatureOverrideValue(
  overrides: Record<string, boolean>,
  featureId: PlatformFeatureId
): FeatureOverrideValue {
  if (!(featureId in overrides)) return "default";
  return overrides[featureId] ? "on" : "off";
}

export function overrideToStorage(
  value: FeatureOverrideValue
): boolean | undefined {
  if (value === "default") return undefined;
  return value === "on";
}

export function buildFeatureOverrides(
  entries: Partial<Record<PlatformFeatureId, FeatureOverrideValue>>
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(entries)) {
    if (val === "default" || val === undefined) continue;
    out[key] = val === "on";
  }
  return out;
}

export function getStripePriceIdForTier(tier: PlanTierId): string {
  const map: Record<PlanTierId, string | undefined> = {
    essentials: process.env.STRIPE_PRICE_ESSENTIALS,
    professional:
      process.env.STRIPE_PRICE_PROFESSIONAL ?? process.env.STRIPE_FLAT_FEE_PRICE_ID,
    complete: process.env.STRIPE_PRICE_COMPLETE,
  };
  return map[tier]?.trim() ?? "";
}

export function tierFromStripePriceId(priceId: string): PlanTierId | null {
  const id = priceId.trim();
  if (!id) return null;
  const legacy = process.env.STRIPE_FLAT_FEE_PRICE_ID?.trim();
  if (legacy && id === legacy) return "professional";
  for (const tier of PLAN_TIER_IDS) {
    if (getStripePriceIdForTier(tier) === id) return tier;
  }
  return null;
}

export function isStripePriceConfiguredForTier(tier: PlanTierId): boolean {
  return Boolean(getStripePriceIdForTier(tier));
}

/** First price ID on a Stripe subscription object (Checkout webhook payload). */
export function priceIdFromStripeSubscription(sub: {
  items?: { data?: Array<{ price?: string | { id?: string } | null } | null> | null };
}): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (!price) return null;
  if (typeof price === "string") return price;
  return price.id?.trim() ?? null;
}

export function resolvePlanTierFromSubscription(sub: {
  metadata?: { plan_tier?: string; salon_id?: string } | null;
  items?: { data?: Array<{ price?: string | { id?: string } | null } | null> | null };
}): PlanTierId | null {
  const metaTier = sub.metadata?.plan_tier?.trim();
  if (metaTier && isPlanTierId(metaTier)) return metaTier;
  const priceId = priceIdFromStripeSubscription(sub);
  if (priceId) return tierFromStripePriceId(priceId);
  return null;
}

export function subscriptionStatusToSalonField(
  stripeStatus: string | undefined
): "active" | "past_due" | "inactive" | "canceled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "canceled") return "canceled";
  return "inactive";
}
