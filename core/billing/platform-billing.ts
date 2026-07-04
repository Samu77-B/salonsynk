import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { SITE } from "@core/config/site";

export type BillingPlatform = "salon" | "barber" | "nail";

export const BARBER_MONTHLY_GBP = 25;
export const NAIL_MONTHLY_GBP = 25;

export function getStripePriceIdForPlatform(platform: "barber" | "nail"): string {
  if (platform === "barber") return process.env.STRIPE_PRICE_BARBER?.trim() ?? "";
  return process.env.STRIPE_PRICE_NAIL?.trim() ?? "";
}

export function isStripePriceConfiguredForPlatform(platform: "barber" | "nail"): boolean {
  return Boolean(getStripePriceIdForPlatform(platform));
}

export function formatPlatformPrice(platform: "barber" | "nail"): string {
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

export function paymentInviteUrl(platform: "barber" | "nail", token: string): string {
  const base = getPlatformAppBaseUrl(platform);
  return `${base}/api/stripe/subscribe-invite?token=${encodeURIComponent(token)}&platform=${platform}`;
}

export type TenantBillingRow = {
  id: string;
  name: string;
  subscription_status?: string | null;
  subscription_required?: boolean | null;
  payment_invite_token?: string | null;
  stripe_billing_customer_id?: string | null;
};

export function tenantRequiresPayment(row: TenantBillingRow): boolean {
  if (!row.subscription_required) return false;
  const status = (row.subscription_status ?? "").toLowerCase();
  return status !== "active" && status !== "trialing";
}

export function tenantSubscriptionIsActive(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
}
