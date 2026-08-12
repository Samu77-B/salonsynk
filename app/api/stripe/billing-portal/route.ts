import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import {
  getPlatformAppBaseUrl,
  platformBillingPath,
  type BillingPlatform,
} from "@core/billing/platform-billing";
import { tenantTable } from "@core/billing/stripe-metadata";

/**
 * Stripe Customer Portal — update card, cancel, view invoices for the platform subscription.
 * Salon: ?salonId=...
 * Barber / Nail: ?platform=barber|nail (uses the logged-in owner's tenant)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const platformParam = url.searchParams.get("platform");
  const salonId = url.searchParams.get("salonId");

  let platform: BillingPlatform = "salon";
  let tenantId: string;
  let memberRole: string;

  if (platformParam === "barber" || platformParam === "nail") {
    platform = platformParam;
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
  } else {
    if (!salonId) {
      return NextResponse.json({ error: "salonId or platform required" }, { status: 400 });
    }
    const context = await getCurrentUserSalon();
    if (!context || context.salon.id !== salonId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    tenantId = salonId;
    memberRole = (context.member.role ?? "").toLowerCase();
  }

  if (memberRole !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage billing" }, { status: 403 });
  }

  const admin = createAdminClient();
  const table = tenantTable(platform);
  const { data: tenant } = await admin
    .from(table)
    .select("stripe_billing_customer_id")
    .eq("id", tenantId)
    .single();

  const customerId = (tenant?.stripe_billing_customer_id as string | null)?.trim();
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No billing profile yet. Complete a subscription checkout first, or contact support if you already pay.",
      },
      { status: 400 }
    );
  }

  const returnUrl =
    platform === "salon"
      ? `${(process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "")}/settings`
      : `${getPlatformAppBaseUrl(platform)}${platformBillingPath(platform)}`;

  try {
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (err) {
    console.error("billing-portal", platform, err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
