import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { FLAT_FEE } from "@/config/subscription";

/**
 * Redirects the salon owner to Stripe Checkout (mode=subscription) for the platform £50/mo fee.
 * Charges accrue to the Stripe account tied to STRIPE_SECRET_KEY (SalonSynk platform), not Connect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const salonId = url.searchParams.get("salonId");
  if (!salonId) {
    return NextResponse.json({ error: "salonId required" }, { status: 400 });
  }

  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (context.member.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const priceId = FLAT_FEE.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    return NextResponse.json(
      { error: "Subscription billing is not configured (missing STRIPE_FLAT_FEE_PRICE_ID)." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email?.trim()) {
    return NextResponse.json({ error: "Account email required for billing" }, { status: 400 });
  }

  const { data: salonRow } = await supabase
    .from("salons")
    .select("stripe_billing_customer_id")
    .eq("id", salonId)
    .single();
  const existingCustomerId = salonRow?.stripe_billing_customer_id?.trim() || null;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "");

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email.trim() }),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?subscription=success`,
      cancel_url: `${appUrl}/settings?subscription=cancel`,
      metadata: { salon_id: salonId },
      subscription_data: {
        metadata: { salon_id: salonId },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("create-subscription-checkout", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
