import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import {
  externalPaymentReference,
  isPaymentGatewayId,
  salonUsesStripeCheckout,
  type PaymentGatewayId,
} from "@/config/payment-gateways";
import { requireStaffElevationOrError } from "@/lib/staff-elevation";

/**
 * Record a sale paid on the salon's existing terminal (Worldpay, Dojo, other POS).
 */
export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const elevationError = await requireStaffElevationOrError({
    salonId: context.salon.id,
    memberRole: context.member.role ?? "",
  });
  if (elevationError) return NextResponse.json({ error: elevationError }, { status: 401 });

  let body: {
    salonId?: string;
    clientId?: string;
    stylistId?: string;
    silentAppointment?: boolean;
    serviceIds?: string[];
    productIds?: string[];
    customAmountMinor?: number | null;
    terminalReference?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const salonId = body.salonId;
  if (!salonId || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("payment_gateway, settings")
    .eq("id", salonId)
    .single();

  const gateway = (salon?.payment_gateway as string) ?? "stripe";
  if (salonUsesStripeCheckout(gateway)) {
    return NextResponse.json(
      { error: "This salon uses Stripe checkout. Use the card payment button instead." },
      { status: 400 }
    );
  }
  if (!isPaymentGatewayId(gateway)) {
    return NextResponse.json({ error: "Invalid payment gateway on salon." }, { status: 400 });
  }

  const memberId = body.stylistId ?? context.member.id;
  const { data: stylist } = await admin
    .from("salon_members")
    .select("id, employment_type")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .single();

  if (!stylist) {
    return NextResponse.json({ error: "Invalid stylist" }, { status: 400 });
  }

  const serviceIds = [...new Set((body.serviceIds ?? []).filter(Boolean))];
  const productIds = [...new Set((body.productIds ?? []).filter(Boolean))];

  let amountMinor = 0;
  if (body.customAmountMinor != null && body.customAmountMinor >= 50) {
    amountMinor = Math.round(body.customAmountMinor);
  } else {
    if (serviceIds.length) {
      const { data: svc } = await admin
        .from("services")
        .select("id, price_minor")
        .eq("salon_id", salonId)
        .in("id", serviceIds);
      amountMinor += (svc ?? []).reduce((s, r) => s + Number(r.price_minor ?? 0), 0);
    }
    if (productIds.length) {
      const { data: prods } = await admin
        .from("products")
        .select("id, price_minor")
        .eq("salon_id", salonId)
        .in("id", productIds);
      amountMinor += (prods ?? []).reduce((s, r) => s + Number(r.price_minor ?? 0), 0);
    }
  }

  if (amountMinor < 50) {
    return NextResponse.json(
      { error: "Minimum amount is £0.50 — select items or enter a custom amount." },
      { status: 400 }
    );
  }

  const employmentType = (stylist.employment_type as string) || "EMPLOYEE";
  const paymentRef = externalPaymentReference(gateway as PaymentGatewayId);
  const terminalRef = typeof body.terminalReference === "string" ? body.terminalReference.trim().slice(0, 120) : "";
  const syntheticId = terminalRef ? `${paymentRef}_${terminalRef.replace(/[^a-zA-Z0-9_-]/g, "")}` : paymentRef;

  const { error: insertError } = await admin.from("sales_transactions").insert({
    salon_id: salonId,
    stylist_id: stylist.id,
    client_id: body.clientId?.trim() || null,
    stripe_payment_intent_id: syntheticId.slice(0, 255),
    payment_gateway: gateway,
    amount_minor: amountMinor,
    currency: "gbp",
    employment_type: employmentType,
    service_ids: serviceIds,
    product_ids: productIds,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, amountMinor, paymentGateway: gateway });
}
