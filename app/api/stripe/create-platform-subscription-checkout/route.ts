import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import {
  getPlatformAppBaseUrl,
  getStripePriceIdForPlatform,
  isStripePriceConfiguredForPlatform,
  parseBillingInterval,
  platformBillingPath,
  platformProductName,
  type PlatformBillingInterval,
} from "@core/billing/platform-billing";
import { stripeMetadataForTenant, tenantTable } from "@core/billing/stripe-metadata";
import { stripeTrialPeriodForWelcome } from "@core/billing/stripe-trial";

export const dynamic = "force-dynamic";

/**
 * Logged-in owner Checkout for BarberSynk / NailSynk (monthly or yearly).
 * Uses remaining free-trial days from welcome email when still in the free window.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const platformRaw = url.searchParams.get("platform");
  if (platformRaw !== "barber" && platformRaw !== "nail") {
    return NextResponse.json({ error: "platform must be barber or nail" }, { status: 400 });
  }
  const platform = platformRaw;
  const interval: PlatformBillingInterval = parseBillingInterval(url.searchParams.get("interval"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email?.trim()) {
    return NextResponse.json({ error: "Account email required for billing" }, { status: 401 });
  }

  let tenantId: string;
  let memberRole: string;

  if (platform === "barber") {
    const context = await getCurrentUserShop();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    tenantId = context.shop.id;
    memberRole = (context.member.role ?? "").toLowerCase();
  } else {
    const context = await getCurrentUserNailSalon();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    tenantId = context.salon.id;
    memberRole = (context.member.role ?? "").toLowerCase();
  }

  if (memberRole !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage billing" }, { status: 403 });
  }

  if (!isStripePriceConfiguredForPlatform(platform, interval)) {
    const envHint =
      interval === "yearly"
        ? `STRIPE_PRICE_${platform.toUpperCase()}_YEARLY`
        : `STRIPE_PRICE_${platform.toUpperCase()}`;
    return NextResponse.json(
      {
        error: `Subscription billing is not configured for ${platformProductName(platform)} (${interval}). Set ${envHint}.`,
      },
      { status: 503 }
    );
  }

  const priceId = getStripePriceIdForPlatform(platform, interval);
  const admin = createAdminClient();
  const table = tenantTable(platform);
  const { data: tenantRow, error: tenantError } = await admin
    .from(table)
    .select("id, name, stripe_billing_customer_id, onboarding_welcome_sent_at, subscription_status")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenantRow) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const existingCustomerId =
    (tenantRow.stripe_billing_customer_id as string | null)?.trim() || null;
  const metadata = stripeMetadataForTenant(platform, tenantId, {
    billing_interval: interval,
  });
  const trialData = stripeTrialPeriodForWelcome(
    tenantRow.onboarding_welcome_sent_at as string | null
  );

  const appUrl = getPlatformAppBaseUrl(platform);
  const billingPath = platformBillingPath(platform);

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email.trim() }),
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
    console.error("create-platform-subscription-checkout", platform, interval, err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
