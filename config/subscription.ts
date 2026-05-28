/**
 * Legacy subscription exports — prefer config/plans.ts for tier pricing.
 */

import { PLAN_TIERS, formatPlanPrice } from "./plans";

export const FLAT_FEE = {
  AMOUNT_GBP: PLAN_TIERS.professional.amountGbp,
  CURRENCY: "gbp",
  BILLING_INTERVAL: "month" as const,
  /** Professional tier price (legacy env STRIPE_FLAT_FEE_PRICE_ID still supported). */
  STRIPE_PRICE_ID:
    process.env.STRIPE_PRICE_PROFESSIONAL ??
    process.env.STRIPE_FLAT_FEE_PRICE_ID ??
    "",
  STRIPE_PRODUCT_ID: process.env.STRIPE_FLAT_FEE_PRODUCT_ID ?? "",
} as const;

export function formatFlatFee(): string {
  return formatPlanPrice("professional");
}
