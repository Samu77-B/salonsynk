import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import {
  getStripePriceIdForTier,
  isStripePriceConfiguredForTier,
} from "@/config/plans";
import {
  fetchSalonByPaymentToken,
  getAppBaseUrl,
  parsePlanTier,
  salonSubscriptionIsActive,
} from "@/lib/onboarding";

/**
 * Public payment link from welcome email (token on salon row).
 * No login required — Stripe Checkout collects card and starts monthly subscription.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token?.trim()) {
    return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
  }

  const salon = await fetchSalonByPaymentToken(token);
  if (!salon) {
    return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
  }

  if (salonSubscriptionIsActive(salon.subscription_status)) {
    const appUrl = getAppBaseUrl();
    return NextResponse.redirect(`${appUrl}/billing?already=1`, 303);
  }

  const planTier = parsePlanTier(salon.plan_tier);
  if (!isStripePriceConfiguredForTier(planTier)) {
    return NextResponse.json(
      { error: "Subscription billing is not configured for this plan." },
      { status: 503 }
    );
  }

  const priceId = getStripePriceIdForTier(planTier);
  const appUrl = getAppBaseUrl();
  const ownerEmail = salon.owner_email?.trim();

  try {
    const stripe = getStripe();
    const existingCustomerId =
      (salon as { stripe_billing_customer_id?: string | null }).stripe_billing_customer_id?.trim() ||
      null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : ownerEmail
          ? { customer_email: ownerEmail }
          : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancel=1`,
      metadata: { salon_id: salon.id, plan_tier: planTier },
      subscription_data: {
        metadata: { salon_id: salon.id, plan_tier: planTier },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("subscribe-invite", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
