/**
 * Flat-fee subscription config for SalonSynk.
 * Single source of truth for pricing and Stripe product/price IDs.
 */

export const FLAT_FEE = {
  AMOUNT_GBP: 20,
  CURRENCY: "gbp",
  BILLING_INTERVAL: "month" as const,
  /** Stripe Price ID — set when product is created in Stripe */
  STRIPE_PRICE_ID: process.env.STRIPE_FLAT_FEE_PRICE_ID ?? "",
  /** Stripe Product ID — set when product is created in Stripe */
  STRIPE_PRODUCT_ID: process.env.STRIPE_FLAT_FEE_PRODUCT_ID ?? "",
} as const;

export function formatFlatFee(): string {
  return `£${FLAT_FEE.AMOUNT_GBP}/mo`;
}
