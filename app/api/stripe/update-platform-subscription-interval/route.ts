import { NextResponse } from "next/server";
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
  resolvePlatformIntervalFromPriceId,
  type PlatformBillingInterval,
} from "@core/billing/platform-billing";
import { stripeMetadataForTenant, tenantTable } from "@core/billing/stripe-metadata";

/**
 * Switch an existing Barber/Nail platform subscription between monthly and yearly.
 * Uses Stripe subscription item price update with proration.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const platformRaw = url.searchParams.get("platform");
  if (platformRaw !== "barber" && platformRaw !== "nail") {
    return NextResponse.json({ error: "platform must be barber or nail" }, { status: 400 });
  }
  const platform = platformRaw;
  const interval: PlatformBillingInterval = parseBillingInterval(url.searchParams.get("interval"));
  const billingPath = platformBillingPath(platform);
  const appUrl = getPlatformAppBaseUrl(platform);

  if (!isStripePriceConfiguredForPlatform(platform, interval)) {
    return NextResponse.redirect(`${appUrl}${billingPath}?error=price`, 303);
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

  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from(tenantTable(platform))
    .select("stripe_billing_customer_id")
    .eq("id", tenantId)
    .single();

  const customerId = (tenantRow?.stripe_billing_customer_id as string | null)?.trim();
  if (!customerId) {
    return NextResponse.redirect(`${appUrl}${billingPath}?error=nocustomer`, 303);
  }

  const newPriceId = getStripePriceIdForPlatform(platform, interval);

  try {
    const stripe = getStripe();
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const sub = list.data.find((s) => s.status === "active" || s.status === "trialing");
    if (!sub) {
      return NextResponse.redirect(`${appUrl}${billingPath}?error=nosub`, 303);
    }

    const item = sub.items.data[0];
    if (!item?.id) {
      return NextResponse.redirect(`${appUrl}${billingPath}?error=nosub`, 303);
    }

    const currentInterval = resolvePlatformIntervalFromPriceId(platform, item.price?.id);
    if (currentInterval === interval) {
      return NextResponse.redirect(`${appUrl}${billingPath}?already=1`, 303);
    }

    const metadata = {
      ...(sub.metadata ?? {}),
      ...stripeMetadataForTenant(platform, tenantId, { billing_interval: interval }),
    };

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: "create_prorations",
      metadata,
    });

    return NextResponse.redirect(
      `${appUrl}${billingPath}?switched=${interval}`,
      303
    );
  } catch (err) {
    console.error("update-platform-subscription-interval", platform, interval, err);
    return NextResponse.redirect(`${appUrl}${billingPath}?error=stripe`, 303);
  }
}
