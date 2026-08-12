import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { SITE } from "@core/config/site";
import { ONBOARDING_FREE_TRIAL_DAYS } from "@/lib/onboarding";

export type BillingPlatform = "salon" | "barber" | "nail";
export type PlatformBillingInterval = "monthly" | "yearly";

export const BARBER_MONTHLY_GBP = 25;
export const NAIL_MONTHLY_GBP = 25;
/** Display-only yearly amount (set to match Stripe yearly prices). */
export const BARBER_YEARLY_GBP = 250;
export const NAIL_YEARLY_GBP = 250;

export function parseBillingInterval(raw: string | null | undefined): PlatformBillingInterval {
  return raw === "yearly" ? "yearly" : "monthly";
}

export function getStripePriceIdForPlatform(
  platform: "barber" | "nail",
  interval: PlatformBillingInterval = "monthly"
): string {
  if (platform === "barber") {
    return interval === "yearly"
      ? process.env.STRIPE_PRICE_BARBER_YEARLY?.trim() ?? ""
      : process.env.STRIPE_PRICE_BARBER?.trim() ?? "";
  }
  return interval === "yearly"
    ? process.env.STRIPE_PRICE_NAIL_YEARLY?.trim() ?? ""
    : process.env.STRIPE_PRICE_NAIL?.trim() ?? "";
}

export function isStripePriceConfiguredForPlatform(
  platform: "barber" | "nail",
  interval: PlatformBillingInterval = "monthly"
): boolean {
  return Boolean(getStripePriceIdForPlatform(platform, interval));
}

export function formatPlatformPrice(
  platform: "barber" | "nail",
  interval: PlatformBillingInterval = "monthly"
): string {
  if (interval === "yearly") {
    const amount = platform === "barber" ? BARBER_YEARLY_GBP : NAIL_YEARLY_GBP;
    return `£${amount}/year`;
  }
  const amount = platform === "barber" ? BARBER_MONTHLY_GBP : NAIL_MONTHLY_GBP;
  return `£${amount}/month`;
}

export function getPlatformAppBaseUrl(platform: BillingPlatform): string {
  if (platform === "barber") return BARBER_SITE.url.replace(/\/$/, "");
  if (platform === "nail") return NAIL_SITE.url.replace(/\/$/, "");
  return SITE.url.replace(/\/$/, "");
}

export function platformBillingPath(platform: BillingPlatform): string {
  if (platform === "barber") return "/barber/billing";
  if (platform === "nail") return "/nail/billing";
  return "/billing";
}

export function platformDashboardPath(platform: BillingPlatform): string {
  if (platform === "barber") return "/barber/dashboard";
  if (platform === "nail") return "/nail/queue";
  return "/dashboard";
}

export function platformProductName(platform: BillingPlatform): string {
  if (platform === "barber") return "BarberSynk";
  if (platform === "nail") return "NailSynk";
  return SITE.name;
}

export function paymentInviteUrl(
  platform: "barber" | "nail",
  token: string,
  interval: PlatformBillingInterval = "monthly"
): string {
  const base = getPlatformAppBaseUrl(platform);
  const intervalParam = interval === "yearly" ? "&interval=yearly" : "";
  return `${base}/api/stripe/subscribe-invite?token=${encodeURIComponent(token)}&platform=${platform}${intervalParam}`;
}

export function platformCheckoutPath(
  platform: "barber" | "nail",
  interval: PlatformBillingInterval
): string {
  return `/api/stripe/create-platform-subscription-checkout?platform=${platform}&interval=${interval}`;
}

export function platformBillingPortalPath(platform: "barber" | "nail"): string {
  return `/api/stripe/billing-portal?platform=${platform}`;
}

export function platformSwitchIntervalPath(
  platform: "barber" | "nail",
  interval: PlatformBillingInterval
): string {
  return `/api/stripe/update-platform-subscription-interval?platform=${platform}&interval=${interval}`;
}

/** Map a Stripe Price ID back to monthly/yearly for barber/nail. */
export function resolvePlatformIntervalFromPriceId(
  platform: "barber" | "nail",
  priceId: string | null | undefined
): PlatformBillingInterval | null {
  const id = priceId?.trim() ?? "";
  if (!id) return null;
  if (id === getStripePriceIdForPlatform(platform, "yearly")) return "yearly";
  if (id === getStripePriceIdForPlatform(platform, "monthly")) return "monthly";
  return null;
}

export type TenantBillingRow = {
  id: string;
  name: string;
  subscription_status?: string | null;
  subscription_required?: boolean | null;
  payment_invite_token?: string | null;
  stripe_billing_customer_id?: string | null;
  onboarding_welcome_sent_at?: string | null;
};

/** Remaining free-trial days from welcome email (0 if expired / unknown). */
export function remainingOnboardingTrialDays(
  welcomeSentAt: string | null | undefined,
  now: Date = new Date()
): number {
  if (!welcomeSentAt) return 0;
  const start = new Date(welcomeSentAt).getTime();
  if (Number.isNaN(start)) return 0;
  const endsAt = start + ONBOARDING_FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const msLeft = endsAt - now.getTime();
  if (msLeft <= 0) return 0;
  return Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

export function isOnboardingTrialActive(
  row: Pick<TenantBillingRow, "subscription_status" | "onboarding_welcome_sent_at">,
  now: Date = new Date()
): boolean {
  const status = (row.subscription_status ?? "").toLowerCase();
  if (status !== "trialing") return false;
  return remainingOnboardingTrialDays(row.onboarding_welcome_sent_at, now) > 0;
}

/**
 * True when the tenant must pay before using the dashboard.
 * `active` always passes. App-granted `trialing` only passes while within the free window.
 * Stripe `trialing` after Checkout also has welcome_sent_at in range or status becomes active via webhook.
 */
export function tenantRequiresPayment(row: TenantBillingRow, now: Date = new Date()): boolean {
  if (!row.subscription_required) return false;
  const status = (row.subscription_status ?? "").toLowerCase();
  if (status === "active") return false;
  if (status === "trialing" && isOnboardingTrialActive(row, now)) return false;
  // Stripe Checkout may set trialing with a card on file — treat as paid access.
  if (status === "trialing" && row.stripe_billing_customer_id?.trim()) return false;
  return true;
}

export function tenantSubscriptionIsActive(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
}

/** Show subscribe CTA while still on free trial and no Stripe customer yet. */
export function shouldShowPlatformSubscribeBanner(row: TenantBillingRow, now: Date = new Date()): boolean {
  const status = (row.subscription_status ?? "").toLowerCase();
  if (status === "active") return false;
  if (row.stripe_billing_customer_id?.trim()) return false;
  return isOnboardingTrialActive(row, now);
}
