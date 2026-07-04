import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import {
  getStripePriceIdForTier,
  isStripePriceConfiguredForTier,
  formatPlanPrice,
  PLAN_TIERS,
  type PlanTierId,
} from "@/config/plans";
import {
  formatPlatformPrice,
  getPlatformAppBaseUrl,
  isStripePriceConfiguredForPlatform,
  getStripePriceIdForPlatform,
  platformBillingPath,
  platformProductName,
  tenantSubscriptionIsActive,
  type BillingPlatform,
} from "@core/billing/platform-billing";
import { fetchTenantByPaymentToken } from "@core/billing/platform-onboarding";
import { stripeMetadataForTenant } from "@core/billing/stripe-metadata";
import { stripeOnboardingTrialPeriod } from "@core/billing/stripe-trial";

function parsePlatform(raw: string | null): BillingPlatform {
  if (raw === "barber" || raw === "nail") return raw;
  return "salon";
}

/**
 * Public payment link from welcome email (token on tenant row).
 * No login required — Stripe Checkout collects card and starts monthly subscription.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const platform = parsePlatform(url.searchParams.get("platform"));

  if (!token?.trim()) {
    return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
  }

  const tenant = await fetchTenantByPaymentToken(token, platform);
  if (!tenant) {
    return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
  }

  const appUrl = getPlatformAppBaseUrl(platform);
  const billingPath = platformBillingPath(platform);

  if (tenantSubscriptionIsActive(tenant.subscription_status)) {
    return NextResponse.redirect(`${appUrl}${billingPath}?already=1`, 303);
  }

  let priceId: string;
  let planLabel: string;
  let planPrice: string;

  if (platform === "salon") {
    const planTier = (tenant.plan_tier ?? "professional") as PlanTierId;
    if (!isStripePriceConfiguredForTier(planTier)) {
      return NextResponse.json(
        { error: "Subscription billing is not configured for this plan." },
        { status: 503 }
      );
    }
    priceId = getStripePriceIdForTier(planTier);
    planLabel = PLAN_TIERS[planTier].label;
    planPrice = formatPlanPrice(planTier);
  } else {
    if (!isStripePriceConfiguredForPlatform(platform)) {
      return NextResponse.json(
        {
          error: `Subscription billing is not configured for ${platformProductName(platform)}. Set STRIPE_PRICE_${platform.toUpperCase()} in environment variables.`,
        },
        { status: 503 }
      );
    }
    priceId = getStripePriceIdForPlatform(platform);
    planLabel = platformProductName(platform);
    planPrice = formatPlatformPrice(platform);
  }

  const ownerEmail = tenant.owner_email?.trim();
  const existingCustomerId = tenant.stripe_billing_customer_id?.trim() || null;
  const metadata = stripeMetadataForTenant(
    platform,
    tenant.id,
    platform === "salon" && tenant.plan_tier ? { plan_tier: tenant.plan_tier } : undefined
  );

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
      subscription_data: { metadata, ...stripeOnboardingTrialPeriod() },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("subscribe-invite", platform, err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
