import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import {
  getStripePriceIdForTier,
  isStripePriceConfiguredForTier,
  type PlanTierId,
} from "@/config/plans";
import {
  getPlatformAppBaseUrl,
  isStripePriceConfiguredForPlatform,
  getStripePriceIdForPlatform,
  parseBillingInterval,
  platformBillingPath,
  platformProductName,
  tenantSubscriptionIsActive,
  type BillingPlatform,
  type PlatformBillingInterval,
} from "@core/billing/platform-billing";
import { fetchTenantByPaymentToken } from "@core/billing/platform-onboarding";
import { stripeMetadataForTenant } from "@core/billing/stripe-metadata";
import {
  stripeOnboardingTrialPeriod,
  stripeTrialPeriodForWelcome,
} from "@core/billing/stripe-trial";

function parsePlatform(raw: string | null): BillingPlatform {
  if (raw === "barber" || raw === "nail") return raw;
  return "salon";
}

/**
 * Public payment link from welcome email (token on tenant row).
 * No login required — Stripe Checkout collects card and starts subscription.
 * Optional `interval=monthly|yearly` (default monthly) for barber/nail.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const platform = parsePlatform(url.searchParams.get("platform"));
  const interval: PlatformBillingInterval = parseBillingInterval(url.searchParams.get("interval"));

  if (!token?.trim()) {
    return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
  }

  const tenant = await fetchTenantByPaymentToken(token, platform);
  if (!tenant) {
    return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
  }

  const appUrl = getPlatformAppBaseUrl(platform);
  const billingPath = platformBillingPath(platform);

  if (tenantSubscriptionIsActive(tenant.subscription_status) && tenant.stripe_billing_customer_id?.trim()) {
    return NextResponse.redirect(`${appUrl}${billingPath}?already=1`, 303);
  }

  let priceId: string;

  if (platform === "salon") {
    const planTier = (tenant.plan_tier ?? "professional") as PlanTierId;
    if (!isStripePriceConfiguredForTier(planTier)) {
      return NextResponse.json(
        { error: "Subscription billing is not configured for this plan." },
        { status: 503 }
      );
    }
    priceId = getStripePriceIdForTier(planTier);
  } else {
    if (!isStripePriceConfiguredForPlatform(platform, interval)) {
      const envHint =
        interval === "yearly"
          ? `STRIPE_PRICE_${platform.toUpperCase()}_YEARLY`
          : `STRIPE_PRICE_${platform.toUpperCase()}`;
      return NextResponse.json(
        {
          error: `Subscription billing is not configured for ${platformProductName(platform)} (${interval}). Set ${envHint} in environment variables.`,
        },
        { status: 503 }
      );
    }
    priceId = getStripePriceIdForPlatform(platform, interval);
  }

  const ownerEmail = tenant.owner_email?.trim();
  const existingCustomerId = tenant.stripe_billing_customer_id?.trim() || null;
  const metadata = stripeMetadataForTenant(
    platform,
    tenant.id,
    platform === "salon" && tenant.plan_tier
      ? { plan_tier: tenant.plan_tier }
      : platform !== "salon"
        ? { billing_interval: interval }
        : undefined
  );

  const trialData =
    platform === "salon"
      ? stripeOnboardingTrialPeriod()
      : stripeTrialPeriodForWelcome(tenant.onboarding_welcome_sent_at);

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : ownerEmail
          ? { customer_email: ownerEmail }
          : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${billingPath}?success=1`,
      cancel_url: `${appUrl}${billingPath}?cancel=1`,
      metadata,
      subscription_data: { metadata, ...trialData },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("subscribe-invite", platform, interval, err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
