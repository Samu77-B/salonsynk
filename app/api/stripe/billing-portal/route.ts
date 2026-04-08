import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

/**
 * Stripe Customer Portal — update card, cancel, view invoices for the platform subscription.
 * Requires stripe_billing_customer_id (set after first successful Checkout).
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

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("stripe_billing_customer_id")
    .eq("id", salonId)
    .single();

  const customerId = salon?.stripe_billing_customer_id?.trim();
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No billing profile yet. Complete a subscription checkout first, or contact support if you already pay.",
      },
      { status: 400 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "");

  try {
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (err) {
    console.error("billing-portal", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
