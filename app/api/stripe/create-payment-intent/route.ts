import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { requireStaffElevationOrError } from "@/lib/staff-elevation";
import {
  loyaltyMetadata,
  resolveCheckoutAmounts,
  resolveCheckoutLineTotals,
} from "@/lib/loyalty/checkout-server";
import { resolveCheckoutClientId } from "@/lib/loyalty/resolve-client";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const elevationError = await requireStaffElevationOrError({
    salonId: context.salon.id,
    memberRole: context.member.role ?? "",
  });
  if (elevationError) return NextResponse.json({ error: elevationError }, { status: 401 });

  const body = await request.json();
  const {
    salonId,
    clientId: rawClientId,
    stylistId,
    silentAppointment,
    serviceIds,
    productIds,
    customAmountMinor,
    redeemServicePoints,
    redeemProductPoints,
    joinLoyalty,
    walkInName,
    walkInEmail,
    walkInPhone,
  } = body as {
    salonId: string;
    clientId?: string;
    stylistId?: string;
    silentAppointment?: boolean;
    serviceIds?: string[];
    productIds?: string[];
    customAmountMinor?: number | null;
    redeemServicePoints?: number;
    redeemProductPoints?: number;
    joinLoyalty?: boolean;
    walkInName?: string;
    walkInEmail?: string;
    walkInPhone?: string;
  };

  if (!salonId || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const memberId = stylistId ?? context.member.id;

  const clientResult = await resolveCheckoutClientId(supabase, salonId, rawClientId, {
    joinLoyalty,
    walkInName,
    walkInEmail,
    walkInPhone,
  });
  if (clientResult.error) return NextResponse.json({ error: clientResult.error }, { status: 400 });

  const { data: stylist } = await supabase
    .from("salon_members")
    .select("id, employment_type, stripe_connect_account_id")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .single();

  const { data: salon } = await supabase
    .from("salons")
    .select("stripe_connect_account_id, settings, payment_gateway")
    .eq("id", salonId)
    .single();

  const gateway = (salon?.payment_gateway as string) ?? "stripe";
  if (gateway !== "stripe") {
    return NextResponse.json(
      {
        error: `This salon uses ${gateway} for card payments. Record the sale in checkout after taking payment on your terminal.`,
      },
      { status: 400 }
    );
  }

  if (!salon?.stripe_connect_account_id) {
    return NextResponse.json({ error: "Connect your Stripe account in Settings first" }, { status: 400 });
  }

  if (!stylist) {
    return NextResponse.json({ error: "Invalid stylist" }, { status: 400 });
  }

  const normalizedServiceIds = Array.isArray(serviceIds)
    ? [...new Set(serviceIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const normalizedProductIds = Array.isArray(productIds)
    ? [...new Set(productIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];

  const lines = await resolveCheckoutLineTotals(supabase, salonId, {
    serviceIds: normalizedServiceIds,
    productIds: normalizedProductIds,
  });

  const resolved = await resolveCheckoutAmounts(supabase, salonId, clientResult.clientId, {
    serviceIds: normalizedServiceIds,
    productIds: normalizedProductIds,
    customAmountMinor,
    redeemServicePoints,
    redeemProductPoints,
  });
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const { amounts } = resolved;
  const amountMinor = amounts.amountMinor;

  if (amountMinor < 50) {
    return NextResponse.json({ error: "Minimum amount is £0.50" }, { status: 400 });
  }

  const useCustom =
    typeof customAmountMinor === "number" && !Number.isNaN(customAmountMinor) && customAmountMinor >= 50;
  if (!useCustom && lines.serviceSum + lines.productSum < 50) {
    return NextResponse.json(
      { error: "Select services and/or products, or enter a custom amount of at least £0.50" },
      { status: 400 }
    );
  }

  const employmentType = (stylist.employment_type as string) || "EMPLOYEE";

  try {
    const stripe = getStripe();
    const metadata: Record<string, string> = {
      salon_id: salonId,
      client_id: clientResult.clientId ?? "",
      employment_type: employmentType,
      stylist_id: stylist.id,
      silent_appointment: silentAppointment === true ? "true" : "false",
      service_ids: lines.allowedServiceIds.join(",").slice(0, 450),
      product_ids: lines.allowedProductIds.join(",").slice(0, 450),
      ...loyaltyMetadata(amounts),
    };

    if (employmentType === "EMPLOYEE") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: "gbp",
        transfer_data: { destination: salon.stripe_connect_account_id },
        metadata,
      });
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        clientId: clientResult.clientId ?? undefined,
      });
    }

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
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      clientId: clientResult.clientId ?? undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
