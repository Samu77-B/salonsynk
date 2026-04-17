import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { requireStaffElevationOrError } from "@/lib/staff-elevation";

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
    clientId,
    stylistId,
    silentAppointment,
    serviceIds,
    productIds,
    customAmountMinor,
  } = body as {
    salonId: string;
    clientId?: string;
    stylistId?: string;
    silentAppointment?: boolean;
    serviceIds?: string[];
    productIds?: string[];
    /** When set, overrides line total (pence). */
    customAmountMinor?: number | null;
  };

  if (!salonId || context.salon.id !== salonId) {
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

  const normalizedServiceIds = Array.isArray(serviceIds)
    ? [...new Set(serviceIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const normalizedProductIds = Array.isArray(productIds)
    ? [...new Set(productIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];

  let allowedServiceIds: string[] = [];
  if (normalizedServiceIds.length > 0) {
    const { data: matchedServices } = await supabase
      .from("services")
      .select("id, price_minor")
      .eq("salon_id", salonId)
      .in("id", normalizedServiceIds);
    allowedServiceIds = (matchedServices ?? []).map((s) => s.id);
  }

  let allowedProductIds: string[] = [];
  let productSum = 0;
  if (normalizedProductIds.length > 0) {
    const { data: matchedProducts } = await supabase
      .from("products")
      .select("id, price_minor")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("id", normalizedProductIds);
    for (const p of matchedProducts ?? []) {
      allowedProductIds.push(p.id);
      productSum += Number(p.price_minor ?? 0);
    }
  }

  let serviceSum = 0;
  if (allowedServiceIds.length > 0) {
    const { data: svcRows } = await supabase
      .from("services")
      .select("price_minor")
      .eq("salon_id", salonId)
      .in("id", allowedServiceIds);
    serviceSum = (svcRows ?? []).reduce((acc, s) => acc + Number(s.price_minor ?? 0), 0);
  }

  const lineTotalMinor = serviceSum + productSum;
  const useCustom =
    typeof customAmountMinor === "number" && !Number.isNaN(customAmountMinor) && customAmountMinor >= 50;
  const amountMinor = useCustom ? Math.round(customAmountMinor) : lineTotalMinor;

  if (amountMinor < 50) {
    return NextResponse.json({ error: "Minimum amount is £0.50" }, { status: 400 });
  }

  if (!useCustom && lineTotalMinor < 50) {
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
      client_id: clientId ?? "",
      employment_type: employmentType,
      stylist_id: stylist.id,
      silent_appointment: silentAppointment === true ? "true" : "false",
      service_ids: allowedServiceIds.join(",").slice(0, 450),
      product_ids: allowedProductIds.join(",").slice(0, 450),
    };

    if (employmentType === "EMPLOYEE") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: "gbp",
        transfer_data: { destination: salon.stripe_connect_account_id },
        metadata,
      });
      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
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
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
