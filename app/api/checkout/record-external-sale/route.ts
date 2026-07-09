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
import {
  loyaltyMetadata,
  resolveCheckoutAmounts,
  resolveCheckoutLineTotals,
} from "@/lib/loyalty/checkout-server";
import { resolveCheckoutClientId } from "@/lib/loyalty/resolve-client";
import { applyLoyaltyForCompletedSale } from "@/lib/loyalty/process-sale";

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
    redeemServicePoints?: number;
    redeemProductPoints?: number;
    joinLoyalty?: boolean;
    walkInName?: string;
    walkInEmail?: string;
    walkInPhone?: string;
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

  const clientResult = await resolveCheckoutClientId(admin, salonId, body.clientId, {
    joinLoyalty: body.joinLoyalty,
    walkInName: body.walkInName,
    walkInEmail: body.walkInEmail,
    walkInPhone: body.walkInPhone,
  });
  if (clientResult.error) return NextResponse.json({ error: clientResult.error }, { status: 400 });

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

  const lines = await resolveCheckoutLineTotals(admin, salonId, { serviceIds, productIds });
  const resolved = await resolveCheckoutAmounts(admin, salonId, clientResult.clientId, {
    serviceIds,
    productIds,
    customAmountMinor: body.customAmountMinor,
    redeemServicePoints: body.redeemServicePoints,
    redeemProductPoints: body.redeemProductPoints,
  });
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const amountMinor = resolved.amounts.amountMinor;
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
    client_id: clientResult.clientId?.trim() || null,
    stripe_payment_intent_id: syntheticId.slice(0, 255),
    payment_gateway: gateway,
    amount_minor: amountMinor,
    currency: "gbp",
    employment_type: employmentType,
    service_ids: lines.allowedServiceIds,
    product_ids: lines.allowedProductIds,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (clientResult.clientId) {
    const loyaltyResult = await applyLoyaltyForCompletedSale(admin, {
      salonId,
      clientId: clientResult.clientId,
      saleReference: syntheticId.slice(0, 255),
      servicePaidMinor: resolved.amounts.servicePaidMinor,
      productPaidMinor: resolved.amounts.productPaidMinor,
      redeemServicePoints: resolved.amounts.redeemServicePoints,
      redeemProductPoints: resolved.amounts.redeemProductPoints,
      memberId: context.member.id,
    });
    if (loyaltyResult.error) {
      return NextResponse.json({ error: loyaltyResult.error }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    amountMinor,
    paymentGateway: gateway,
    clientId: clientResult.clientId ?? undefined,
    loyalty: loyaltyMetadata(resolved.amounts),
  });
}
