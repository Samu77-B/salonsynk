import { getStripe } from "@/lib/stripe/server";
import {
  formatPlatformPrice,
  resolvePlatformIntervalFromPriceId,
  type PlatformBillingInterval,
} from "@core/billing/platform-billing";

export type PlatformStripeSubscriptionSummary = {
  status: string;
  interval: PlatformBillingInterval | null;
  priceLabel: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

/** Load the customer's active/trialing platform subscription summary from Stripe. */
export async function fetchPlatformStripeSubscriptionSummary(
  platform: "barber" | "nail",
  customerId: string | null | undefined
): Promise<PlatformStripeSubscriptionSummary | null> {
  const id = customerId?.trim();
  if (!id) return null;

  try {
    const stripe = getStripe();
    const list = await stripe.subscriptions.list({
      customer: id,
      status: "all",
      limit: 10,
    });
    const sub = list.data.find((s) => s.status === "active" || s.status === "trialing");
    if (!sub) return null;

    const item = sub.items.data[0];
    const priceId = item?.price?.id ?? null;
    const interval = resolvePlatformIntervalFromPriceId(platform, priceId);

    // Stripe SDK shapes vary by API version — read period end from sub or first item.
    const subRecord = sub as unknown as {
      current_period_end?: number;
      cancel_at_period_end?: boolean;
    };
    const itemRecord = item as unknown as { current_period_end?: number } | undefined;
    const periodEndUnix = subRecord.current_period_end ?? itemRecord?.current_period_end;
    const periodEnd =
      typeof periodEndUnix === "number"
        ? new Date(periodEndUnix * 1000).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;

    return {
      status: sub.status,
      interval,
      priceLabel: interval ? formatPlatformPrice(platform, interval) : null,
      cancelAtPeriodEnd: Boolean(subRecord.cancel_at_period_end ?? sub.cancel_at_period_end),
      currentPeriodEnd: periodEnd,
    };
  } catch (err) {
    console.error("fetchPlatformStripeSubscriptionSummary", platform, err);
    return null;
  }
}
