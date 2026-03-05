import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { amountMinor, clientId, salonId } = body as { amountMinor: number; clientId?: string; salonId: string };
  if (!amountMinor || amountMinor < 50 || !salonId || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("stripe_connect_account_id")
    .eq("id", salonId)
    .single();

  if (!salon?.stripe_connect_account_id) {
    return NextResponse.json({ error: "Connect your Stripe account in Settings first" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: "gbp",
      transfer_data: { destination: salon.stripe_connect_account_id },
      metadata: { salon_id: salonId, client_id: clientId ?? "" },
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
