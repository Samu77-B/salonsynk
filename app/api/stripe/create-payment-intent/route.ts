import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { amountMinor, clientId, salonId, stylistId, silentAppointment } = body as {
    amountMinor: number;
    clientId?: string;
    salonId: string;
    stylistId?: string;
    silentAppointment?: boolean;
  };
  if (!amountMinor || amountMinor < 50 || !salonId || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const memberId = stylistId ?? context.member.id;

  const { data: stylist } = await supabase
    .from("salon_members")
    .select("id, employment_type, stripe_connect_account_id")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .single();

  const { data: salon } = await supabase
    .from("salons")
    .select("stripe_connect_account_id, settings")
    .eq("id", salonId)
    .single();

  if (!salon?.stripe_connect_account_id) {
    return NextResponse.json({ error: "Connect your Stripe account in Settings first" }, { status: 400 });
  }

  if (!stylist) {
    return NextResponse.json({ error: "Invalid stylist" }, { status: 400 });
  }

  const employmentType = (stylist.employment_type as string) || "EMPLOYEE";

  try {
    const stripe = getStripe();
    const metadata: Record<string, string> = {
      salon_id: salonId,
      client_id: clientId ?? "",
      employment_type: employmentType,
      stylist_id: stylist.id,
      silent_appointment: silentAppointment === true ? "true" : "false",
    };

    if (employmentType === "EMPLOYEE") {
      // 100% to salon owner's Stripe account
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: "gbp",
        transfer_data: { destination: salon.stripe_connect_account_id },
        metadata,
      });
      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    }

    // RENTER: route payment to stylist's Connect account; booth rent (admin_fee_percent) to platform
    if (!stylist.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "Renter must connect their Stripe account in Settings before receiving payments" },
        { status: 400 }
      );
    }
    const settings = (salon.settings as Record<string, unknown>) ?? {};
    const adminFeePercent = Math.min(100, Math.max(0, Number(settings.admin_fee_percent) || 0));
    const applicationFeeAmount = Math.round((amountMinor * adminFeePercent) / 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: "gbp",
      transfer_data: {
        destination: stylist.stripe_connect_account_id,
      },
      application_fee_amount: Math.min(Math.max(0, applicationFeeAmount), amountMinor),
      metadata,
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
